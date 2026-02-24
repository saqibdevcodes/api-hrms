"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeLeaveController = void 0;
const express_validator_1 = require("express-validator");
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class EmployeeLeaveController {
    // Get employee leave balance by user ID
    static async getEmployeeLeave(req, res) {
        try {
            const { userId } = req.params;
            // Check if user is requesting their own leave or has admin/HR privileges
            if (req.user?.id !== userId &&
                !["ADMIN"].includes(req.user?.role || "")) {
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
        }
        catch (error) {
            console.error("Error fetching employee leave:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch employee leave balance",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Get all employee leaves (HR and Admin only)
    static async getAllEmployeeLeaves(req, res) {
        try {
            const { page = 1, limit = 10, search = "", department = "" } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            // Build where clause
            const where = {};
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
        }
        catch (error) {
            console.error("Error fetching employee leaves:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch employee leaves",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Create employee leave record
    static async createEmployeeLeave(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { userId, annualLeaves, sickLeaves, casualLeaves, compensatoryLeaves, maternityLeaves, paternityLeaves, leavePolicyId, } = req.body;
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
                    compensatoryLeaves: parseInt(compensatoryLeaves),
                    maternityLeaves: parseInt(maternityLeaves),
                    paternityLeaves: parseInt(paternityLeaves),
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
        }
        catch (error) {
            console.error("Error creating employee leave:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create employee leave record",
                error: error.message || "Unknown error",
            });
        }
    }
    // Update employee leave balances
    static async updateEmployeeLeave(req, res) {
        try {
            const { userId } = req.params;
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { annualLeaves, sickLeaves, casualLeaves, compensatoryLeaves, maternityLeaves, paternityLeaves, leavePolicyId, } = req.body;
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
                    compensatoryLeaves: parseInt(compensatoryLeaves),
                    maternityLeaves: parseInt(maternityLeaves),
                    paternityLeaves: parseInt(paternityLeaves),
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
        }
        catch (error) {
            console.error("Error updating employee leave:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update employee leave record",
                error: error.message || "Unknown error",
            });
        }
    }
    // Initialize employee leave from leave policy
    static async initializeFromPolicy(req, res) {
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
                    compensatoryLeaves: 0,
                    maternityLeaves: leavePolicy.maternityLeaves,
                    paternityLeaves: leavePolicy.paternityLeaves,
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
        }
        catch (error) {
            console.error("Error initializing employee leave:", error);
            res.status(500).json({
                success: false,
                message: "Failed to initialize employee leave",
                error: error.message || "Unknown error",
            });
        }
    }
}
exports.EmployeeLeaveController = EmployeeLeaveController;
