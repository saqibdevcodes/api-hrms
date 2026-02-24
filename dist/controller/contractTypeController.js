"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractTypeController = void 0;
const express_validator_1 = require("express-validator");
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class ContractTypeController {
    // Get all contract types
    static async getAllContractTypes(req, res) {
        try {
            const { page = 1, limit = 10, search = "", isActive } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;
            // Build where clause
            const where = {};
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ];
            }
            if (isActive !== undefined) {
                where.isActive = isActive === "true";
            }
            const [contractTypes, total] = await Promise.all([
                prisma.contractType.findMany({
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
                prisma.contractType.count({ where }),
            ]);
            res.json({
                success: true,
                message: "Contract types retrieved successfully",
                data: {
                    contractTypes,
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
            console.error("Error fetching contract types:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch contract types",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Get single contract type by ID
    static async getContractTypeById(req, res) {
        try {
            const { id } = req.params;
            const contractType = await prisma.contractType.findUnique({
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
            if (!contractType) {
                return res.status(404).json({
                    success: false,
                    message: "Contract type not found",
                });
            }
            res.json({
                success: true,
                message: "Contract type retrieved successfully",
                data: contractType,
            });
        }
        catch (error) {
            console.error("Error fetching contract type:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch contract type",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Create new contract type
    static async createContractType(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { name, description, duration, isActive = true } = req.body;
            const contractType = await prisma.contractType.create({
                data: {
                    name,
                    description,
                    duration: duration ? parseInt(duration) : null,
                    isActive,
                },
            });
            res.status(201).json({
                success: true,
                message: "Contract type created successfully",
                data: contractType,
            });
        }
        catch (error) {
            console.error("Error creating contract type:", error);
            if (error.code === "P2002") {
                return res.status(400).json({
                    success: false,
                    message: "Contract type with this name already exists",
                });
            }
            res.status(500).json({
                success: false,
                message: "Failed to create contract type",
                error: error.message || "Unknown error",
            });
        }
    }
    // Update contract type
    static async updateContractType(req, res) {
        try {
            const { id } = req.params;
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { name, description, duration, isActive } = req.body;
            const contractType = await prisma.contractType.findUnique({
                where: { id },
            });
            if (!contractType) {
                return res.status(404).json({
                    success: false,
                    message: "Contract type not found",
                });
            }
            const updatedContractType = await prisma.contractType.update({
                where: { id },
                data: {
                    name,
                    description,
                    duration: duration ? parseInt(duration) : null,
                    isActive,
                },
            });
            res.json({
                success: true,
                message: "Contract type updated successfully",
                data: updatedContractType,
            });
        }
        catch (error) {
            console.error("Error updating contract type:", error);
            if (error.code === "P2002") {
                return res.status(400).json({
                    success: false,
                    message: "Contract type with this name already exists",
                });
            }
            res.status(500).json({
                success: false,
                message: "Failed to update contract type",
                error: error.message || "Unknown error",
            });
        }
    }
    // Delete contract type
    static async deleteContractType(req, res) {
        try {
            const { id } = req.params;
            const contractType = await prisma.contractType.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: { users: true },
                    },
                },
            });
            if (!contractType) {
                return res.status(404).json({
                    success: false,
                    message: "Contract type not found",
                });
            }
            // Check if contract type has associated users
            if (contractType._count.users > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete contract type. It has ${contractType._count.users} user(s) assigned. Please reassign users first.`,
                });
            }
            await prisma.contractType.delete({
                where: { id },
            });
            res.json({
                success: true,
                message: "Contract type deleted successfully",
                data: {
                    id: contractType.id,
                    name: contractType.name,
                },
            });
        }
        catch (error) {
            console.error("Error deleting contract type:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete contract type",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Toggle contract type status
    static async toggleContractTypeStatus(req, res) {
        try {
            const { id } = req.params;
            const contractType = await prisma.contractType.findUnique({
                where: { id },
            });
            if (!contractType) {
                return res.status(404).json({
                    success: false,
                    message: "Contract type not found",
                });
            }
            const updatedContractType = await prisma.contractType.update({
                where: { id },
                data: {
                    isActive: !contractType.isActive,
                },
            });
            res.json({
                success: true,
                message: `Contract type ${updatedContractType.isActive ? "activated" : "deactivated"} successfully`,
                data: updatedContractType,
            });
        }
        catch (error) {
            console.error("Error toggling contract type status:", error);
            res.status(500).json({
                success: false,
                message: "Failed to toggle contract type status",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}
exports.ContractTypeController = ContractTypeController;
