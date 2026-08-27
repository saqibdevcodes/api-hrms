import {
  TicketImpact,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../types/auth";
import { TicketNotificationService } from "../services/ticketNotificationService";
import {
  isTicketSupportUser,
  TicketAccessError,
  TicketService,
} from "../services/ticketService";

const actorName = (req: AuthenticatedRequest): string => {
  const user = req.user;
  if (!user) return "HRMS user";
  const firstName = user.firstName || user.userD?.firstName || user.employee?.firstName || "";
  const lastName = user.lastName || user.userD?.lastName || user.employee?.lastName || "";
  return `${firstName} ${lastName}`.trim() || user.email;
};

const filesFrom = (req: AuthenticatedRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

const assigneeIdsFrom = (value: unknown, legacyValue?: unknown): string[] => {
  const source = value ?? legacyValue;
  if (!source) return [];
  if (Array.isArray(source)) return source.map(String);
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Accept a single legacy id or a comma-separated list.
    }
    return trimmed.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return [];
};

const notifySafely = async (
  payload: Parameters<typeof TicketNotificationService.notify>[0],
) => {
  try {
    await TicketNotificationService.notify(payload);
  } catch (error) {
    console.error("Ticket notification delivery failed:", error);
  }
};

const sendError = (res: Response, error: unknown, fallback: string) => {
  console.error(fallback, error);
  if (error instanceof TicketAccessError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  if ((error as any)?.code === "P2002") {
    return res.status(409).json({ success: false, message: "A record with these details already exists" });
  }
  return res.status(500).json({
    success: false,
    message: fallback,
    error: error instanceof Error ? error.message : "Unknown error",
  });
};

export class TicketController {
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await TicketService.list(req.user!, req.query);
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, "Failed to load tickets");
    }
  }

  static async summary(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await TicketService.summary(req.user!);
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, "Failed to load ticket summary");
    }
  }

  static async meta(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await TicketService.meta(
        req.user!,
        typeof req.query.companyId === "string" ? req.query.companyId : undefined,
      );
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, "Failed to load ticket options");
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await TicketService.getById(req.params.id, req.user!);
      return res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, "Failed to load ticket");
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const subject = String(req.body.subject || "").trim();
      const description = String(req.body.description || "").trim();
      if (subject.length < 5 || subject.length > 180) {
        throw new TicketAccessError("Subject must be between 5 and 180 characters", 400);
      }
      if (description.length < 10 || description.length > 20_000) {
        throw new TicketAccessError("Description must be between 10 and 20,000 characters", 400);
      }

      const priority = Object.values(TicketPriority).includes(req.body.priority)
        ? (req.body.priority as TicketPriority)
        : TicketPriority.MEDIUM;
      const impact = Object.values(TicketImpact).includes(req.body.impact)
        ? (req.body.impact as TicketImpact)
        : TicketImpact.SINGLE_USER;

      const ticket = await TicketService.create(
        req.user!,
        {
          subject,
          description,
          categoryId: req.body.categoryId || undefined,
          customCategory: req.body.customCategory || undefined,
          priority,
          impact,
          contactPreference: req.body.contactPreference || undefined,
          companyId: req.body.companyId || undefined,
          assigneeIds: assigneeIdsFrom(req.body.assigneeIds, req.body.assigneeId),
        },
        filesFrom(req),
      );

      const supportIds = await TicketService.supportRecipientIds(ticket.companyId);
      await Promise.all([
        notifySafely({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          ticketSubject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          recipientIds: [
            ...supportIds,
            ...ticket.assignees.map((assignment) => assignment.userId),
          ],
          actorId: req.user!.id,
          actorName: actorName(req),
          type: "TICKET_CREATED",
          title: `New helpdesk ticket ${ticket.ticketNumber}`,
          message: `${actorName(req)} submitted “${ticket.subject}”.`,
          eventLabel: "New request",
        }),
        notifySafely({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          ticketSubject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          recipientIds: [ticket.requesterId],
          actorId: req.user!.id,
          actorName: actorName(req),
          includeActor: true,
          type: "TICKET_CREATED",
          title: `We received ${ticket.ticketNumber}`,
          message: "Your request has been logged. You will be notified as the helpdesk responds.",
          eventLabel: "Request received",
        }),
      ]);

      return res.status(201).json({
        success: true,
        message: `Ticket ${ticket.ticketNumber} created successfully`,
        data: ticket,
      });
    } catch (error) {
      return sendError(res, error, "Failed to create ticket");
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await TicketService.update(req.params.id, req.user!, req.body);
      const recipients = await TicketService.recipientIds(req.params.id);
      await notifySafely({
        ticketId: data.id,
        ticketNumber: data.ticketNumber,
        ticketSubject: data.subject,
        status: data.status,
        priority: data.priority,
        recipientIds: [
          recipients.requesterId,
          ...recipients.assigneeIds,
          ...recipients.watcherIds,
        ],
        actorId: req.user!.id,
        actorName: actorName(req),
        type: "TICKET_UPDATED",
        title: `${data.ticketNumber} was updated`,
        message: `${actorName(req)} updated the ticket details.`,
        eventLabel: "Ticket updated",
        email: false,
      });
      return res.json({ success: true, message: "Ticket updated", data });
    } catch (error) {
      return sendError(res, error, "Failed to update ticket");
    }
  }

  static async assign(req: AuthenticatedRequest, res: Response) {
    try {
      const previousRecipients = await TicketService.recipientIds(req.params.id);
      const assigneeIds = assigneeIdsFrom(req.body.assigneeIds, req.body.assigneeId);
      const data = await TicketService.assign(req.params.id, req.user!, assigneeIds);
      const recipients = await TicketService.recipientIds(req.params.id);
      const targetIds = [
        recipients.requesterId,
        ...previousRecipients.assigneeIds,
        ...recipients.assigneeIds,
        ...recipients.watcherIds,
      ];
      const assigneeNames = data.assignees
        .map((assignment) =>
          `${assignment.user.firstName} ${assignment.user.lastName}`.trim(),
        )
        .join(", ");
      await notifySafely({
        ticketId: data.id,
        ticketNumber: data.ticketNumber,
        ticketSubject: data.subject,
        status: data.status,
        priority: data.priority,
        recipientIds: targetIds,
        actorId: req.user!.id,
        actorName: actorName(req),
        type: "TICKET_ASSIGNED",
        title: assigneeIds.length ? `${data.ticketNumber} assignment team updated` : `${data.ticketNumber} is unassigned`,
        message: assigneeIds.length
          ? `${assigneeNames || "The selected employees"} ${assigneeIds.length === 1 ? "is" : "are"} now assigned to this request.`
          : "All assignees were removed and the request returned to the triage queue.",
        eventLabel: assigneeIds.length ? "Assignment" : "Queue update",
      });
      return res.json({ success: true, message: "Assignment updated", data });
    } catch (error) {
      return sendError(res, error, "Failed to assign ticket");
    }
  }

  static async changeStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const status = req.body.status as TicketStatus;
      if (!Object.values(TicketStatus).includes(status)) {
        throw new TicketAccessError("Invalid ticket status", 400);
      }
      const data = await TicketService.changeStatus(
        req.params.id,
        req.user!,
        status,
        req.body.resolutionSummary,
        req.body.rootCause,
      );
      const recipients = await TicketService.recipientIds(req.params.id);
      await notifySafely({
        ticketId: data.id,
        ticketNumber: data.ticketNumber,
        ticketSubject: data.subject,
        status: data.status,
        priority: data.priority,
        recipientIds: [
          recipients.requesterId,
          ...recipients.assigneeIds,
          ...recipients.watcherIds,
        ],
        actorId: req.user!.id,
        actorName: actorName(req),
        type: status === TicketStatus.RESOLVED ? "TICKET_RESOLVED" : "TICKET_UPDATED",
        title:
          status === TicketStatus.RESOLVED
            ? `${data.ticketNumber} has been resolved`
            : `${data.ticketNumber} moved to ${status.replace(/_/g, " ").toLowerCase()}`,
        message:
          status === TicketStatus.RESOLVED
            ? data.resolutionSummary || "The helpdesk marked this request as resolved."
            : `${actorName(req)} changed the ticket status.`,
        eventLabel: status === TicketStatus.RESOLVED ? "Resolution" : "Status update",
        comment: status === TicketStatus.RESOLVED ? data.resolutionSummary || undefined : undefined,
      });
      return res.json({ success: true, message: "Ticket status updated", data });
    } catch (error) {
      return sendError(res, error, "Failed to update ticket status");
    }
  }

  static async addComment(req: AuthenticatedRequest, res: Response) {
    try {
      const body = String(req.body.body || "");
      const isInternal = req.body.isInternal === true || req.body.isInternal === "true";
      const result = await TicketService.addComment(
        req.params.id,
        req.user!,
        body,
        isInternal,
        filesFrom(req),
      );
      const ticket = result.ticket;
      const recipients = await TicketService.recipientIds(req.params.id);
      const supportIds = isInternal
        ? await TicketService.supportRecipientIds(ticket.companyId)
        : [];
      await notifySafely({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketSubject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        recipientIds: isInternal
          ? [...supportIds, ...recipients.assigneeIds, ...recipients.watcherIds]
          : [
              recipients.requesterId,
              ...recipients.assigneeIds,
              ...recipients.watcherIds,
            ],
        actorId: req.user!.id,
        actorName: actorName(req),
        type: "TICKET_COMMENT",
        title: `${isInternal ? "Internal note on" : "New reply on"} ${ticket.ticketNumber}`,
        message: `${actorName(req)} added ${isInternal ? "an internal note" : "a reply"}.`,
        eventLabel: isInternal ? "Internal note" : "Conversation update",
        comment: result.comment.body,
      });
      return res.status(201).json({ success: true, message: "Reply added", data: result });
    } catch (error) {
      return sendError(res, error, "Failed to add reply");
    }
  }

  static async rate(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await TicketService.rate(
        req.params.id,
        req.user!,
        Number(req.body.rating),
        req.body.comment,
      );
      return res.json({ success: true, message: "Thank you for your feedback", data });
    } catch (error) {
      return sendError(res, error, "Failed to save feedback");
    }
  }

  static async addWatcher(req: AuthenticatedRequest, res: Response) {
    try {
      const watcherId = String(req.body.userId || req.user!.id);
      const data = await TicketService.setWatcher(req.params.id, req.user!, watcherId, true);
      return res.json({ success: true, message: "Watcher added", data });
    } catch (error) {
      return sendError(res, error, "Failed to add watcher");
    }
  }

  static async removeWatcher(req: AuthenticatedRequest, res: Response) {
    try {
      const watcherId = String(req.params.userId || req.user!.id);
      const data = await TicketService.setWatcher(req.params.id, req.user!, watcherId, false);
      return res.json({ success: true, message: "Watcher removed", data });
    } catch (error) {
      return sendError(res, error, "Failed to remove watcher");
    }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isTicketSupportUser(req.user!)) throw new TicketAccessError("Access denied");
      const name = String(req.body.name || "").trim();
      const slug = String(req.body.slug || name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (name.length < 2 || !slug) throw new TicketAccessError("Category name is required", 400);
      const companyId = req.body.companyId
        ? await TicketService.resolveCompanyId(req.user!, req.body.companyId)
        : null;
      const data = await prisma.ticketCategory.create({
        data: {
          name,
          slug,
          description: String(req.body.description || "").trim() || null,
          color: String(req.body.color || "blue"),
          icon: String(req.body.icon || "life-buoy"),
          supportEmail: String(req.body.supportEmail || "").trim() || null,
          routingDepartment: String(req.body.routingDepartment || "").trim() || null,
          firstResponseMinutes: Math.max(15, Number(req.body.firstResponseMinutes) || 240),
          resolutionMinutes: Math.max(60, Number(req.body.resolutionMinutes) || 2880),
          sortOrder: Number(req.body.sortOrder) || 0,
          companyId,
        },
      });
      return res.status(201).json({ success: true, message: "Category created", data });
    } catch (error) {
      return sendError(res, error, "Failed to create category");
    }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      if (!isTicketSupportUser(req.user!)) throw new TicketAccessError("Access denied");
      const allowed = [
        "name",
        "description",
        "color",
        "icon",
        "supportEmail",
        "routingDepartment",
        "firstResponseMinutes",
        "resolutionMinutes",
        "sortOrder",
        "isActive",
      ];
      const updatePayload: Record<string, unknown> = {};
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) updatePayload[field] = req.body[field];
      });
      if (updatePayload.firstResponseMinutes) updatePayload.firstResponseMinutes = Math.max(15, Number(updatePayload.firstResponseMinutes));
      if (updatePayload.resolutionMinutes) updatePayload.resolutionMinutes = Math.max(60, Number(updatePayload.resolutionMinutes));
      if (updatePayload.sortOrder !== undefined) updatePayload.sortOrder = Number(updatePayload.sortOrder) || 0;
      const category = await prisma.ticketCategory.update({
        where: { id: req.params.categoryId },
        data: updatePayload,
      });
      return res.json({ success: true, message: "Category updated", data: category });
    } catch (error) {
      return sendError(res, error, "Failed to update category");
    }
  }
}
