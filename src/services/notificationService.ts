import { SocketManager } from "../socket/socketManager";
import { prisma } from "../lib/prisma";
import { NotificationType } from "@prisma/client";

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
    | "MEETING_SCHEDULED"
    | "PDR_CREATION"
    | "PDR_SUBMISSION"
    | "PDR_REVIEW"
    | "PDR_APPROVAL"
    | "PDR_REJECTED"
    | "TICKET_CREATED"
    | "TICKET_ASSIGNED"
    | "TICKET_UPDATED"
    | "TICKET_COMMENT"
    | "TICKET_RESOLVED"
    | "TICKET_SLA_BREACHED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  data?: any;
}

export class NotificationService {
  private socketManager?: SocketManager;

  constructor(socketManager?: SocketManager) {
    this.socketManager = socketManager;
  }

  // Create and send notification to a specific user
  async createNotificationForUser(
    userId: string,
    notificationData: CreateNotificationData,
  ) {
    try {
      // socketManager handles both DB save and real-time push in one call
      if (this.socketManager) {
        return await this.socketManager.sendNotificationToUser(
          userId,
          notificationData,
        );
      }

      // Fallback: save to DB only (no socket available)
      const notification = await prisma.notification.create({
        data: {
          userId,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type as NotificationType,
          priority: notificationData.priority || "MEDIUM",
          data: notificationData.data || null,
        },
      });

      return notification;
    } catch (error) {
      console.error("Error creating notification for user:", error);
      throw error;
    }
  }

