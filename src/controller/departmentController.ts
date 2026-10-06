import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import {
  companyAssignmentInclude,
  resolveActiveCompanyIds,
  respondToCompanyScopeError,
} from "../utils/companyScope";

export class DepartmentController {
  // Get all departments
  static async getAllDepartments(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = "", isActive, companyId } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);


      const rawLimit = parseInt(limit as string) || 10;
const isUnlimited = rawLimit === -1;
const take = isUnlimited ? undefined : rawLimit;
const skip = isUnlimited ? undefined : (pageNum - 1) * rawLimit;

      const where: any = {};

      // Add search filter
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ];
      }

      // Add active filter
      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }
      if (companyId) {
        where.companyAssignments = { some: { companyId: companyId as string } };
      }

      const [departments, total] = await Promise.all([
        prisma.department.findMany({
          where,
          ...(skip !== undefined && { skip }),
          ...(take !== undefined && { take }),
          orderBy: { createdAt: "desc" },
          include: {
            companyAssignments: { include: companyAssignmentInclude },
            _count: {
              select: { users: true },
            },
          },
        }),
        prisma.department.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Departments retrieved successfully",
        data: {
          departments,
          pagination: {
            currentPage: isUnlimited ? 1 : pageNum,
            totalPages: isUnlimited ? 1 : Math.ceil(total / rawLimit),
            totalRecords: total,
            limit: isUnlimited ? total : rawLimit,
          }
        },
      });
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch departments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get department by ID
  static async getDepartmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          companyAssignments: { include: companyAssignmentInclude },
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              position: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      });

      if (!department) {
        return res.status(404).json({
          success: false,
          message: "Department not found",
        });
      }

      res.json({
        success: true,
        message: "Department retrieved successfully",
        data: { department },
      });
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch department",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new department
  static async createDepartment(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { name, description, manager, companyIds } = req.body;
      const resolvedCompanyIds = await resolveActiveCompanyIds(companyIds, {
        defaultWhenMissing: true,
      });

      // Check if department name already exists
      const existingDepartment = await prisma.department.findUnique({
        where: { name },
      });

      if (existingDepartment) {
        return res.status(400).json({
          success: false,
          message: "Department with this name already exists",
        });
      }

      const department = await prisma.department.create({
        data: {
          name,
          description,
          manager,
          companyAssignments: {
            create: resolvedCompanyIds.map((companyId) => ({ companyId })),
          },
        },
        include: { companyAssignments: { include: companyAssignmentInclude } },
      });

      res.status(201).json({
        success: true,
        message: "Department created successfully",
        data: { department },
      });
    } catch (error) {
      if (respondToCompanyScopeError(error, res)) return;
      console.error("Error creating department:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create department",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update department
  static async updateDepartment(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { name, description, manager, isActive, companyIds } = req.body;
      const resolvedCompanyIds =
        companyIds === undefined ? undefined : await resolveActiveCompanyIds(companyIds);

      // Check if department exists
      const existingDepartment = await prisma.department.findUnique({
        where: { id },
      });

      if (!existingDepartment) {
        return res.status(404).json({
          success: false,
          message: "Department not found",
        });
      }

      // Check if new name conflicts with existing department
      if (name && name !== existingDepartment.name) {
        const nameConflict = await prisma.department.findUnique({
          where: { name },
        });

        if (nameConflict) {
          return res.status(400).json({
            success: false,
            message: "Department with this name already exists",
          });
        }
      }

      const department = await prisma.department.update({
        where: { id },
        data: {
          name,
          description,
          manager,
          isActive,
          ...(resolvedCompanyIds && {
            companyAssignments: {
              deleteMany: {},
              create: resolvedCompanyIds.map((companyId) => ({ companyId })),
            },
          }),
        },
        include: { companyAssignments: { include: companyAssignmentInclude } },
      });

      res.json({
        success: true,
        message: "Department updated successfully",
        data: { department },
      });
    } catch (error) {
      if (respondToCompanyScopeError(error, res)) return;
      console.error("Error updating department:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update department",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Delete department
  static async deleteDepartment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if department exists
      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!department) {
        return res.status(404).json({
          success: false,
          message: "Department not found",
        });
      }

      // Check if department has users
      if (department._count.users > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete department. It has ${department._count.users} user(s) assigned. Please reassign users first.`,
        });
      }

      await prisma.department.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Department deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete department",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle department status
  static async toggleDepartmentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const department = await prisma.department.findUnique({
        where: { id },
      });

      if (!department) {
        return res.status(404).json({
          success: false,
          message: "Department not found",
        });
      }

      const updatedDepartment = await prisma.department.update({
        where: { id },
        data: {
          isActive: !department.isActive,
        },
      });

      res.json({
        success: true,
        message: `Department ${
          updatedDepartment.isActive ? "activated" : "deactivated"
        } successfully`,
        data: { department: updatedDepartment },
      });
    } catch (error) {
      console.error("Error toggling department status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle department status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
