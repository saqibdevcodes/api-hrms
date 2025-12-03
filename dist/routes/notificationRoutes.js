"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const notificationController_1 = require("../controller/notificationController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
// Create notification service and controller
const notificationService = new notificationService_1.NotificationService();
const notificationController = new notificationController_1.NotificationController(notificationService);
// All routes require authentication
router.use(auth_1.authenticate);
// GET /api/notifications - Get user's notifications
router.get("/", [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    (0, express_validator_1.query)("isRead")
        .optional()
        .isBoolean()
        .withMessage("isRead must be a boolean"),
    (0, express_validator_1.query)("type")
        .optional()
        .isIn([
        "LEAVE_REQUEST_SUBMITTED",
        "LEAVE_REQUEST_APPROVED",
        "LEAVE_REQUEST_REJECTED",
        "PAYROLL_PROCESSED",
        "PERFORMANCE_REVIEW_DUE",
        "ATTENDANCE_REMINDER",
        "SYSTEM_ANNOUNCEMENT",
        "BIRTHDAY_REMINDER",
        "WORK_ANNIVERSARY",
        "DOCUMENT_EXPIRY",
        "TASK_ASSIGNED",
        "MEETING_SCHEDULED",
    ])
        .withMessage("Invalid notification type"),
], validateRequest_1.validateRequest, notificationController.getUserNotifications.bind(notificationController));
// GET /api/notifications/unread-count - Get unread notifications count
router.get("/unread-count", notificationController.getUnreadCount.bind(notificationController));
// PUT /api/notifications/:id/read - Mark notification as read
router.put("/:id/read", notificationController.markAsRead.bind(notificationController));
// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put("/mark-all-read", notificationController.markAllAsRead.bind(notificationController));
// DELETE /api/notifications/:id - Delete notification
router.delete("/:id", notificationController.deleteNotification.bind(notificationController));
// POST /api/notifications/system-announcement - Send system announcement (Admin only)
router.post("/system-announcement", auth_1.adminOnly, [
    (0, express_validator_1.body)("title")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Title must be between 1 and 200 characters"),
    (0, express_validator_1.body)("message")
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage("Message must be between 1 and 1000 characters"),
    (0, express_validator_1.body)("targetRole")
        .optional()
        .isIn(["ADMIN", "HR", "EMPLOYEE"])
        .withMessage("Invalid target role"),
], validateRequest_1.validateRequest, notificationController.sendSystemAnnouncement.bind(notificationController));
exports.default = router;
