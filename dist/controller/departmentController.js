"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentController = void 0;
const express_validator_1 = require("express-validator");
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class DepartmentController {
    // Get all departments
    static async getAllDepartments(req, res) {
        try {
            const { page = 1, limit = 10, search = "", isActive } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            // Add search filter
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ];
            }
            // Add active filter
            if (isActive !== undefined) {
                where.isActive = isActive === "true";
            }
            const [departments, total] = await Promise.all([
                prisma.department.findMany({
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
                prisma.department.count({ where }),
            ]);
            res.json({
                success: true,
                message: "Departments retrieved successfully",
                data: {
                    departments,
                    pagination: {
                        currentPage: pageNum,
                        totalPages: Math.ceil(total / limitNum),
                        totalRecords: total,
                        limit: limitNum,
                    },
                },
            });
        }
        catch (error) {
            console.error("Error fetching departments:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch departments",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Get department by ID
    static async getDepartmentById(req, res) {
        try {
            const { id } = req.params;
            const department = await prisma.department.findUnique({
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
        }
        catch (error) {
            console.error("Error fetching department:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch department",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Create new department
    static async createDepartment(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { name, description, manager, budget } = req.body;
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
                    budget: budget ? parseFloat(budget) : null,
                },
            });
            res.status(201).json({
                success: true,
                message: "Department created successfully",
                data: { department },
            });
        }
        catch (error) {
            console.error("Error creating department:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create department",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Update department
    static async updateDepartment(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { id } = req.params;
            const { name, description, manager, budget, isActive } = req.body;
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
                    budget: budget ? parseFloat(budget) : null,
                    isActive,
                },
            });
            res.json({
                success: true,
                message: "Department updated successfully",
                data: { department },
            });
        }
        catch (error) {
            console.error("Error updating department:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update department",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Delete department
    static async deleteDepartment(req, res) {
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
        }
        catch (error) {
            console.error("Error deleting department:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete department",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Toggle department status
    static async toggleDepartmentStatus(req, res) {
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
                message: `Department ${updatedDepartment.isActive ? "activated" : "deactivated"} successfully`,
                data: { department: updatedDepartment },
            });
        }
        catch (error) {
            console.error("Error toggling department status:", error);
            res.status(500).json({
                success: false,
                message: "Failed to toggle department status",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}
exports.DepartmentController = DepartmentController;
