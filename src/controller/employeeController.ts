import { Request, Response } from "express";
import { validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../generated/prisma";
import { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();

export class EmployeeController {
  // Get form dropdown data
  static async getFormData(req: Request, res: Response) {
    try {
      const [
        departments,
        designations,
        contractTypes,
        shifts,
        leavePolicies,
        employmentTypes,
      ] = await Promise.all([
        prisma.department.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.designation.findMany({
          where: { isActive: true },
          orderBy: [{ level: "asc" }, { title: "asc" }],
        }),
        prisma.contractType.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.shift.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.leavePolicy.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.employmentType.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
      ]);

      res.json({
        success: true,
        message: "Form data retrieved successfully",
        data: {
          departments,
          designations,
          contractTypes,
          shifts,
          leavePolicies,
          employmentTypes,
        },
      });
    } catch (error) {
      console.error("Error fetching form data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch form data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get all employees (HR and Admin only)
  static async getAllEmployees(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        department = "",
        status = "",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Get all users, then filter for employees on the application side for now
      const [allUsers, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take,
          include: {
            departmentEntity: true,
            designation: true,
            employmentType: true,
            emergencyDetail: true,
          },
          orderBy: {
            [sortBy as string]: sortOrder,
          },
        }),
        prisma.user.count(),
      ]);

      // Filter for employees (users with employeeId)
      const employees = allUsers.filter((user) => user.employeeId !== null);

      res.json({
        success: true,
        message: "Employees retrieved successfully",
        data: {
          employees: employees,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: employees.length,
            pages: Math.ceil(employees.length / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employees",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new employee
  static async createEmployee(req: AuthenticatedRequest, res: Response) {
    try {
      // Log the received data for debugging
      console.log("Received body:", req.body);
      console.log("Received files:", req.files);

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
          meta: { timestamp: new Date().toISOString() },
        });
      }

      // Handle uploaded files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const cnicFrontFile = files?.cnicFrontFile?.[0];
      const cnicBackFile = files?.cnicBackFile?.[0];
      const documentFile = files?.documentFile?.[0];

      const {
        // User fields
        firstName,
        lastName,
        email,
        fatherHusbandName,
        cnic,
        cnicExpiry,
        maritalStatus,
        dateOfBirth,
        bloodGroup,
        education,
        educationInstitute,
        educationGrade,
        personalEmail,
        personalMobile,
        officialMobile,
        officialEmail,
        userRank,
        password,
        role,
        personalAddress,
        dateOfJoining,
        dateOfExit,
        departmentId,
        contractTypeId,
        designationId,
        shiftId,
        leaveId,
        employmentTypeId,
        employeeId, // New field for employee ID

        // Employee specific fields
        position,
        department,
        manager,
        salary,
        currency = "PKR",
        phone,
        gender,
        address,
        city,
        state,
        zipCode,
        country = "Pakistan",
        employmentType,
        supervisorId, // For single supervisor (employees)
        supervisorIds, // For multiple supervisors (line managers)

        // Emergency contact
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactEmail,
        emergencyContactRelation,
        emergencyContactAddress,
        emergencyContactAlternatePhone,
      } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { cnic: cnic || undefined }],
        },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email or CNIC already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create emergency detail if provided
      let emergencyDetail = null;
      if (emergencyContactName && emergencyContactPhone) {
        emergencyDetail = await prisma.emergencyDetail.create({
          data: {
            contactName: emergencyContactName,
            contactPhone: emergencyContactPhone,
            contactEmail: emergencyContactEmail || null,
            relationship: emergencyContactRelation || "Emergency Contact",
            contactAddress: emergencyContactAddress || null,
            alternatePhone: emergencyContactAlternatePhone || null,
          },
        });
      }

      // Generate employee ID
      const departmentCode = await prisma.department.findUnique({
        where: { id: departmentId },
      });

      const deptPrefix = departmentCode?.name
        ? departmentCode.name.substring(0, 3).toUpperCase()
        : "GEN";

      // Ensure uniqueness with timestamp if collision occurs

      // Create user in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user with all employee data
        const user = await tx.user.create({
          data: {
            // Basic info
            email,
            firstName,
            lastName,
            fatherHusbandName,
            cnic,
            cnicExpiry: cnicExpiry ? new Date(cnicExpiry) : null,
            maritalStatus,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            bloodGroup,
            gender,

            // Education
            education,
            educationInstitute,
            educationGrade,

            // Contact
            personalEmail,
            personalMobile,
            officialMobile,
            officialEmail,
            phone,

            // Address
            personalAddress,
            address,
            city,
            state,
            zipCode,
            country,

            // Employment
            employeeId,
            userRank,
            password: hashedPassword,
            role,
            position,
            department: department || departmentCode?.name || "Unknown",
            manager: await (async () => {
              // Handle supervisor based on rank
              if (
                userRank === "LINE_MANAGER" &&
                supervisorIds &&
                Array.isArray(supervisorIds)
              ) {
                // For line managers with multiple supervisors, store as JSON
                const supervisors = await tx.user.findMany({
                  where: { id: { in: supervisorIds } },
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                });
                return JSON.stringify(supervisors);
              } else if (userRank === "EMPLOYEE" && supervisorId) {
                // For employees with single supervisor
                const supervisor = await tx.user.findUnique({
                  where: { id: supervisorId },
                  select: { firstName: true, lastName: true, email: true },
                });
                return supervisor
                  ? `${supervisor.firstName} ${supervisor.lastName}`
                  : manager;
              }
              return manager; // Default manager field value
            })(),
            salary: salary ? parseFloat(salary) : null,
            currency,
            dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
            dateOfExit: dateOfExit ? new Date(dateOfExit) : null,
            hireDate: dateOfJoining ? new Date(dateOfJoining) : new Date(),
            endDate: dateOfExit ? new Date(dateOfExit) : null,
            employmentTypeId,

            // Emergency contact

            emergencyDetailId: emergencyDetail?.id,

            // Relations
            departmentId,
            contractTypeId,
            designationId,
            shiftId,
            leaveId,

            // File paths
            cnicPictureFront: cnicFrontFile?.filename
              ? `/uploads/${cnicFrontFile.filename}`
              : null,
            cnicPictureBack: cnicBackFile?.filename
              ? `/uploads/${cnicBackFile.filename}`
              : null,
            degreePicture: documentFile?.filename
              ? `/uploads/${documentFile.filename}`
              : null,

            // System fields
            createdBy: req.user?.id,
            updatedBy: req.user?.id,
          },
        });

        // Create EmployeeLeave record if leaveId is provided
        let employeeLeave = null;
        if (leaveId) {
          const leavePolicy = await tx.leavePolicy.findUnique({
            where: { id: leaveId },
          });

          if (leavePolicy) {
            employeeLeave = await tx.employeeLeave.create({
              data: {
                userId: user.id,
                annualLeaves: leavePolicy.annualLeaves,
                sickLeaves: leavePolicy.sickLeaves,
                casualLeaves: leavePolicy.casualLeaves,
                compensatoryLeaves: 0,
                maternityLeaves: leavePolicy.maternityLeaves,
                paternityLeaves: leavePolicy.paternityLeaves,
                leavePolicyId: leavePolicy.id,
                datetime: new Date(),
              },
            });
          }
        }

        return { user, employeeLeave };
      });

      // Return success with created data (excluding password)
      const { password: _, ...userWithoutPassword } = result.user;

      res.status(201).json({
        success: true,
        message: "Employee created successfully",
        data: {
          user: userWithoutPassword,
          employeeLeave: result.employeeLeave,
          emergencyDetail,
          files: {
            cnicFront: cnicFrontFile?.filename || null,
            cnicBack: cnicBackFile?.filename || null,
            document: documentFile?.filename || null,
          },
        },
      });
    } catch (error: any) {
      console.error("Error creating employee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create employee",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get single employee by ID
  static async getEmployeeById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          departmentEntity: true,
          designation: true,
          contractType: true,
          shift: true,
          leavePolicy: true,
          employmentType: true,
          emergencyDetail: true,
        },
      });

      if (!user || !user.employeeId) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // Exclude password from response
      const { password, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: "Employee retrieved successfully",
        data: userWithoutPassword,
      });
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employee",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update employee
  static async updateEmployee(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      // Check if user exists and is an employee
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser || !existingUser.employeeId) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // Handle uploaded files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const cnicFrontFile = files?.cnicFrontFile?.[0];
      const cnicBackFile = files?.cnicBackFile?.[0];
      const documentFile = files?.documentFile?.[0];

      const updateData: any = { ...req.body };

      // Handle file updates
      if (cnicFrontFile) {
        updateData.cnicPictureFront = `/uploads/${cnicFrontFile.filename}`;
      }
      if (cnicBackFile) {
        updateData.cnicPictureBack = `/uploads/${cnicBackFile.filename}`;
      }
      if (documentFile) {
        updateData.degreePicture = `/uploads/${documentFile.filename}`;
      }

      // Convert date strings to Date objects
      if (updateData.dateOfBirth) {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }
      if (updateData.cnicExpiry) {
        updateData.cnicExpiry = new Date(updateData.cnicExpiry);
      }
      if (updateData.dateOfJoining) {
        updateData.dateOfJoining = new Date(updateData.dateOfJoining);
        updateData.hireDate = updateData.dateOfJoining; // Keep both in sync
      }
      if (updateData.dateOfExit) {
        updateData.dateOfExit = new Date(updateData.dateOfExit);
        updateData.endDate = updateData.dateOfExit; // Keep both in sync
      }

      // Hash password if provided
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      updateData.updatedBy = req.user?.id;

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          departmentEntity: true,
          designation: true,
          contractType: true,
          shift: true,
          leavePolicy: true,
          employmentType: true,
          emergencyDetail: true,
        },
      });

      // Exclude password from response
      const { password, ...userWithoutPassword } = updatedUser;

      res.json({
        success: true,
        message: "Employee updated successfully",
        data: userWithoutPassword,
      });
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update employee",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Delete employee
  static async deleteEmployee(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // First, fetch the employee with all related data to get file paths
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          emergencyDetail: true,
        },
      });

      if (!user || !user.employeeId) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // Collect file paths for cleanup
      const filePaths: string[] = [];
      if (user.cnicPictureFront) filePaths.push(user.cnicPictureFront);
      if (user.cnicPictureBack) filePaths.push(user.cnicPictureBack);
      if (user.degreePicture) filePaths.push(user.degreePicture);

      // Get related record counts
      const relatedCounts = {
        attendances: await prisma.attendance.count({
          where: { employeeId: id },
        }),
        leaveRequests: await prisma.leaveRequest.count({
          where: { employeeId: id },
        }),
        payrollRecords: await prisma.payrollRecord.count({
          where: { employeeId: id },
        }),
        performanceReviews: await prisma.performanceReview.count({
          where: { employeeId: id },
        }),
      };

      // Delete in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete related records
        await tx.attendance.deleteMany({ where: { employeeId: id } });
        await tx.leaveRequest.deleteMany({ where: { employeeId: id } });
        await tx.payrollRecord.deleteMany({ where: { employeeId: id } });
        await tx.performanceReview.deleteMany({ where: { employeeId: id } });

        // Delete emergency detail if exists
        if (user.emergencyDetailId) {
          await tx.emergencyDetail.delete({
            where: { id: user.emergencyDetailId },
          });
        }

        // Delete the user
        const deletedUser = await tx.user.delete({
          where: { id },
        });

        return { deletedUser };
      });

      // Clean up files after successful database deletion
      let deletedFiles = 0;
      for (const filePath of filePaths) {
        try {
          const fullPath = path.join(process.cwd(), filePath);
          await fs.promises.unlink(fullPath);
          deletedFiles++;
        } catch (fileError) {
          console.warn(`Failed to delete file ${filePath}:`, fileError);
        }
      }

      res.json({
        success: true,
        message: "Employee and all related data deleted successfully",
        data: {
          deletedEmployee: {
            id: result.deletedUser.id,
            employeeId: result.deletedUser.employeeId,
            name: `${result.deletedUser.firstName} ${result.deletedUser.lastName}`,
            email: result.deletedUser.email,
          },
          deletedRecords: relatedCounts,
          deletedFiles,
        },
      });
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete employee",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get designations by department
  static async getDesignationsByDepartment(req: Request, res: Response) {
    try {
      const { departmentName } = req.query;
      if (!departmentName) {
        return res
          .status(400)
          .json({ success: false, message: "Department name is required" });
      }
      const designations = await prisma.designation.findMany({
        where: { department: departmentName as string, isActive: true },
        orderBy: [{ level: "asc" }, { title: "asc" }],
      });
      res.json({
        success: true,
        message: "Designations retrieved successfully",
        data: { designations },
      });
    } catch (error) {
      console.error("Error fetching designations by department:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch designations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get supervisors based on rank
  static async getSupervisorsByRank(req: Request, res: Response) {
    try {
      const { rank } = req.query;

      if (!rank) {
        return res.status(400).json({
          success: false,
          message: "Rank is required",
        });
      }

      let supervisors: any[] = [];

      if (rank === "LINE_MANAGER") {
        // Fetch all directors for line managers to report to
        supervisors = await prisma.user.findMany({
          where: {
            userRank: "DIRECTOR_LEVEL",
            isActive: true,
            employeeId: { not: null },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            department: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });
      } else if (rank === "EMPLOYEE") {
        // Fetch all line managers for employees to report to
        supervisors = await prisma.user.findMany({
          where: {
            userRank: "LINE_MANAGER",
            isActive: true,
            employeeId: { not: null },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            department: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });
      }

      // Format the response to match the expected frontend structure
      const formattedSupervisors = supervisors.map((supervisor) => ({
        ...supervisor,
        employee: {
          employeeId: supervisor.employeeId,
          department: supervisor.department,
        },
      }));

      res.json({
        success: true,
        message: "Supervisors retrieved successfully",
        data: { supervisors: formattedSupervisors },
      });
    } catch (error) {
      console.error("Error fetching supervisors by rank:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch supervisors",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