  // Create and send notification to users with specific role
  async createNotificationForRole(
    role: string,
    notificationData: CreateNotificationData,
  ) {
    try {
      if (this.socketManager) {
        return await this.socketManager.sendNotificationToRole(
          role,
          notificationData,
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
        users.map((user: any) =>
          prisma.notification.create({
            data: {
              userId: user.id,
              title: notificationData.title,
              message: notificationData.message,
              type: notificationData.type as NotificationType,
              priority: notificationData.priority || "MEDIUM",
              data: notificationData.data || null,
            },
          }),
        ),
      );

      return notifications;
    } catch (error) {
      console.error("Error creating notification for role:", error);
      throw error;
    }
  }

  // Create and send notification to all users (or a filtered list of user IDs)
  async createNotificationForAll(
    notificationData: CreateNotificationData,
    employees?: string[] | undefined,
  ) {
    try {
      // When an employee filter is provided, send individually to each user
      // so the list is respected regardless of socket availability.
      if (employees?.length) {
        await Promise.all(
          employees.map((uid) =>
            this.createNotificationForUser(uid, notificationData),
          ),
        );
        return;
      }

      if (this.socketManager) {
        return await this.socketManager.sendNotificationToAll(notificationData);
      }

      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(employees?.length
            ? {
                id: {
                  in: employees,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

      const notifications = await Promise.all(
        users.map((user: any) =>
          prisma.notification.create({
            data: {
              userId: user.id,
              title: notificationData.title,
              message: notificationData.message,
              type: notificationData.type as NotificationType,
              priority: notificationData.priority || "MEDIUM",
              data: notificationData.data || null,
            },
          }),
        ),
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
    },
  ) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const where: any = { userId };

      // Filter notifications from specific user (e.g., user 1) - only show to admins
      // If current user is not admin or HR, exclude notifications from user 1
      if (
        options?.userRole &&
        options.userRole !== "ADMIN" &&
        options.userRole !== "SUPERADMIN" &&
        options.userRole !== "HR"
      ) {
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
          // Must use OR to avoid the SQL NULL trap:
          // `NOT (fromUserId = 'id')` in MySQL silently excludes rows where
          // fromUserId IS NULL, which would hide all system-generated notifications.
          where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : []),
            {
              OR: [
                { fromUserId: null },
                { fromUserId: { not: systemUser.id } },
              ],
            },
          ];
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
    endDate: string,
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
    endDate: string,
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
    reason?: string,
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
    amount: number,
  ) {
    await this.createNotificationForUser(employeeId, {
      title: "Payroll Processed",
      message: `Your payroll for ${payPeriod} has been processed. Amount: $${amount.toFixed(
        2,
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
    employeeName: string,
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
    targetRole?: string,
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

  // ─── PDR Notifications ────────────────────────────────────────────────────

  /** Bulk create: notify each affected employee. */
  async sendPDRCreationNotification(employees?: string[] | undefined) {
    await this.createNotificationForAll(
      {
        title: "Performance Review Created",
        message:
          "A new Performance Development Review has been created for you. Please complete your section within the deadline.",
        type: "PDR_CREATION",
        priority: "HIGH",
      },
      employees,
    );
  }

  /** Single PDR created — notify employee and optionally line manager. */
  async sendPdrCreatedNotification(
    employeeUserId: string,
    employeeName: string,
    cycle: string,
    lineManagerUserId?: string,
  ) {
    await this.createNotificationForUser(employeeUserId, {
      title: "Performance Review Created",
      message: `Your Performance Development Review for cycle "${cycle}" has been created. Please fill your section within the given deadline.`,
      type: "PDR_CREATION",
      priority: "HIGH",
      data: { cycle },
    });

    if (lineManagerUserId) {
      await this.createNotificationForUser(lineManagerUserId, {
        title: "New PDR Assigned",
        message: `A PDR for cycle "${cycle}" has been created and assigned to you as Line Manager for ${employeeName}.`,
        type: "PDR_CREATION",
        priority: "MEDIUM",
        data: { cycle, employeeName },
      });
    }
  }

  /** Employee or Manager submitted their section — notify all HR / ADMIN. */
  async sendPdrSubmittedToHRNotification(
    submitterName: string,
    role: "EMPLOYEE" | "MANAGER",
    cycle: string,
  ) {
    const roleLabel = role === "EMPLOYEE" ? "employee" : "manager";
    const payload = {
      title: "PDR Section Submitted",
      message: `${submitterName} submitted the ${roleLabel} section for PDR cycle "${cycle}". HR review required.`,
      type: "PDR_SUBMISSION" as const,
      priority: "HIGH" as const,
      data: { cycle, submitterName, role },
    };
    await Promise.all([
      this.createNotificationForRole("HR", payload),
      this.createNotificationForRole("ADMIN", payload),
    ]);
  }

  /** HR approved employee section — notify line manager to fill their section. */
  async sendPdrEmployeeSectionApprovedNotification(
    lineManagerUserId: string,
    employeeName: string,
    cycle: string,
  ) {
    await this.createNotificationForUser(lineManagerUserId, {
      title: "PDR: Manager Section Required",
      message: `The employee section for ${employeeName}'s PDR (cycle "${cycle}") has been approved by HR. Please complete the Line Manager section.`,
      type: "PDR_APPROVAL",
      priority: "HIGH",
      data: { cycle, employeeName },
    });
  }

  /** HR approved manager section — notify Director to review. */
  async sendPdrManagerSectionApprovedNotification(
    directorUserId: string,
    employeeName: string,
    cycle: string,
  ) {
    await this.createNotificationForUser(directorUserId, {
      title: "PDR: Director Review Required",
      message: `The manager section for ${employeeName}'s PDR (cycle "${cycle}") has been approved by HR. Please complete the Director review.`,
      type: "PDR_APPROVAL",
      priority: "HIGH",
      data: { cycle, employeeName },
    });
  }

  /** Manager submitted and employee needs to acknowledge. */
  async sendPdrAcknowledgementRequiredNotification(
    employeeUserId: string,
    cycle: string,
  ) {
    await this.createNotificationForUser(employeeUserId, {
      title: "PDR: Your Acknowledgement Required",
      message: `Your manager has reviewed your PDR for cycle "${cycle}". Please review and acknowledge (or raise a disagreement).`,
      type: "PDR_REVIEW",
      priority: "HIGH",
      data: { cycle },
    });
  }

  /** HR reverted PDR back to employee — notify employee. */
  async sendPdrRevertedToEmployeeNotification(
    employeeUserId: string,
    cycle: string,
    revertMessage?: string,
  ) {
    await this.createNotificationForUser(employeeUserId, {
      title: "PDR Returned for Revision",
      message: `Your PDR for cycle "${cycle}" has been returned by HR for revision.${revertMessage ? ` Reason: ${revertMessage}` : ""}`,
      type: "PDR_REJECTED",
      priority: "HIGH",
      data: { cycle, revertMessage },
    });
  }

  /** HR reverted manager section — notify line manager. */
  async sendPdrRevertedToManagerNotification(
    lineManagerUserId: string,
    employeeName: string,
    cycle: string,
    revertMessage?: string,
  ) {
    await this.createNotificationForUser(lineManagerUserId, {
      title: "PDR Manager Section Returned",
      message: `The manager section of ${employeeName}'s PDR (cycle "${cycle}") has been returned by HR for revision.${revertMessage ? ` Reason: ${revertMessage}` : ""}`,
      type: "PDR_REJECTED",
      priority: "HIGH",
      data: { cycle, employeeName, revertMessage },
    });
  }

  /** Director completed review — notify employee to acknowledge. */
  async sendPdrDirectorReviewedNotification(
    employeeUserId: string,
    cycle: string,
  ) {
    await this.createNotificationForUser(employeeUserId, {
      title: "PDR: Director Review Complete",
      message: `The Director has completed the review of your PDR for cycle "${cycle}". Please review and acknowledge.`,
      type: "PDR_REVIEW",
      priority: "HIGH",
      data: { cycle },
    });
  }

  /** PDR marked as COMPLETED — notify employee and HR. */
  async sendPdrCompletedNotification(
    employeeUserId: string,
    employeeName: string,
    cycle: string,
  ) {
    await Promise.all([
      this.createNotificationForUser(employeeUserId, {
        title: "PDR Completed",
        message: `Your Performance Development Review for cycle "${cycle}" has been completed. Well done!`,
        type: "PDR_APPROVAL",
        priority: "MEDIUM",
        data: { cycle },
      }),
      this.createNotificationForRole("HR", {
        title: "PDR Completed",
        message: `PDR for ${employeeName} (cycle "${cycle}") has been completed.`,
        type: "PDR_APPROVAL",
        priority: "LOW",
        data: { cycle, employeeName },
      }),
    ]);
  }

  /** Employee disagreed — notify HR and Admin for follow-up. */
  async sendPdrDisagreedNotification(employeeName: string, cycle: string) {
    const payload = {
      title: "PDR Disagreement",
      message: `${employeeName} has disagreed with their PDR for cycle "${cycle}". HR intervention required.`,
      type: "PDR_REJECTED" as const,
      priority: "URGENT" as const,
      data: { cycle, employeeName },
    };
    await Promise.all([
      this.createNotificationForRole("HR", payload),
      this.createNotificationForRole("ADMIN", payload),
    ]);
  }

  /** Manager Pending / Revising — remind line manager to fill their section. */
  async sendPdrManagerPendingNotification(
    lineManagerUserId: string,
    employeeName: string,
    cycle: string,
    isRevising = false,
  ) {
    await this.createNotificationForUser(lineManagerUserId, {
      title: isRevising
        ? "PDR: Manager Section Revision"
        : "PDR: Manager Section Required",
      message: isRevising
        ? `Please revise the manager section of ${employeeName}'s PDR for cycle "${cycle}" as requested by HR.`
        : `Please complete the manager section of ${employeeName}'s PDR for cycle "${cycle}".`,
      type: "PDR_REVIEW",
      priority: "HIGH",
      data: { cycle, employeeName },
    });
  }

  /** HR updated phase deadlines — notify current phase owner(s). */
  async sendPdrDeadlinesUpdatedNotification(
    recipientUserIds: string[],
    employeeName: string,
    cycle: string,
  ) {
    await Promise.all(
      recipientUserIds.map((uid) =>
        this.createNotificationForUser(uid, {
          title: "PDR Deadlines Updated",
          message: `The phase deadlines for ${employeeName}'s PDR (cycle "${cycle}") have been updated by HR.`,
          type: "PDR_REVIEW",
          priority: "MEDIUM",
          data: { cycle, employeeName },
        }),
      ),
    );
  }
}
