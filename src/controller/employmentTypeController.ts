import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import {
  companyAssignmentInclude,
  resolveActiveCompanyIds,
  respondToCompanyScopeError,
} from "../utils/companyScope";

export class EmploymentTypeController {
  // Get all employment types
  static async getAllEmploymentTypes(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = "", isActive, companyId } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }
      if (companyId) {
        where.companyAssignments = { some: { companyId: companyId as string } };
      }

      const [employmentTypes, total] = await Promise.all([
        prisma.employmentType.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" },
          include: {
            companyAssignments: { include: companyAssignmentInclude },
            _count: {
              select: { users: true },
            },
          },
        }),
        prisma.employmentType.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Employment types retrieved successfully",
        data: {
          employmentTypes,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching employment types:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employment types",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get single employment type by ID
  static async getEmploymentTypeById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employmentType = await prisma.employmentType.findUnique({
        where: { id },
        include: {
          companyAssignments: { include: companyAssignmentInclude },
          _count: {
            select: { users: true },
          },
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
        },
      });

      if (!employmentType) {
        return res.status(404).json({
          success: false,
          message: "Employment type not found",
        });
      }

      res.json({
        success: true,
        message: "Employment type retrieved successfully",
        data: employmentType,
      });
    } catch (error) {
      console.error("Error fetching employment type:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employment type",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new employment type
  static async createEmploymentType(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { name, description, isActive = true, companyIds } = req.body;
      const resolvedCompanyIds = await resolveActiveCompanyIds(companyIds, {
        defaultWhenMissing: true,
      });

      const employmentType = await prisma.employmentType.create({
        data: {
          name,
          description,
          isActive,
          companyAssignments: {
            create: resolvedCompanyIds.map((companyId) => ({ companyId })),
          },
        },
        include: { companyAssignments: { include: companyAssignmentInclude } },
      });

      res.status(201).json({
        success: true,
        message: "Employment type created successfully",
        data: employmentType,
      });
    } catch (error: any) {
      if (respondToCompanyScopeError(error, res)) return;
      console.error("Error creating employment type:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Employment type with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create employment type",
        error: error.message || "Unknown error",
      });
    }
  }

  // Update employment type
  static async updateEmploymentType(req: Request, res: Response) {
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

      const { name, description, isActive, companyIds } = req.body;
      const resolvedCompanyIds =
        companyIds === undefined ? undefined : await resolveActiveCompanyIds(companyIds);

      const employmentType = await prisma.employmentType.findUnique({
        where: { id },
      });

      if (!employmentType) {
        return res.status(404).json({
          success: false,
          message: "Employment type not found",
        });
      }

      const updatedEmploymentType = await prisma.employmentType.update({
        where: { id },
        data: {
          name,
          description,
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
        message: "Employment type updated successfully",
        data: updatedEmploymentType,
      });
    } catch (error: any) {
      if (respondToCompanyScopeError(error, res)) return;
      console.error("Error updating employment type:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Employment type with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update employment type",
        error: error.message || "Unknown error",
      });
    }
  }

  // Delete employment type
  static async deleteEmploymentType(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employmentType = await prisma.employmentType.findUnique({
        where: { id },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!employmentType) {
        return res.status(404).json({
          success: false,
          message: "Employment type not found",
        });
      }

      // Check if employment type has associated users
      if (employmentType._count.users > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete employment type. It has ${employmentType._count.users} user(s) assigned. Please reassign users first.`,
        });
      }

      await prisma.employmentType.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Employment type deleted successfully",
        data: {
          id: employmentType.id,
          name: employmentType.name,
        },
      });
    } catch (error) {
      console.error("Error deleting employment type:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete employment type",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle employment type status
  static async toggleEmploymentTypeStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employmentType = await prisma.employmentType.findUnique({
        where: { id },
      });

      if (!employmentType) {
        return res.status(404).json({
          success: false,
          message: "Employment type not found",
        });
      }

      const updatedEmploymentType = await prisma.employmentType.update({
        where: { id },
        data: {
          isActive: !employmentType.isActive,
        },
      });

      res.json({
        success: true,
        message: `Employment type ${
          updatedEmploymentType.isActive ? "activated" : "deactivated"
        } successfully`,
        data: updatedEmploymentType,
      });
    } catch (error) {
      console.error("Error toggling employment type status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle employment type status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
