"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = require("../lib/prisma");
class NotificationService {
    constructor(socketManager) {
        this.socketManager = socketManager;
    }
    // Create and send notification to a specific user
    async createNotificationForUser(userId, notificationData) {
        try {
            const notification = await prisma_1.prisma.notification.create({
                data: {
                    userId,
                    title: notificationData.title,
                    message: notificationData.message,
                    type: notificationData.type,
                    priority: notificationData.priority || "MEDIUM",
                    data: notificationData.data || null,
                },
            });
            // Send real-time notification if socket manager is available
            if (this.socketManager) {
                await this.socketManager.sendNotificationToUser(userId, notificationData);
            }
            return notification;
        }
        catch (error) {
            console.error("Error creating notification for user:", error);
            throw error;
        }
    }
    // Create and send notification to users with specific role
    async createNotificationForRole(role, notificationData) {
        try {
            if (this.socketManager) {
                return await this.socketManager.sendNotificationToRole(role, notificationData);
            }
            // Fallback: create notifications without real-time sending
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    role: role,
                    isActive: true,
                },
                select: {
                    id: true,
                },
            });
            const notifications = await Promise.all(users.map((user) => prisma_1.prisma.notification.create({
                data: {
                    userId: user.id,
                    title: notificationData.title,
                    message: notificationData.message,
                    type: notificationData.type,
                    priority: notificationData.priority || "MEDIUM",
                    data: notificationData.data || null,
                },
            })));
            return notifications;
        }
        catch (error) {
            console.error("Error creating notification for role:", error);
            throw error;
        }
    }
    // Create and send notification to all users
    async createNotificationForAll(notificationData) {
        try {
            if (this.socketManager) {
                return await this.socketManager.sendNotificationToAll(notificationData);
            }
            // Fallback: create notifications without real-time sending
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    isActive: true,
                },
                select: {
                    id: true,
                },
            });
            const notifications = await Promise.all(users.map((user) => prisma_1.prisma.notification.create({
                data: {
                    userId: user.id,
                    title: notificationData.title,
                    message: notificationData.message,
                    type: notificationData.type,
                    priority: notificationData.priority || "MEDIUM",
                    data: notificationData.data || null,
                },
            })));
            return notifications;
        }
        catch (error) {
            console.error("Error creating notification for all users:", error);
            throw error;
        }
    }
    // Get notifications for a user
    async getUserNotifications(userId, options) {
        try {
            const page = options?.page || 1;
            const limit = options?.limit || 20;
            const offset = (page - 1) * limit;
            const where = { userId };
            // Filter notifications from specific user (e.g., user 1) - only show to admins
            // If current user is not admin or HR, exclude notifications from user 1
            if (options?.userRole &&
                options.userRole !== "ADMIN" &&
                options.userRole !== "SUPERADMIN" &&
                options.userRole !== "HR") {
                // Find user 1 or system user
                const systemUser = await prisma_1.prisma.user.findFirst({
                    where: {
                        OR: [
                            { email: "admin@iriscommunications.com" },
                            { role: "SUPERADMIN" },
                        ],
                    },
                    select: { id: true },
                });
                if (systemUser) {
                    where.NOT = {
                        fromUserId: systemUser.id,
                    };
                }
            }
            if (options?.isRead !== undefined) {
                where.isRead = options.isRead;
            }
            if (options?.type) {
                where.type = options.type;
            }
            const [notifications, total] = await Promise.all([
                prisma_1.prisma.notification.findMany({
                    where,
                    orderBy: {
                        createdAt: "desc",
                    },
                    skip: offset,
                    take: limit,
                }),
                prisma_1.prisma.notification.count({ where }),
            ]);
            return {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            console.error("Error getting user notifications:", error);
            throw error;
        }
    }
    // Mark notification as read
    async markAsRead(notificationId, userId) {
        try {
            const notification = await prisma_1.prisma.notification.update({
                where: {
                    id: notificationId,
                    userId, // Ensure user can only mark their own notifications
                },
                data: {
                    isRead: true,
                    readAt: new Date(),
                },
            });
            return notification;
        }
        catch (error) {
            console.error("Error marking notification as read:", error);
            throw error;
        }
    }
    // Mark all notifications as read for a user
    async markAllAsRead(userId) {
        try {
            const result = await prisma_1.prisma.notification.updateMany({
                where: {
                    userId,
                    isRead: false,
                },
                data: {
                    isRead: true,
                    readAt: new Date(),
                },
            });
            return result;
        }
        catch (error) {
            console.error("Error marking all notifications as read:", error);
            throw error;
        }
    }
    // Get unread notifications count
    async getUnreadCount(userId) {
        try {
            const count = await prisma_1.prisma.notification.count({
                where: {
                    userId,
                    isRead: false,
                },
            });
            return count;
        }
        catch (error) {
            console.error("Error getting unread notifications count:", error);
            throw error;
        }
    }
    // Delete notification
    async deleteNotification(notificationId, userId) {
        try {
            const notification = await prisma_1.prisma.notification.delete({
                where: {
                    id: notificationId,
                    userId, // Ensure user can only delete their own notifications
                },
            });
            return notification;
        }
        catch (error) {
            console.error("Error deleting notification:", error);
            throw error;
        }
    }
    // Predefined notification templates for common scenarios
    async sendLeaveRequestSubmittedNotification(employeeId, employeeName, leaveType, startDate, endDate) {
        // Notify HR and Admin about new leave request
        await this.createNotificationForRole("ADMIN", {
            title: "New Leave Request",
            message: `${employeeName} has submitted a ${leaveType} request from ${startDate} to ${endDate}`,
            type: "LEAVE_REQUEST_SUBMITTED",
            priority: "MEDIUM",
            data: {
                employeeId,
                employeeName,
                leaveType,
                startDate,
                endDate,
            },
        });
        await this.createNotificationForRole("HR", {
            title: "New Leave Request",
            message: `${employeeName} has submitted a ${leaveType} request from ${startDate} to ${endDate}`,
            type: "LEAVE_REQUEST_SUBMITTED",
            priority: "MEDIUM",
            data: {
                employeeId,
                employeeName,
                leaveType,
                startDate,
                endDate,
            },
        });
    }
    async sendLeaveRequestApprovedNotification(employeeId, leaveType, startDate, endDate) {
        await this.createNotificationForUser(employeeId, {
            title: "Leave Request Approved",
            message: `Your ${leaveType} request from ${startDate} to ${endDate} has been approved`,
            type: "LEAVE_REQUEST_APPROVED",
            priority: "HIGH",
            data: {
                leaveType,
                startDate,
                endDate,
                status: "approved",
            },
        });
    }
    async sendLeaveRequestRejectedNotification(employeeId, leaveType, startDate, endDate, reason) {
        await this.createNotificationForUser(employeeId, {
            title: "Leave Request Rejected",
            message: `Your ${leaveType} request from ${startDate} to ${endDate} has been rejected${reason ? `: ${reason}` : ""}`,
            type: "LEAVE_REQUEST_REJECTED",
            priority: "HIGH",
            data: {
                leaveType,
                startDate,
                endDate,
                status: "rejected",
                reason,
            },
        });
    }
    async sendPayrollProcessedNotification(employeeId, payPeriod, amount) {
        await this.createNotificationForUser(employeeId, {
            title: "Payroll Processed",
            message: `Your payroll for ${payPeriod} has been processed. Amount: $${amount.toFixed(2)}`,
            type: "PAYROLL_PROCESSED",
            priority: "MEDIUM",
            data: {
                payPeriod,
                amount,
            },
        });
    }
    async sendBirthdayReminderNotification(employeeId, employeeName) {
        // Send to HR to remind them about employee's birthday
        await this.createNotificationForRole("HR", {
            title: "Birthday Reminder",
            message: `Today is ${employeeName}'s birthday!`,
            type: "BIRTHDAY_REMINDER",
            priority: "LOW",
            data: {
                employeeId,
                employeeName,
            },
        });
    }
    async sendSystemAnnouncementNotification(title, message, targetRole) {
        if (targetRole) {
            await this.createNotificationForRole(targetRole, {
                title,
                message,
                type: "SYSTEM_ANNOUNCEMENT",
                priority: "MEDIUM",
            });
        }
        else {
            await this.createNotificationForAll({
                title,
                message,
                type: "SYSTEM_ANNOUNCEMENT",
                priority: "MEDIUM",
            });
        }
    }
}
exports.NotificationService = NotificationService;
