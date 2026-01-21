import { PrismaClient } from "../generated/prisma";
import { SocketManager } from "../socket/socketManager";

const prisma = new PrismaClient();

export interface CreateNotificationData {
  title: string;
  message: string;
  type:
    | "LEAVE_REQUEST_SUBMITTED"
    | "LEAVE_REQUEST_APPROVED"
    | "LEAVE_REQUEST_REJECTED"
    | "PAYROLL_PROCESSED"
    | "PERFORMANCE_REVIEW_DUE"
    | "ATTENDANCE_REMINDER"
    | "SYSTEM_ANNOUNCEMENT"
    | "BIRTHDAY_REMINDER"
    | "WORK_ANNIVERSARY"
    | "DOCUMENT_EXPIRY"
    | "TASK_ASSIGNED"
    | "MEETING_SCHEDULED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  data?: any;
  fromUserId?: string; // Track who created/sent the notification
}

export class NotificationService {
  private socketManager?: SocketManager;

  constructor(socketManager?: SocketManager) {
    this.socketManager = socketManager;
  }

  // Create and send notification to a specific user
  async createNotificationForUser(
    userId: string,
    notificationData: CreateNotificationData
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          priority: notificationData.priority || "MEDIUM",
          data: notificationData.data || null,
          fromUserId: notificationData.fromUserId || null,
        },
      });

      // Send real-time notification if socket manager is available
      if (this.socketManager) {
        await this.socketManager.sendNotificationToUser(
          userId,
          notificationData
        );
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification for user:", error);
      throw error;
    }
  }

  // Create and send notification to users with specific role
  async createNotificationForRole(
    role: string,
    notificationData: CreateNotificationData
  ) {
    try {
      if (this.socketManager) {
        return await this.socketManager.sendNotificationToRole(
          role,
          notificationData
        );
      }

      // Fallback: create notifications without real-time sending
      const users = await prisma.user.findMany({
        where: {
          role: role as any,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      const notifications = await Promise.all(
        users.map((user) =>
          prisma.notification.create({
            data: {
              userId: user.id,
              title: notificationData.title,
              message: notificationData.message,
              type: notificationData.type,
              priority: notificationData.priority || "MEDIUM",
              data: notificationData.data || null,
            },
          })
        )
      );

      return notifications;
    } catch (error) {
      console.error("Error creating notification for role:", error);
      throw error;
    }
  }

  // Create and send notification to all users
  async createNotificationForAll(notificationData: CreateNotificationData) {
    try {
      if (this.socketManager) {
        return await this.socketManager.sendNotificationToAll(notificationData);
      }

      // Fallback: create notifications without real-time sending
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      const notifications = await Promise.all(
        users.map((user) =>
          prisma.notification.create({
            data: {
              userId: user.id,
              title: notificationData.title,
              message: notificationData.message,
              type: notificationData.type,
              priority: notificationData.priority || "MEDIUM",
              data: notificationData.data || null,
              fromUserId: notificationData.fromUserId || null,
            },
          })
        )
      );

      return notifications;
    } catch (error) {
      console.error("Error creating notification for all users:", error);
      throw error;
    }
  }

  // Get notifications for a user
  async getUserNotifications(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      isRead?: boolean;
      type?: string;
      userRole?: string;
    }
  ) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const where: any = { userId };

      // Filter notifications from specific user (e.g., user 1) - only show to admins
      // If current user is not admin or HR, exclude notifications from user 1
      if (options?.userRole && options.userRole !== "ADMIN" && options.userRole !== "SUPERADMIN" && options.userRole !== "HR") {
        // Find user 1 or system user
        const systemUser = await prisma.user.findFirst({
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
        prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
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
    } catch (error) {
      console.error("Error getting user notifications:", error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.update({
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
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notification.updateMany({
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
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Get unread notifications count
  async getUnreadCount(userId: string) {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return count;
    } catch (error) {
      console.error("Error getting unread notifications count:", error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.delete({
        where: {
          id: notificationId,
          userId, // Ensure user can only delete their own notifications
        },
      });

      return notification;
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  // Predefined notification templates for common scenarios
  async sendLeaveRequestSubmittedNotification(
    employeeId: string,
    employeeName: string,
    leaveType: string,
    startDate: string,
    endDate: string
  ) {
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

  async sendLeaveRequestApprovedNotification(
    employeeId: string,
    leaveType: string,
    startDate: string,
    endDate: string
  ) {
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

  async sendLeaveRequestRejectedNotification(
    employeeId: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason?: string
  ) {
    await this.createNotificationForUser(employeeId, {
      title: "Leave Request Rejected",
      message: `Your ${leaveType} request from ${startDate} to ${endDate} has been rejected${
        reason ? `: ${reason}` : ""
      }`,
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

  async sendPayrollProcessedNotification(
    employeeId: string,
    payPeriod: string,
    amount: number
  ) {
    await this.createNotificationForUser(employeeId, {
      title: "Payroll Processed",
      message: `Your payroll for ${payPeriod} has been processed. Amount: $${amount.toFixed(
        2
      )}`,
      type: "PAYROLL_PROCESSED",
      priority: "MEDIUM",
      data: {
        payPeriod,
        amount,
      },
    });
  }

  async sendBirthdayReminderNotification(
    employeeId: string,
    employeeName: string
  ) {
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

  async sendSystemAnnouncementNotification(
    title: string,
    message: string,
    targetRole?: string
  ) {
    if (targetRole) {
      await this.createNotificationForRole(targetRole, {
        title,
        message,
        type: "SYSTEM_ANNOUNCEMENT",
        priority: "MEDIUM",
      });
    } else {
      await this.createNotificationForAll({
        title,
        message,
        type: "SYSTEM_ANNOUNCEMENT",
        priority: "MEDIUM",
      });
    }
  }
}
