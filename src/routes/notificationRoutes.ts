import { Router } from "express";
import { body, query } from "express-validator";
import { NotificationController } from "../controller/notificationController";
import { authenticate, adminOnly } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { NotificationService } from "../services/notificationService";

const router = Router();

// Create notification service and controller
const notificationService = new NotificationService();
const notificationController = new NotificationController(notificationService);

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get user's notifications
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("isRead")
      .optional()
      .isBoolean()
      .withMessage("isRead must be a boolean"),
    query("type")
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
  ],
  validateRequest,
  notificationController.getUserNotifications.bind(notificationController)
);

// GET /api/notifications/unread-count - Get unread notifications count
router.get(
  "/unread-count",
  notificationController.getUnreadCount.bind(notificationController)
);

// PUT /api/notifications/:id/read - Mark notification as read
router.put(
  "/:id/read",
  notificationController.markAsRead.bind(notificationController)
);

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put(
  "/mark-all-read",
  notificationController.markAllAsRead.bind(notificationController)
);

// DELETE /api/notifications/:id - Delete notification
router.delete(
  "/:id",
  notificationController.deleteNotification.bind(notificationController)
);

// POST /api/notifications/system-announcement - Send system announcement (Admin only)
router.post(
  "/system-announcement",
  adminOnly,
  [
    body("title")
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Title must be between 1 and 200 characters"),
    body("message")
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Message must be between 1 and 1000 characters"),
    body("targetRole")
      .optional()
      .isIn(["ADMIN", "HR", "EMPLOYEE"])
      .withMessage("Invalid target role"),
  ],
  validateRequest,
  notificationController.sendSystemAnnouncement.bind(notificationController)
);

export default router;
