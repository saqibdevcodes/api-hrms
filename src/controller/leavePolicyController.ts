import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import {
  companyAssignmentInclude,
  resolveActiveCompanyIds,
  respondToCompanyScopeError,
} from "../utils/companyScope";

export class LeavePolicyController {
  // Get all leave policies
  static async getAllLeavePolicies(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = "", isActive, companyId } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [{ name: { contains: search, mode: "insensitive" } }];
      }

      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }
      if (companyId) {
        where.companyAssignments = { some: { companyId: companyId as string } };
      }

      const [leavePolicies, total] = await Promise.all([
        prisma.leavePolicy.findMany({
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
        prisma.leavePolicy.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Leave policies retrieved successfully",
        data: {
          leavePolicies,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching leave policies:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch leave policies",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get single leave policy by ID
  static async getLeavePolicyById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const leavePolicy = await prisma.leavePolicy.findUnique({
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

      if (!leavePolicy) {
        return res.status(404).json({
          success: false,
          message: "Leave policy not found",
        });
      }

      res.json({
        success: true,
        message: "Leave policy retrieved successfully",
        data: leavePolicy,
      });
    } catch (error) {
      console.error("Error fetching leave policy:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch leave policy",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new leave policy
  static async createLeavePolicy(req: Request, res: Response) {
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
        name,
        annualLeaves,
        sickLeaves,
        casualLeaves,
        isActive = true,
        companyIds,
      } = req.body;
      const resolvedCompanyIds = await resolveActiveCompanyIds(companyIds, {
        defaultWhenMissing: true,
      });

      const leavePolicy = await prisma.leavePolicy.create({
        data: {
          name,
          annualLeaves: parseInt(annualLeaves),
          sickLeaves: parseInt(sickLeaves),
          casualLeaves: parseInt(casualLeaves),
          isActive,
          companyAssignments: {
            create: resolvedCompanyIds.map((companyId) => ({ companyId })),
          },
        },
        include: { companyAssignments: { include: companyAssignmentInclude } },
      });

      res.status(201).json({
        success: true,
        message: "Leave policy created successfully",
        data: leavePolicy,
      });
    } catch (error: any) {
      if (respondToCompanyScopeError(error, res)) return;
      console.error("Error creating leave policy:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Leave policy with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create leave policy",
        error: error.message || "Unknown error",
      });
    }
  }

  // Update leave policy
  static async updateLeavePolicy(req: Request, res: Response) {
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

      const { name, annualLeaves, sickLeaves, casualLeaves, isActive, companyIds } =
        req.body;
      const resolvedCompanyIds =
        companyIds === undefined ? undefined : await resolveActiveCompanyIds(companyIds);

      const leavePolicy = await prisma.leavePolicy.findUnique({
        where: { id },
      });

      if (!leavePolicy) {
        return res.status(404).json({
          success: false,
          message: "Leave policy not found",
        });
      }

      const updatedLeavePolicy = await prisma.leavePolicy.update({
        where: { id },
        data: {
          name,
          annualLeaves: parseInt(annualLeaves),
          sickLeaves: parseInt(sickLeaves),
          casualLeaves: parseInt(casualLeaves),
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
        message: "Leave policy updated successfully",
        data: updatedLeavePolicy,
      });
    } catch (error: any) {
      if (respondToCompanyScopeError(error, res)) return;
      console.error("Error updating leave policy:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Leave policy with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update leave policy",
        error: error.message || "Unknown error",
      });
    }
  }

  // Delete leave policy
  static async deleteLeavePolicy(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const leavePolicy = await prisma.leavePolicy.findUnique({
        where: { id },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!leavePolicy) {
        return res.status(404).json({
          success: false,
          message: "Leave policy not found",
        });
      }

      // Check if leave policy has associated users
      if (leavePolicy._count.users > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete leave policy. It has ${leavePolicy._count.users} user(s) assigned. Please reassign users first.`,
        });
      }

      await prisma.leavePolicy.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Leave policy deleted successfully",
        data: {
          id: leavePolicy.id,
          name: leavePolicy.name,
        },
      });
    } catch (error) {
      console.error("Error deleting leave policy:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete leave policy",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle leave policy status
  static async toggleLeavePolicyStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const leavePolicy = await prisma.leavePolicy.findUnique({
        where: { id },
      });

      if (!leavePolicy) {
        return res.status(404).json({
          success: false,
          message: "Leave policy not found",
        });
      }

      const updatedLeavePolicy = await prisma.leavePolicy.update({
        where: { id },
        data: {
          isActive: !leavePolicy.isActive,
        },
      });

      res.json({
        success: true,
        message: `Leave policy ${
          updatedLeavePolicy.isActive ? "activated" : "deactivated"
        } successfully`,
        data: updatedLeavePolicy,
      });
    } catch (error) {
      console.error("Error toggling leave policy status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle leave policy status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
