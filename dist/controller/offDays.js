"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffDayController = void 0;
const express_validator_1 = require("express-validator");
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class OffDayController {
    static async getAllOffDays(req, res) {
        try {
            const { page = 1, limit = 10, search = "" } = req.query;
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const searchTerm = search;
            const skip = (pageNum - 1) * limitNum;
            const where = searchTerm
                ? {
                    OR: [
                        { reason: { contains: searchTerm, mode: "insensitive" } },
                        { date: { gte: new Date(searchTerm) } },
                    ],
                }
                : {};
            const [offDays, total] = await Promise.all([
                prisma.offDay.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { date: "desc" },
                }),
                prisma.offDay.count({ where }),
            ]);
            const totalPages = Math.ceil(total / limitNum);
            res.json({
                success: true,
                data: offDays,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages,
                },
            });
        }
        catch (error) {
            console.error("Error fetching off days:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
    static async getOffDayById(req, res) {
        try {
            const { id } = req.params;
            const offDay = await prisma.offDay.findUnique({
                where: { id },
            });
            if (!offDay) {
                return res.status(404).json({
                    success: false,
                    message: "Off day not found",
                });
            }
            res.json({
                success: true,
                data: offDay,
            });
        }
        catch (error) {
            console.error("Error fetching off day:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
    static async createOffDay(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation error",
                    errors: errors.array(),
                });
            }
            const { date, reason } = req.body;
            // Check if off day already exists for the given date
            const existingOffDay = await prisma.offDay.findFirst({
                where: {
                    date: new Date(date),
                },
            });
            if (existingOffDay) {
                return res.status(400).json({
                    success: false,
                    message: "Off day already exists for this date",
                });
            }
            const offDay = await prisma.offDay.create({
                data: {
                    date: new Date(date),
                    reason,
                },
            });
            res.status(201).json({
                success: true,
                message: "Off day created successfully",
                data: offDay,
            });
        }
        catch (error) {
            console.error("Error creating off day:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
    static async updateOffDay(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation error",
                    errors: errors.array(),
                });
            }
            const { id } = req.params;
            const { date, reason } = req.body;
            // Check if off day exists
            const existingOffDay = await prisma.offDay.findUnique({
                where: { id },
            });
            if (!existingOffDay) {
                return res.status(404).json({
                    success: false,
                    message: "Off day not found",
                });
            }
            // Check if another off day already exists for the new date (if date is being changed)
            if (date && date !== existingOffDay.date.toISOString().split("T")[0]) {
                const duplicateOffDay = await prisma.offDay.findFirst({
                    where: {
                        date: new Date(date),
                        id: { not: id },
                    },
                });
                if (duplicateOffDay) {
                    return res.status(400).json({
                        success: false,
                        message: "Off day already exists for this date",
                    });
                }
            }
            const updateData = {};
            if (date)
                updateData.date = new Date(date);
            if (reason)
                updateData.reason = reason;
            const offDay = await prisma.offDay.update({
                where: { id },
                data: updateData,
            });
            res.json({
                success: true,
                message: "Off day updated successfully",
                data: offDay,
            });
        }
        catch (error) {
            console.error("Error updating off day:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
    static async deleteOffDay(req, res) {
        try {
            const { id } = req.params;
            // Check if off day exists
            const existingOffDay = await prisma.offDay.findUnique({
                where: { id },
            });
            if (!existingOffDay) {
                return res.status(404).json({
                    success: false,
                    message: "Off day not found",
                });
            }
            await prisma.offDay.delete({
                where: { id },
            });
            res.json({
                success: true,
                message: "Off day deleted successfully",
            });
        }
        catch (error) {
            console.error("Error deleting off day:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
    static async getOffDaysByDateRange(req, res) {
        try {
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: "Start date and end date are required",
                });
            }
            const offDays = await prisma.offDay.findMany({
                where: {
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                orderBy: { date: "asc" },
            });
            res.json({
                success: true,
                data: offDays,
            });
        }
        catch (error) {
            console.error("Error fetching off days by date range:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
}
exports.OffDayController = OffDayController;
