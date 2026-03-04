"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveRequestController = void 0;
const express_validator_1 = require("express-validator");
const prisma_1 = require("../lib/prisma");
const notificationService_1 = require("../services/notificationService");
const index_1 = require("../index");
class LeaveRequestController {
    // Get all leave requests (HR and Admin can see all, employees see only their own)
    static async getAllLeaveRequests(req, res) {
        try {
            const { page = 1, limit = 10, search, status, leaveType, employeeId, startDate, endDate, sortBy = "createdAt", sortOrder = "desc", } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const offset = (pageNumber - 1) * limitNumber;
            // Build where clause
            const where = {};
            // If not admin/HR, only show current user's requests
            if (!["ADMIN", "HR"].includes(req.user?.role || "")) {
                where.employeeId = req.user?.id;
            }
            else if (employeeId) {
                where.employeeId = employeeId;
            }
            if (status) {
                where.status = status;
            }
            if (leaveType) {
                where.leaveType = leaveType;
            }
            if (startDate || endDate) {
                where.startDate = {};
                if (startDate) {
                    where.startDate.gte = new Date(startDate);
                }
                if (endDate) {
                    where.startDate.lte = new Date(endDate);
                }
            }
            if (search) {
                where.OR = [
                    { reason: { contains: search, mode: "insensitive" } },
                    {
                        employee: { firstName: { contains: search, mode: "insensitive" } },
                    },
                    { employee: { lastName: { contains: search, mode: "insensitive" } } },
                ];
            }
            // Get total count
            const total = await prisma_1.prisma.leaveRequest.count({ where });
            // Get leave requests
            const leaveRequests = await prisma_1.prisma.leaveRequest.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                            departmentEntity: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            designation: {
                                select: {
                                    id: true,
                                    title: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    [sortBy]: sortOrder,
                },
                skip: offset,
                take: limitNumber,
            });
            const totalPages = Math.ceil(total / limitNumber);
            res.json({
                success: true,
                message: "Leave requests retrieved successfully",
                data: {
                    leaveRequests,
                    pagination: {
                        currentPage: pageNumber,
                        totalPages,
                        totalRecords: total,
                        limit: limitNumber,
                    },
                },
            });
        }
        catch (error) {
            console.error("Error fetching leave requests:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch leave requests",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Get leave request by ID
    static async getLeaveRequestById(req, res) {
        try {
            const { id } = req.params;
            const leaveRequest = await prisma_1.prisma.leaveRequest.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                            departmentEntity: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            designation: {
                                select: {
                                    id: true,
                                    title: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!leaveRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Leave request not found",
                });
            }
            // Check if user can access this leave request
            if (!["ADMIN", "HR"].includes(req.user?.role || "") &&
                leaveRequest.employeeId !== req.user?.id) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. You can only view your own leave requests.",
                });
            }
            res.json({
                success: true,
                message: "Leave request retrieved successfully",
                data: leaveRequest,
            });
        }
        catch (error) {
            console.error("Error fetching leave request:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch leave request",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Create leave request
    static async createLeaveRequest(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { leaveType, startDate, endDate, reason, comments } = req.body;
            // Calculate days between start and end date
            const start = new Date(startDate);
            const end = new Date(endDate);
            const timeDiff = end.getTime() - start.getTime();
            const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Include both start and end dates
            if (days <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "End date must be after start date",
                });
            }
            // Check if employee has sufficient leave balance (optional - can be implemented later)
            // const employeeLeave = await prisma.employeeLeave.findUnique({
            //   where: { userId: req.user!.id }
            // });
            const leaveRequest = await prisma_1.prisma.leaveRequest.create({
                data: {
                    employeeId: req.user.id,
                    leaveType,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    days,
                    reason,
                    comments,
                    status: "PENDING",
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                            departmentEntity: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            });
            // Send notification to HR and Admin
            try {
                const socketManager = (0, index_1.getSocketManager)();
                const notificationService = new notificationService_1.NotificationService(socketManager);
                const employeeName = `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`;
                const formattedStartDate = new Date(startDate).toLocaleDateString();
                const formattedEndDate = new Date(endDate).toLocaleDateString();
                await notificationService.sendLeaveRequestSubmittedNotification(req.user.id, employeeName, leaveType, formattedStartDate, formattedEndDate);
            }
            catch (notificationError) {
                console.error("Error sending leave request notification:", notificationError);
                // Don't fail the request if notification fails
            }
            res.status(201).json({
                success: true,
                message: "Leave request created successfully",
                data: leaveRequest,
            });
        }
        catch (error) {
            console.error("Error creating leave request:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create leave request",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Update leave request (employees can only update their own pending requests)
    static async updateLeaveRequest(req, res) {
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
            const { leaveType, startDate, endDate, reason, comments } = req.body;
            const existingRequest = await prisma_1.prisma.leaveRequest.findUnique({
                where: { id },
            });
            if (!existingRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Leave request not found",
                });
            }
            // Check permissions
            if (!["ADMIN", "HR"].includes(req.user?.role || "") &&
                existingRequest.employeeId !== req.user?.id) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. You can only update your own leave requests.",
                });
            }
            // Only allow updates if request is still pending
            if (existingRequest.status !== "PENDING") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot update leave request that has already been processed",
                });
            }
            // Calculate days if dates are being updated
            let days = existingRequest.days;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const timeDiff = end.getTime() - start.getTime();
                days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
                if (days <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "End date must be after start date",
                    });
                }
            }
            const leaveRequest = await prisma_1.prisma.leaveRequest.update({
                where: { id },
                data: {
                    ...(leaveType && { leaveType }),
                    ...(startDate && { startDate: new Date(startDate) }),
                    ...(endDate && { endDate: new Date(endDate) }),
                    ...(reason && { reason }),
                    ...(comments !== undefined && { comments }),
                    days,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                            departmentEntity: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            });
            res.json({
                success: true,
                message: "Leave request updated successfully",
                data: leaveRequest,
            });
        }
        catch (error) {
            console.error("Error updating leave request:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update leave request",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Delete leave request (employees can only delete their own pending requests)
    static async deleteLeaveRequest(req, res) {
        try {
            const { id } = req.params;
            const existingRequest = await prisma_1.prisma.leaveRequest.findUnique({
                where: { id },
            });
            if (!existingRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Leave request not found",
                });
            }
            // Check permissions
            if (!["ADMIN", "HR"].includes(req.user?.role || "") &&
                existingRequest.employeeId !== req.user?.id) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. You can only delete your own leave requests.",
                });
            }
            // Only allow deletion if request is still pending
            if (existingRequest.status !== "PENDING") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete leave request that has already been processed",
                });
            }
            await prisma_1.prisma.leaveRequest.delete({
                where: { id },
            });
            res.json({
                success: true,
                message: "Leave request deleted successfully",
            });
        }
        catch (error) {
            console.error("Error deleting leave request:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete leave request",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Approve leave request (HR and Admin only)
    static async approveLeaveRequest(req, res) {
        try {
            const { id } = req.params;
            const { comments } = req.body;
            const existingRequest = await prisma_1.prisma.leaveRequest.findUnique({
                where: { id },
            });
            if (!existingRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Leave request not found",
                });
            }
            if (existingRequest.status !== "PENDING") {
                return res.status(400).json({
                    success: false,
                    message: "Leave request has already been processed",
                });
            }
            const leaveRequest = await prisma_1.prisma.leaveRequest.update({
                where: { id },
                data: {
                    status: "APPROVED",
                    approvedAt: new Date(),
                    approvedByHr: req.user.id,
                    comments,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                        },
                    },
                },
            });
            // Send approval notification to employee
            try {
                const socketManager = (0, index_1.getSocketManager)();
                const notificationService = new notificationService_1.NotificationService(socketManager);
                const formattedStartDate = leaveRequest.startDate.toLocaleDateString();
                const formattedEndDate = leaveRequest.endDate.toLocaleDateString();
                await notificationService.sendLeaveRequestApprovedNotification(leaveRequest.employeeId, leaveRequest.leaveType, formattedStartDate, formattedEndDate);
            }
            catch (notificationError) {
                console.error("Error sending approval notification:", notificationError);
                // Don't fail the request if notification fails
            }
            res.json({
                success: true,
                message: "Leave request approved successfully",
                data: leaveRequest,
            });
        }
        catch (error) {
            console.error("Error approving leave request:", error);
            res.status(500).json({
                success: false,
                message: "Failed to approve leave request",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Reject leave request (HR and Admin only)
    static async rejectLeaveRequest(req, res) {
        try {
            const { id } = req.params;
            const { comments } = req.body;
            const existingRequest = await prisma_1.prisma.leaveRequest.findUnique({
                where: { id },
            });
            if (!existingRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Leave request not found",
                });
            }
            if (existingRequest.status !== "PENDING") {
                return res.status(400).json({
                    success: false,
                    message: "Leave request has already been processed",
                });
            }
            const leaveRequest = await prisma_1.prisma.leaveRequest.update({
                where: { id },
                data: {
                    status: "REJECTED",
                    rejectedAt: new Date(),
                    comments,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                        },
                    },
                },
            });
            // Send rejection notification to employee
            try {
                const socketManager = (0, index_1.getSocketManager)();
                const notificationService = new notificationService_1.NotificationService(socketManager);
                const formattedStartDate = leaveRequest.startDate.toLocaleDateString();
                const formattedEndDate = leaveRequest.endDate.toLocaleDateString();
                await notificationService.sendLeaveRequestRejectedNotification(leaveRequest.employeeId, leaveRequest.leaveType, formattedStartDate, formattedEndDate, comments || undefined);
            }
            catch (notificationError) {
                console.error("Error sending rejection notification:", notificationError);
                // Don't fail the request if notification fails
            }
            res.json({
                success: true,
                message: "Leave request rejected successfully",
                data: leaveRequest,
            });
        }
        catch (error) {
            console.error("Error rejecting leave request:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reject leave request",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Get leave request statistics
    static async getLeaveRequestStats(req, res) {
        try {
            const { employeeId, startDate, endDate } = req.query;
            const where = {};
            // If not admin/HR, only show current user's stats
            if (!["ADMIN", "HR"].includes(req.user?.role || "")) {
                where.employeeId = req.user?.id;
            }
            else if (employeeId) {
                where.employeeId = employeeId;
            }
            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) {
                    where.createdAt.gte = new Date(startDate);
                }
                if (endDate) {
                    where.createdAt.lte = new Date(endDate);
                }
            }
            const [pending, approved, rejected, cancelled, total] = await Promise.all([
                prisma_1.prisma.leaveRequest.count({ where: { ...where, status: "PENDING" } }),
                prisma_1.prisma.leaveRequest.count({
                    where: { ...where, status: "APPROVED" },
                }),
                prisma_1.prisma.leaveRequest.count({
                    where: { ...where, status: "REJECTED" },
                }),
                prisma_1.prisma.leaveRequest.count({
                    where: { ...where, status: "CANCELLED" },
                }),
                prisma_1.prisma.leaveRequest.count({ where }),
            ]);
            // Get employees currently on leave (approved requests where current date is between start and end date)
            const onLeaveToday = await prisma_1.prisma.leaveRequest.count({
                where: {
                    ...where,
                    status: "APPROVED",
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() },
                },
            });
            res.json({
                success: true,
                message: "Leave request statistics retrieved successfully",
                data: {
                    pending,
                    approved,
                    rejected,
                    cancelled,
                    total,
                    onLeave: onLeaveToday,
                },
            });
        }
        catch (error) {
            console.error("Error fetching leave request statistics:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch leave request statistics",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}
exports.LeaveRequestController = LeaveRequestController;
