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
        limit = 100, // Increased default limit
        search = "",
        department = "",
        status = "",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Build where clause to filter only employees
      const where: any = {
        employeeId: { not: null }, // Only get users with employeeId (employees)
      };

      // Add search filter
      if (search) {
        where.OR = [
          { firstName: { contains: search as string, mode: "insensitive" } },
          { lastName: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { employeeId: { contains: search as string, mode: "insensitive" } },
        ];
      }

      // Add department filter
      if (department) {
        where.departmentId = department as string;
      }

      // Add status filter
      if (status) {
        where.status = status as string;
      }

      // Get employees with proper filtering BEFORE pagination
      const [employees, total] = await Promise.all([
        prisma.user.findMany({
          where,
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
        prisma.user.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Employees retrieved successfully",
        data: {
          employees: employees,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: total,
            pages: Math.ceil(total / Number(limit)),
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
      const insuranceCardFile = files?.insuranceCardFile?.[0];
      const profilePictureFile = files?.profilePictureFile?.[0];

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

        // Insurance fields
        hasInsurance,
        insuranceCardNo,
        insuranceInsuredName,
        insuranceEmployeeNo,
        insuranceValidUpto,
        insuranceSpouseChildren,
        insuranceHospitalization,
        insuranceRoomLimit,
        insuranceNormalDelivery,
        insuranceComplicatedDelivery,
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
                supervisorIds.length > 0
              ) {
                // For line managers with multiple supervisors, get all supervisor emails
                const supervisorsData = await tx.user.findMany({
                  where: { id: { in: supervisorIds } },
                  select: { email: true },
                });
                // Store all emails comma-separated
                return supervisorsData.map((s) => s.email).join(", ");
              } else if (userRank === "EMPLOYEE" && supervisorId) {
                // For employees with single supervisor, use supervisor's email
                const supervisor = await tx.user.findUnique({
                  where: { id: supervisorId },
                  select: { email: true },
                });
                return supervisor?.email || null;
              }
              return manager || null; // Use provided manager or null
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

            // File paths - Cloudinary provides full URLs, local storage uses relative paths
            profilePicture: profilePictureFile
              ? profilePictureFile.path?.startsWith("http")
                ? profilePictureFile.path
                : `/uploads/${profilePictureFile.filename}`
              : null,
            cnicPictureFront: cnicFrontFile
              ? cnicFrontFile.path?.startsWith("http")
                ? cnicFrontFile.path
                : `/uploads/${cnicFrontFile.filename}`
              : null,
            cnicPictureBack: cnicBackFile
              ? cnicBackFile.path?.startsWith("http")
                ? cnicBackFile.path
                : `/uploads/${cnicBackFile.filename}`
              : null,
            degreePicture: documentFile
              ? documentFile.path?.startsWith("http")
                ? documentFile.path
                : `/uploads/${documentFile.filename}`
              : null,
            insuranceCardPicture: insuranceCardFile
              ? insuranceCardFile.path?.startsWith("http")
                ? insuranceCardFile.path
                : `/uploads/${insuranceCardFile.filename}`
              : null,

            // Insurance fields
            hasInsurance: hasInsurance === "true" || hasInsurance === true,
            insuranceCardNo: insuranceCardNo || null,
            insuranceInsuredName: insuranceInsuredName || null,
            insuranceEmployeeNo: insuranceEmployeeNo || null,
            insuranceValidUpto: insuranceValidUpto
              ? new Date(insuranceValidUpto)
              : null,
            insuranceSpouseChildren: insuranceSpouseChildren || null,
            insuranceHospitalization: insuranceHospitalization || null,
            insuranceRoomLimit: insuranceRoomLimit || null,
            insuranceNormalDelivery: insuranceNormalDelivery || null,
            insuranceComplicatedDelivery: insuranceComplicatedDelivery || null,

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

      // Fetch supervisor information if applicable
      let supervisorsList = null;
      let supervisorIdsArray: string[] = [];

      if (
        userRank === "LINE_MANAGER" &&
        supervisorIds &&
        supervisorIds.length > 0
      ) {
        const supervisorsData = await prisma.user.findMany({
          where: { id: { in: supervisorIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        });
        supervisorsList = supervisorsData;
        supervisorIdsArray = supervisorsData.map((s) => s.id);
      } else if (userRank === "EMPLOYEE" && supervisorId) {
        const supervisor = await prisma.user.findUnique({
          where: { id: supervisorId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        });
        if (supervisor) {
          supervisorsList = [supervisor];
          supervisorIdsArray = [supervisor.id];
        }
      }

      res.status(201).json({
        success: true,
        message: "Employee created successfully",
        data: {
          user: {
            ...userWithoutPassword,
            supervisors: supervisorsList,
            supervisorIds: supervisorIdsArray,
          },
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

      // Provide specific error messages based on error type
      let statusCode = 500;
      let errorMessage = "Failed to create employee";
      let errorDetails =
        error instanceof Error ? error.message : "Unknown error";

      // Handle Prisma-specific errors
      if (error.code) {
        switch (error.code) {
          case "P2002":
            // Unique constraint violation
            const field = error.meta?.target?.[0] || "field";
            statusCode = 400;
            errorMessage = `A user with this ${field} already exists`;
            errorDetails = `Duplicate value for ${field}`;
            break;
          case "P2003":
            // Foreign key constraint violation
            statusCode = 400;
            errorMessage = "Invalid reference to related data";
            errorDetails = "One or more selected options are invalid";
            break;
          case "P2025":
            // Record not found
            statusCode = 404;
            errorMessage = "Related record not found";
            errorDetails = error.meta?.cause || "Required data not found";
            break;
          default:
            errorMessage = "Database error occurred";
            errorDetails = error.message;
        }
      }

      // Handle validation errors
      if (error.message?.includes("validation")) {
        statusCode = 400;
        errorMessage = "Validation error";
      }

      // Handle file upload errors
      if (
        error.message?.includes("file") ||
        error.message?.includes("upload")
      ) {
        statusCode = 400;
        errorMessage = "File upload error";
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: errorDetails,
        meta: {
          code: error.code,
          timestamp: new Date().toISOString(),
        },
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

      // Parse manager field to get supervisors
      let supervisorsList = null;
      let supervisorIdsArray: string[] = [];

      if (user.manager) {
        // Manager field contains comma-separated emails for LINE_MANAGERs
        // or single email for EMPLOYEEs
        const managerEmails = user.manager
          .split(",")
          .map((email: string) => email.trim());

        const supervisorsData = await prisma.user.findMany({
          where: { email: { in: managerEmails } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
            department: true,
          },
        });

        supervisorsList = supervisorsData;
        supervisorIdsArray = supervisorsData.map((s) => s.id);
      }

      res.json({
        success: true,
        message: "Employee retrieved successfully",
        data: {
          ...userWithoutPassword,
          supervisors: supervisorsList,
          supervisorIds: supervisorIdsArray,
        },
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
      const insuranceCardFile = files?.insuranceCardFile?.[0];
      const profilePictureFile = files?.profilePictureFile?.[0];

      // Extract relational IDs and file fields from body
      const {
        departmentId,
        contractTypeId,
        designationId,
        shiftId,
        leaveId,
        employmentTypeId,
        supervisorId,
        supervisorIds,
        manager,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactEmail,
        emergencyContactRelation,
        emergencyContactAddress,
        emergencyContactAlternatePhone,
        // Exclude file fields that come through FormData as strings
        profilePictureFile: _profilePictureFile,
        cnicFrontFile: _cnicFrontFile,
        cnicBackFile: _cnicBackFile,
        documentFile: _documentFile,
        insuranceCardFile: _insuranceCardFile,
        ...restData
      } = req.body;

      const updateData: any = { ...restData };

      // Handle file updates
      // File paths - Cloudinary provides full URLs, local storage uses relative paths
      if (profilePictureFile) {
        updateData.profilePicture = profilePictureFile.path?.startsWith("http")
          ? profilePictureFile.path
          : `/uploads/${profilePictureFile.filename}`;
      }
      if (cnicFrontFile) {
        updateData.cnicPictureFront = cnicFrontFile.path?.startsWith("http")
          ? cnicFrontFile.path
          : `/uploads/${cnicFrontFile.filename}`;
      }
      if (cnicBackFile) {
        updateData.cnicPictureBack = cnicBackFile.path?.startsWith("http")
          ? cnicBackFile.path
          : `/uploads/${cnicBackFile.filename}`;
      }
      if (documentFile) {
        updateData.degreePicture = documentFile.path?.startsWith("http")
          ? documentFile.path
          : `/uploads/${documentFile.filename}`;
      }
      if (insuranceCardFile) {
        updateData.insuranceCardPicture = insuranceCardFile.path?.startsWith(
          "http"
        )
          ? insuranceCardFile.path
          : `/uploads/${insuranceCardFile.filename}`;
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
      if (updateData.insuranceValidUpto) {
        updateData.insuranceValidUpto = new Date(updateData.insuranceValidUpto);
      }

      // Convert hasInsurance string to boolean
      if (updateData.hasInsurance !== undefined) {
        updateData.hasInsurance =
          updateData.hasInsurance === "true" ||
          updateData.hasInsurance === true;
      }

      // Hash password if provided
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      } else {
        // Remove password field if not provided (don't update it)
        delete updateData.password;
      }

      // Handle relational updates using connect syntax
      if (departmentId) {
        updateData.departmentEntity = { connect: { id: departmentId } };
        // Also update the department name field
        const dept = await prisma.department.findUnique({
          where: { id: departmentId },
        });
        if (dept) {
          updateData.department = dept.name;
        }
      }

      if (contractTypeId) {
        updateData.contractType = { connect: { id: contractTypeId } };
      }

      if (designationId) {
        updateData.designation = { connect: { id: designationId } };
      }

      if (shiftId) {
        updateData.shift = { connect: { id: shiftId } };
      }

      if (leaveId) {
        updateData.leavePolicy = { connect: { id: leaveId } };
      }

      if (employmentTypeId) {
        updateData.employmentType = { connect: { id: employmentTypeId } };
      }

      // Handle supervisor updates based on rank
      let supervisorsList = null;

      if (
        updateData.userRank === "LINE_MANAGER" &&
        supervisorIds &&
        // Array.isArray(supervisorIds)
        supervisorIds.length > 0
      ) {
        // For line managers with multiple supervisors
        // Fetch all supervisors to get their emails
        const supervisorsData = await prisma.user.findMany({
          where: { id: { in: supervisorIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        });

        supervisorsList = supervisorsData;

        // Store all supervisor emails comma-separated
        const supervisorEmails = supervisorsData.map((s) => s.email).join(", ");
        updateData.manager = supervisorEmails;
      } else if (updateData.userRank === "EMPLOYEE" && supervisorId) {
        // For employees with single supervisor
        const supervisor = await prisma.user.findUnique({
          where: { id: supervisorId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        });

        if (supervisor) {
          updateData.manager = supervisor.email;
          supervisorsList = [supervisor];
        }
      }

      // Handle emergency contact updates
      if (emergencyContactName || emergencyContactPhone) {
        if (existingUser.emergencyDetailId) {
          // Update existing emergency detail
          await prisma.emergencyDetail.update({
            where: { id: existingUser.emergencyDetailId },
            data: {
              contactName: emergencyContactName || undefined,
              contactPhone: emergencyContactPhone || undefined,
              contactEmail: emergencyContactEmail || null,
              relationship: emergencyContactRelation || undefined,
              contactAddress: emergencyContactAddress || null,
              alternatePhone: emergencyContactAlternatePhone || null,
            },
          });
        } else {
          // Create new emergency detail
          const emergencyDetail = await prisma.emergencyDetail.create({
            data: {
              contactName: emergencyContactName,
              contactPhone: emergencyContactPhone,
              contactEmail: emergencyContactEmail || null,
              relationship: emergencyContactRelation || "Emergency Contact",
              contactAddress: emergencyContactAddress || null,
              alternatePhone: emergencyContactAlternatePhone || null,
            },
          });
          updateData.emergencyDetailId = emergencyDetail.id;
        }
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
        data: {
          ...userWithoutPassword,
          supervisors: supervisorsList,
          supervisorIds: supervisorsList
            ? supervisorsList.map((s: any) => s.id)
            : [],
        },
      });
    } catch (error: any) {
      console.error("Error updating employee:", error);

      // Provide specific error messages based on error type
      let statusCode = 500;
      let errorMessage = "Failed to update employee";
      let errorDetails =
        error instanceof Error ? error.message : "Unknown error";

      // Handle Prisma-specific errors
      if (error.code) {
        switch (error.code) {
          case "P2002":
            // Unique constraint violation
            const field = error.meta?.target?.[0] || "field";
            statusCode = 400;
            errorMessage = `Another user with this ${field} already exists`;
            errorDetails = `Duplicate value for ${field}`;
            break;
          case "P2003":
            // Foreign key constraint violation
            statusCode = 400;
            errorMessage = "Invalid reference to related data";
            errorDetails = "One or more selected options are invalid";
            break;
          case "P2025":
            // Record not found
            statusCode = 404;
            errorMessage = "Employee not found";
            errorDetails =
              error.meta?.cause ||
              "The employee you're trying to update doesn't exist";
            break;
          default:
            errorMessage = "Database error occurred";
            errorDetails = error.message;
        }
      }

      // Handle validation errors
      if (error.message?.includes("validation")) {
        statusCode = 400;
        errorMessage = "Validation error";
      }

      // Handle file upload errors
      if (
        error.message?.includes("file") ||
        error.message?.includes("upload")
      ) {
        statusCode = 400;
        errorMessage = "File upload error";
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: errorDetails,
        meta: {
          code: error.code,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Toggle employee status (ACTIVE <-> INACTIVE)
  static async toggleEmployeeStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Find the employee
      const employee = await prisma.user.findUnique({
        where: { id },
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      // Toggle status
      const newStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

      // Update employee status
      const updatedEmployee = await prisma.user.update({
        where: { id },
        data: {
          status: newStatus,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Employee status changed to ${newStatus}`,
        data: {
          employee: updatedEmployee,
        },
      });
    } catch (error: any) {
      console.error("Error toggling employee status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to toggle employee status",
        error: {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        },
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
