import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export class DesignationController {
  // Get all designations
  static async getAllDesignations(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        isActive,
        department,
      } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      // Add search filter
      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
          { department: { contains: search as string, mode: "insensitive" } },
        ];
      }

      // Add active filter
      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      // Add department filter
      if (department) {
        where.department = {
          contains: department as string,
          mode: "insensitive",
        };
      }

      const [designations, total] = await Promise.all([
        prisma.designation.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: [{ level: "asc" }, { createdAt: "desc" }],
          include: {
            _count: {
              select: { users: true },
            },
          },
        }),
        prisma.designation.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Designations retrieved successfully",
        data: {
          designations,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalRecords: total,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching designations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch designations",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get designation by ID
  static async getDesignationById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const designation = await prisma.designation.findUnique({
        where: { id },
        include: {
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

      if (!designation) {
        return res.status(404).json({
          success: false,
          message: "Designation not found",
        });
      }

      res.json({
        success: true,
        message: "Designation retrieved successfully",
        data: { designation },
      });
    } catch (error) {
      console.error("Error fetching designation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch designation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new designation
  static async createDesignation(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { title, description, level, department } = req.body;

      // Check if designation title already exists
      const existingDesignation = await prisma.designation.findUnique({
        where: { title },
      });

      if (existingDesignation) {
        return res.status(400).json({
          success: false,
          message: "Designation with this title already exists",
        });
      }

      const designation = await prisma.designation.create({
        data: {
          title,
          description,
          level: level ? parseInt(level) : null,
          department,
        },
      });

      res.status(201).json({
        success: true,
        message: "Designation created successfully",
        data: { designation },
      });
    } catch (error) {
      console.error("Error creating designation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create designation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update designation
  static async updateDesignation(req: Request, res: Response) {
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
      const { title, description, level, department, isActive } = req.body;

      // Check if designation exists
      const existingDesignation = await prisma.designation.findUnique({
        where: { id },
      });

      if (!existingDesignation) {
        return res.status(404).json({
          success: false,
          message: "Designation not found",
        });
      }

      // Check if new title conflicts with existing designation
      if (title && title !== existingDesignation.title) {
        const titleConflict = await prisma.designation.findUnique({
          where: { title },
        });

        if (titleConflict) {
          return res.status(400).json({
            success: false,
            message: "Designation with this title already exists",
          });
        }
      }

      const designation = await prisma.designation.update({
        where: { id },
        data: {
          title,
          description,
          level: level ? parseInt(level) : null,
          department,
          isActive,
        },
      });

      res.json({
        success: true,
        message: "Designation updated successfully",
        data: { designation },
      });
    } catch (error) {
      console.error("Error updating designation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update designation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Delete designation
  static async deleteDesignation(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if designation exists
      const designation = await prisma.designation.findUnique({
        where: { id },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!designation) {
        return res.status(404).json({
          success: false,
          message: "Designation not found",
        });
      }

      // Check if designation has users
      if (designation._count.users > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete designation. It has ${designation._count.users} user(s) assigned. Please reassign users first.`,
        });
      }

      await prisma.designation.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Designation deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting designation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete designation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle designation status
  static async toggleDesignationStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const designation = await prisma.designation.findUnique({
        where: { id },
      });

      if (!designation) {
        return res.status(404).json({
          success: false,
          message: "Designation not found",
        });
      }

      const updatedDesignation = await prisma.designation.update({
        where: { id },
        data: {
          isActive: !designation.isActive,
        },
      });

      res.json({
        success: true,
        message: `Designation ${
          updatedDesignation.isActive ? "activated" : "deactivated"
        } successfully`,
        data: { designation: updatedDesignation },
      });
    } catch (error) {
      console.error("Error toggling designation status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle designation status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get all departments for filter dropdown
  static async getDepartments(req: Request, res: Response) {
    try {
      const departments = await prisma.designation.findMany({
        select: {
          department: true,
        },
        where: {
          department: { not: null },
          isActive: true,
        },
        distinct: ["department"],
      });

      const uniqueDepartments = departments
        .map((d) => d.department)
        .filter(Boolean)
        .sort();

      res.json({
        success: true,
        message: "Departments retrieved successfully",
        data: { departments: uniqueDepartments },
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
}
