"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const express_validator_1 = require("express-validator");
class NotificationController {
    constructor(notificationService) {
        this.notificationService = notificationService;
    }
    // Get user's notifications
    async getUserNotifications(req, res) {
        try {
            const { page = 1, limit = 20, isRead, type } = req.query;
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);
            const options = {
                page: pageNumber,
                limit: limitNumber,
            };
            if (isRead !== undefined) {
                options.isRead = isRead === "true";
            }
            if (type) {
                options.type = type;
            }
            const result = await this.notificationService.getUserNotifications(req.user.id, options);
            res.json({
                success: true,
                message: "Notifications retrieved successfully",
                data: result,
            });
        }
        catch (error) {
            console.error("Error fetching notifications:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch notifications",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Get unread notifications count
    async getUnreadCount(req, res) {
        try {
            const count = await this.notificationService.getUnreadCount(req.user.id);
            res.json({
                success: true,
                message: "Unread count retrieved successfully",
                data: { count },
            });
        }
        catch (error) {
            console.error("Error fetching unread count:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch unread count",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Mark notification as read
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const notification = await this.notificationService.markAsRead(id, req.user.id);
            res.json({
                success: true,
                message: "Notification marked as read",
                data: notification,
            });
        }
        catch (error) {
            console.error("Error marking notification as read:", error);
            res.status(500).json({
                success: false,
                message: "Failed to mark notification as read",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Mark all notifications as read
    async markAllAsRead(req, res) {
        try {
            const result = await this.notificationService.markAllAsRead(req.user.id);
            res.json({
                success: true,
                message: "All notifications marked as read",
                data: { updatedCount: result.count },
            });
        }
        catch (error) {
            console.error("Error marking all notifications as read:", error);
            res.status(500).json({
                success: false,
                message: "Failed to mark all notifications as read",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Delete notification
    async deleteNotification(req, res) {
        try {
            const { id } = req.params;
            await this.notificationService.deleteNotification(id, req.user.id);
            res.json({
                success: true,
                message: "Notification deleted successfully",
            });
        }
        catch (error) {
            console.error("Error deleting notification:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete notification",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Send system announcement (Admin only)
    async sendSystemAnnouncement(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: errors.array(),
                });
            }
            const { title, message, targetRole } = req.body;
            await this.notificationService.sendSystemAnnouncementNotification(title, message, targetRole);
            res.json({
                success: true,
                message: "System announcement sent successfully",
            });
        }
        catch (error) {
            console.error("Error sending system announcement:", error);
            res.status(500).json({
                success: false,
                message: "Failed to send system announcement",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}
exports.NotificationController = NotificationController;
