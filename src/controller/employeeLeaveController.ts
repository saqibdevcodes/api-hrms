import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../types/auth";

export class EmployeeLeaveController {
  // Get employee leave balance by user ID
  static async getEmployeeLeave(req: AuthenticatedRequest, res: Response) {
    try {
      let { userId } = req.params;
      if (!userId || userId === "me" || userId === "self") {
        userId = req.user?.id || "";
      }

      const role = String(req.user?.role || "").toUpperCase();
      const isPrivileged = ["ADMIN", "SUPER_ADMIN", "HR"].includes(role);

      // Check if user is requesting their own leave or has admin/HR privileges
      if (req.user?.id !== userId && !isPrivileged) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own leave balance.",
        });
      }

      const employeeLeave = await prisma.employeeLeave.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
            },
          },
          leavePolicy: true,
        },
      });

      if (!employeeLeave) {
        // Fallback to active policy defaults so user is never left without leave balance info
        const userWithPolicy = await prisma.user.findUnique({
          where: { id: userId },
          include: { leavePolicy: true },
        });

        if (userWithPolicy) {
          const annualLeaves = userWithPolicy.leavePolicy?.annualLeaves ?? 21;
          const sickLeaves = userWithPolicy.leavePolicy?.sickLeaves ?? 10;
          const casualLeaves = userWithPolicy.leavePolicy?.casualLeaves ?? 5;
          return res.json({
            success: true,
            message: "Default leave balance retrieved",
            data: {
              id: 0,
              userId: userWithPolicy.id,
              annualLeaves,
              sickLeaves,
              casualLeaves,
              user: {
                id: userWithPolicy.id,
                firstName: userWithPolicy.firstName,
                lastName: userWithPolicy.lastName,
                employeeId: userWithPolicy.employeeId,
                department: userWithPolicy.department,
              },
              leavePolicy: userWithPolicy.leavePolicy || {
                annualLeaves: 21,
                sickLeaves: 10,
                casualLeaves: 5,
              },
            },
          });
        }

        return res.status(404).json({
          success: false,
          message: "Employee leave record not found",
        });
      }

      res.json({
        success: true,
        message: "Employee leave balance retrieved successfully",
        data: employeeLeave,
      });
    } catch (error) {
      console.error("Error fetching employee leave:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employee leave balance",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get all employee leaves (HR and Admin only)
  static async getAllEmployeeLeaves(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10, search = "", department = "" } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      if (search) {
        where.user = {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeId: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      if (department) {
        where.user = {
          ...where.user,
          department: { contains: department, mode: "insensitive" },
        };
      }

      const [employeeLeaves, total] = await Promise.all([
        prisma.employeeLeave.findMany({
          where,
          skip,
          take: limitNum,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: true,
                position: true,
              },
            },
            leavePolicy: {
              select: {
                id: true,
                name: true,
                annualLeaves: true,
                sickLeaves: true,
                casualLeaves: true,
              },
            },
          },
          orderBy: {
            user: { firstName: "asc" },
          },
        }),
        prisma.employeeLeave.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Employee leaves retrieved successfully",
        data: {
          employeeLeaves,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching employee leaves:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employee leaves",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create employee leave record
  static async createEmployeeLeave(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        userId,
        annualLeaves,
        sickLeaves,
        casualLeaves,
        leavePolicyId,
      } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if employee leave already exists
      const existingLeave = await prisma.employeeLeave.findUnique({
        where: { userId },
      });

      if (existingLeave) {
        return res.status(400).json({
          success: false,
          message: "Employee leave record already exists for this user",
        });
      }

      const employeeLeave = await prisma.employeeLeave.create({
        data: {
          userId,
          annualLeaves: parseInt(annualLeaves),
          sickLeaves: parseInt(sickLeaves),
          casualLeaves: parseInt(casualLeaves),
          leavePolicyId,
          datetime: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
            },
          },
          leavePolicy: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "Employee leave record created successfully",
        data: employeeLeave,
      });
    } catch (error: any) {
      console.error("Error creating employee leave:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create employee leave record",
        error: error.message || "Unknown error",
      });
    }
  }

  // Update employee leave balances
  static async updateEmployeeLeave(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        annualLeaves,
        sickLeaves,
        casualLeaves,
        leavePolicyId,
      } = req.body;

      const employeeLeave = await prisma.employeeLeave.findUnique({
        where: { userId },
      });

      if (!employeeLeave) {
        return res.status(404).json({
          success: false,
          message: "Employee leave record not found",
        });
      }

      const updatedEmployeeLeave = await prisma.employeeLeave.update({
        where: { userId },
        data: {
          annualLeaves: parseInt(annualLeaves),
          sickLeaves: parseInt(sickLeaves),
          casualLeaves: parseInt(casualLeaves),
          leavePolicyId,
          datetime: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
            },
          },
          leavePolicy: true,
        },
      });

      res.json({
        success: true,
        message: "Employee leave record updated successfully",
        data: updatedEmployeeLeave,
      });
    } catch (error: any) {
      console.error("Error updating employee leave:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update employee leave record",
        error: error.message || "Unknown error",
      });
    }
  }

  // Initialize employee leave from leave policy
  static async initializeFromPolicy(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, leavePolicyId } = req.body;

      // Get leave policy
      const leavePolicy = await prisma.leavePolicy.findUnique({
        where: { id: leavePolicyId },
      });

      if (!leavePolicy) {
        return res.status(404).json({
          success: false,
          message: "Leave policy not found",
        });
      }

      // Check if employee leave already exists
      const existingLeave = await prisma.employeeLeave.findUnique({
        where: { userId },
      });

      if (existingLeave) {
        return res.status(400).json({
          success: false,
          message: "Employee leave record already exists for this user",
        });
      }

      const employeeLeave = await prisma.employeeLeave.create({
        data: {
          userId,
          annualLeaves: leavePolicy.annualLeaves,
          sickLeaves: leavePolicy.sickLeaves,
          casualLeaves: leavePolicy.casualLeaves,
          leavePolicyId,
          datetime: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
            },
          },
          leavePolicy: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "Employee leave initialized from policy successfully",
        data: employeeLeave,
      });
    } catch (error: any) {
      console.error("Error initializing employee leave:", error);
      res.status(500).json({
        success: false,
        message: "Failed to initialize employee leave",
        error: error.message || "Unknown error",
      });
    }
  }

  // Reset leaves overall, per department, or per employee (HR and Admin only)
  static async resetLeaves(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        scope, // "ALL" | "DEPARTMENTS" | "EMPLOYEES" | "COMBINED"
        departmentIds = [],
        userIds = [],
        resetMode = "POLICY_DEFAULT", // "POLICY_DEFAULT" | "CUSTOM"
        customLeaves = { annualLeaves: 21, sickLeaves: 10, casualLeaves: 5 },
      } = req.body;

      if (!scope || !["ALL", "DEPARTMENTS", "EMPLOYEES", "COMBINED"].includes(scope)) {
        return res.status(400).json({
          success: false,
          message: "Valid scope is required: 'ALL', 'DEPARTMENTS', 'EMPLOYEES', or 'COMBINED'",
        });
      }

      // Build target user filter
      const userWhere: any = {
        isActive: true,
      };

      if (scope === "ALL") {
        // All active employees
      } else if (scope === "DEPARTMENTS") {
        if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: "At least one department must be selected when scope is 'DEPARTMENTS'",
          });
        }
        // Match departmentId or department name
        const depts = await prisma.department.findMany({
          where: {
            OR: [
              { id: { in: departmentIds } },
              { name: { in: departmentIds } },
            ],
          },
          select: { id: true, name: true },
        });
        const validDeptIds = depts.map((d) => d.id);
        const validDeptNames = depts.map((d) => d.name);

        userWhere.OR = [
          { departmentId: { in: validDeptIds.length > 0 ? validDeptIds : departmentIds } },
          { department: { in: validDeptNames.length > 0 ? validDeptNames : departmentIds } },
        ];
      } else if (scope === "EMPLOYEES") {
        if (!Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: "At least one employee must be selected when scope is 'EMPLOYEES'",
          });
        }
        userWhere.id = { in: userIds };
      } else if (scope === "COMBINED") {
        const orConditions: any[] = [];
        if (Array.isArray(userIds) && userIds.length > 0) {
          orConditions.push({ id: { in: userIds } });
        }
        if (Array.isArray(departmentIds) && departmentIds.length > 0) {
          const depts = await prisma.department.findMany({
            where: {
              OR: [
                { id: { in: departmentIds } },
                { name: { in: departmentIds } },
              ],
            },
            select: { id: true, name: true },
          });
          const validDeptIds = depts.map((d) => d.id);
          const validDeptNames = depts.map((d) => d.name);

          orConditions.push({
            departmentId: { in: validDeptIds.length > 0 ? validDeptIds : departmentIds },
          });
          orConditions.push({
            department: { in: validDeptNames.length > 0 ? validDeptNames : departmentIds },
          });
        }

        if (orConditions.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Please select at least one department or employee",
          });
        }
        userWhere.OR = orConditions;
      }

      // Fetch target users
      const targetUsers = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          department: true,
          departmentId: true,
          leaveId: true,
          leavePolicy: true,
        },
      });

      if (targetUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No active employees found matching the selected criteria",
        });
      }

      // Active fallback policy if POLICY_DEFAULT
      let defaultPolicy: any = null;
      if (resetMode === "POLICY_DEFAULT") {
        defaultPolicy = await prisma.leavePolicy.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        });
      }

      const results = [];
      const now = new Date();

      for (const user of targetUsers) {
        let annual = 21;
        let sick = 10;
        let casual = 5;
        const policyId = user.leavePolicy?.id || user.leaveId || defaultPolicy?.id || null;

        if (resetMode === "CUSTOM") {
          annual = parseInt(String(customLeaves?.annualLeaves ?? 21), 10);
          sick = parseInt(String(customLeaves?.sickLeaves ?? 10), 10);
          casual = parseInt(String(customLeaves?.casualLeaves ?? 5), 10);
        } else {
          // POLICY_DEFAULT
          if (user.leavePolicy) {
            annual = user.leavePolicy.annualLeaves;
            sick = user.leavePolicy.sickLeaves;
            casual = user.leavePolicy.casualLeaves;
          } else if (defaultPolicy) {
            annual = defaultPolicy.annualLeaves;
            sick = defaultPolicy.sickLeaves;
            casual = defaultPolicy.casualLeaves;
          }
        }

        const upserted = await prisma.employeeLeave.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            annualLeaves: annual,
            sickLeaves: sick,
            casualLeaves: casual,
            leavePolicyId: policyId,
            datetime: now,
          },
          update: {
            annualLeaves: annual,
            sickLeaves: sick,
            casualLeaves: casual,
            ...(policyId ? { leavePolicyId: policyId } : {}),
            datetime: now,
          },
        });

        results.push({
          userId: user.id,
          employeeId: user.employeeId,
          name: `${user.firstName} ${user.lastName}`,
          department: user.department,
          annualLeaves: upserted.annualLeaves,
          sickLeaves: upserted.sickLeaves,
          casualLeaves: upserted.casualLeaves,
        });
      }

      return res.json({
        success: true,
        message: `Successfully reset leaves for ${results.length} employee(s)`,
        data: {
          count: results.length,
          scope,
          resetMode,
          employees: results,
        },
      });
    } catch (error) {
      console.error("Error resetting employee leaves:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to reset employee leaves",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
