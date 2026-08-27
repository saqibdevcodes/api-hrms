import {
  NotificationType,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { EMAIL_EVENTS } from "../constants/email.events";
import { getSocketManager } from "../index";
import { prisma } from "../lib/prisma";
import { EmailService } from "../utils/emailService";
import { EmailQueueService } from "./emailQueueService";
import { NotificationService } from "./notificationService";

export interface TicketEmailJobData {
  to: string;
  recipientName: string;
  eventLabel: string;
  heading: string;
  message: string;
  ticketNumber: string;
  ticketSubject: string;
  status: string;
  priority: string;
  actorName?: string;
  comment?: string;
  actionUrl: string;
}

interface TicketNoticeInput {
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  status: string;
  priority: TicketPriority;
  recipientIds: string[];
  actorId?: string;
  actorName?: string;
  type: NotificationType;
  title: string;
  message: string;
  eventLabel: string;
  comment?: string;
  includeActor?: boolean;
  email?: boolean;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const priorityToNotification = (
  priority: TicketPriority,
): "LOW" | "MEDIUM" | "HIGH" | "URGENT" => {
  if (priority === "CRITICAL") return "URGENT";
  return priority;
};

export class TicketNotificationService {
  private static notificationService(): NotificationService {
    try {
      return new NotificationService(getSocketManager());
    } catch {
      return new NotificationService();
    }
  }

  static async notify(input: TicketNoticeInput): Promise<void> {
    const recipientIds = [
      ...new Set(
        input.recipientIds.filter(
          (id) => id && (input.includeActor || id !== input.actorId),
        ),
      ),
    ];

    if (!recipientIds.length) return;

    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds }, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        officialEmail: true,
      },
    });

    const notifications = this.notificationService();
    await Promise.all(
      users.map((user) =>
        notifications.createNotificationForUser(user.id, {
          title: input.title,
          message: input.message,
          type: input.type as any,
          priority: priorityToNotification(input.priority),
          data: {
            ticketId: input.ticketId,
            ticketNumber: input.ticketNumber,
            status: input.status,
          },
        }),
      ),
    );

    if (input.email === false) return;

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
      /\/$/,
      "",
    );

    await Promise.all(
      users.map((user) => {
        const to = user.officialEmail?.trim() || user.email?.trim();
        if (!to) return Promise.resolve();
        return EmailQueueService.enqueue<TicketEmailJobData>(
          EMAIL_EVENTS.TICKET_NOTIFICATION,
          {
            to,
            recipientName: `${user.firstName} ${user.lastName}`.trim(),
            eventLabel: input.eventLabel,
            heading: input.title,
            message: input.message,
            ticketNumber: input.ticketNumber,
            ticketSubject: input.ticketSubject,
            status: input.status,
            priority: input.priority,
            actorName: input.actorName,
            comment: input.comment,
            actionUrl: `${frontendUrl}/tickets?ticket=${encodeURIComponent(input.ticketId)}`,
          },
        ).then(() => undefined);
      }),
    );

    setImmediate(() => {
      EmailQueueService.processBatch(20).catch((error) =>
        console.error("Ticket email queue processing failed:", error),
      );
    });
  }

  static async processEmailJob(data: TicketEmailJobData): Promise<void> {
    if (!data?.to || !data?.ticketNumber || !data?.message) {
      throw new Error("Invalid ticket notification email payload");
    }

    const priorityColors: Record<string, string> = {
      LOW: "#64748b",
      MEDIUM: "#2563eb",
      HIGH: "#ea580c",
      CRITICAL: "#dc2626",
    };
    const accent = priorityColors[data.priority] || "#2563eb";
    const subject = `[${data.ticketNumber}] ${data.heading}`;
    const comment = data.comment
      ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid ${accent};border-radius:6px;color:#334155;white-space:pre-wrap">${escapeHtml(data.comment)}</div>`
      : "";

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#0f172a;color:#ffffff;padding:24px 28px">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;font-weight:700">Iris HRMS Helpdesk · ${escapeHtml(data.eventLabel)}</div>
          <h2 style="margin:8px 0 0;font-size:21px;line-height:1.35">${escapeHtml(data.heading)}</h2>
        </div>
        <div style="padding:26px 28px;color:#334155;line-height:1.6">
          <p style="margin-top:0">Hello <strong>${escapeHtml(data.recipientName || "there")}</strong>,</p>
          <p>${escapeHtml(data.message)}</p>
          <div style="margin:20px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
            <div style="font-size:12px;color:#64748b">${escapeHtml(data.ticketNumber)}</div>
            <div style="margin:4px 0 12px;font-size:16px;font-weight:700;color:#0f172a">${escapeHtml(data.ticketSubject)}</div>
            <span style="display:inline-block;margin-right:8px;padding:3px 9px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:11px;font-weight:700">${escapeHtml(data.status.replace(/_/g, " "))}</span>
            <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${accent}15;color:${accent};font-size:11px;font-weight:700">${escapeHtml(data.priority)}</span>
          </div>
          ${comment}
          ${data.actorName ? `<p style="font-size:13px;color:#64748b">Updated by ${escapeHtml(data.actorName)}</p>` : ""}
          <div style="margin-top:24px;text-align:center">
            <a href="${escapeHtml(data.actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:7px;font-weight:700;font-size:14px">Open ticket</a>
          </div>
          <p style="margin:26px 0 0;font-size:11px;color:#94a3b8">This is an automated helpdesk notification. Reply through the ticket workspace so the full conversation stays recorded.</p>
        </div>
      </div>`;

    await EmailService.sendEmail(data.to, subject, html);
  }

  static async processSlaBreaches(): Promise<number> {
    const breachedTickets = await prisma.ticket.findMany({
      where: {
        isEscalated: false,
        resolutionDueAt: { lt: new Date() },
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.WAITING_ON_REQUESTER,
            TicketStatus.ON_HOLD,
          ],
        },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        requesterId: true,
        assignees: { select: { userId: true } },
        companyId: true,
        watchers: { select: { userId: true } },
      },
      take: 100,
    });

    let escalated = 0;
    for (const ticket of breachedTickets) {
      const claimed = await prisma.ticket.updateMany({
        where: { id: ticket.id, isEscalated: false },
        data: { isEscalated: true, lastActivityAt: new Date() },
      });
      if (!claimed.count) continue;

      try {
        const supportUsers = await prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: ["HR", "ADMIN", "SUPERADMIN"] },
            ...(ticket.companyId
              ? {
                  OR: [
                    { role: "SUPERADMIN" },
                    {
                      companyMemberships: {
                        some: { companyId: ticket.companyId },
                      },
                    },
                  ],
                }
              : {}),
          },
          select: { id: true },
        });

        await this.notify({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          ticketSubject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          recipientIds: [
            ticket.requesterId,
            ...ticket.assignees.map((assignee) => assignee.userId),
            ...ticket.watchers.map((watcher) => watcher.userId),
            ...supportUsers.map((user) => user.id),
          ],
          type: NotificationType.TICKET_SLA_BREACHED,
          title: `SLA breached for ${ticket.ticketNumber}`,
          message:
            "This request has passed its resolution target and has been escalated to the helpdesk team.",
          eventLabel: "SLA escalation",
        });

        await prisma.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            action: "SLA_ESCALATED",
            field: "resolutionDueAt",
          },
        });
        escalated++;
      } catch (error) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { isEscalated: false },
        });
        console.error(`Failed to escalate ticket ${ticket.ticketNumber}:`, error);
      }
    }
    return escalated;
  }
}
