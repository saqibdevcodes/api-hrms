import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export class ShiftController {
  // Get all shifts
  static async getAllShifts(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = "", isActive } = req.query;

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

      const [shifts, total] = await Promise.all([
        prisma.shift.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { users: true },
            },
          },
        }),
        prisma.shift.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Shifts retrieved successfully",
        data: {
          shifts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch shifts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get single shift by ID
  static async getShiftById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const shift = await prisma.shift.findUnique({
        where: { id },
        include: {
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

      if (!shift) {
        return res.status(404).json({
          success: false,
          message: "Shift not found",
        });
      }

      res.json({
        success: true,
        message: "Shift retrieved successfully",
        data: shift,
      });
    } catch (error) {
      console.error("Error fetching shift:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch shift",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new shift
  static async createShift(req: Request, res: Response) {
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
        startTime,
        endTime,
        earlyOut,
        halfDayStart,
        fullDayStart,
        breakTime,
        isActive = true,
      } = req.body;

      const shift = await prisma.shift.create({
        data: {
          name,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          earlyOut: new Date(earlyOut),
          halfDayStart: new Date(halfDayStart),
          fullDayStart: new Date(fullDayStart),
          breakTime: breakTime ? parseInt(breakTime) : null,
          isActive,
        },
      });

      res.status(201).json({
        success: true,
        message: "Shift created successfully",
        data: shift,
      });
    } catch (error: any) {
      console.error("Error creating shift:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Shift with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create shift",
        error: error.message || "Unknown error",
      });
    }
  }

  // Update shift
  static async updateShift(req: Request, res: Response) {
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

      const {
        name,
        startTime,
        endTime,
        earlyOut,
        halfDayStart,
        fullDayStart,
        breakTime,
        isActive,
      } = req.body;

      const shift = await prisma.shift.findUnique({
        where: { id },
      });

      if (!shift) {
        return res.status(404).json({
          success: false,
          message: "Shift not found",
        });
      }

      const updatedShift = await prisma.shift.update({
        where: { id },
        data: {
          name,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          earlyOut: new Date(earlyOut),
          halfDayStart: new Date(halfDayStart),
          fullDayStart: new Date(fullDayStart),
          breakTime: breakTime ? parseInt(breakTime) : null,
          isActive,
        },
      });

      res.json({
        success: true,
        message: "Shift updated successfully",
        data: updatedShift,
      });
    } catch (error: any) {
      console.error("Error updating shift:", error);

      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Shift with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update shift",
        error: error.message || "Unknown error",
      });
    }
  }

  // Delete shift
  static async deleteShift(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const shift = await prisma.shift.findUnique({
        where: { id },
        include: {
          _count: {
            select: { users: true },
          },
        },
      });

      if (!shift) {
        return res.status(404).json({
          success: false,
          message: "Shift not found",
        });
      }

      // Check if shift has associated users
      if (shift._count.users > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete shift. It has ${shift._count.users} user(s) assigned. Please reassign users first.`,
        });
      }

      await prisma.shift.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Shift deleted successfully",
        data: {
          id: shift.id,
          name: shift.name,
        },
      });
    } catch (error) {
      console.error("Error deleting shift:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete shift",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle shift status
  static async toggleShiftStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const shift = await prisma.shift.findUnique({
        where: { id },
      });

      if (!shift) {
        return res.status(404).json({
          success: false,
          message: "Shift not found",
        });
      }

      const updatedShift = await prisma.shift.update({
        where: { id },
        data: {
          isActive: !shift.isActive,
        },
      });

      res.json({
        success: true,
        message: `Shift ${
          updatedShift.isActive ? "activated" : "deactivated"
        } successfully`,
        data: updatedShift,
      });
    } catch (error) {
      console.error("Error toggling shift status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle shift status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
