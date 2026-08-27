import {
  Prisma,
  TicketImpact,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { UserProfile } from "../types/auth";

export const TICKET_SUPPORT_ROLES = ["HR", "ADMIN", "SUPERADMIN"];
export const CLOSED_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

const DEFAULT_TICKET_CATEGORIES = [
  {
    id: "ticket-category-it",
    name: "IT & Systems",
    slug: "it-systems",
    description: "Hardware, software, account access, network and security support.",
    color: "blue",
    icon: "monitor-cog",
    supportEmail: "it@iriscommunications.com",
    routingDepartment: "Technology",
    firstResponseMinutes: 60,
    resolutionMinutes: 480,
    sortOrder: 10,
  },
  {
    id: "ticket-category-hr",
    name: "People & HR",
    slug: "people-hr",
    description: "Policies, benefits, employee records and workplace concerns.",
    color: "violet",
    icon: "users",
    supportEmail: "hr@iriscommunications.com",
    routingDepartment: "Human Resources",
    firstResponseMinutes: 240,
    resolutionMinutes: 2880,
    sortOrder: 20,
  },
  {
    id: "ticket-category-payroll",
    name: "Payroll & Finance",
    slug: "payroll-finance",
    description: "Salary, deductions, reimbursements and finance queries.",
    color: "emerald",
    icon: "wallet-cards",
    supportEmail: "finance@iriscommunications.com",
    routingDepartment: "Finance",
    firstResponseMinutes: 240,
    resolutionMinutes: 2880,
    sortOrder: 30,
  },
  {
    id: "ticket-category-facilities",
    name: "Facilities & Admin",
    slug: "facilities-admin",
    description: "Office access, equipment, maintenance, transport and supplies.",
    color: "amber",
    icon: "building-2",
    supportEmail: "admin@iriscommunications.com",
    routingDepartment: "Administration",
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
    sortOrder: 40,
  },
  {
    id: "ticket-category-security",
    name: "Security & Compliance",
    slug: "security-compliance",
    description: "Information security, privacy, compliance and incident reporting.",
    color: "rose",
    icon: "shield-alert",
    supportEmail: "security@iriscommunications.com",
    routingDepartment: "Technology",
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
    sortOrder: 50,
  },
  {
    id: "ticket-category-other",
    name: "General Request",
    slug: "general-request",
    description: "Requests that do not fit another service category.",
    color: "slate",
    icon: "life-buoy",
    supportEmail: "support@iriscommunications.com",
    routingDepartment: null,
    firstResponseMinutes: 480,
    resolutionMinutes: 4320,
    sortOrder: 90,
  },
] satisfies Prisma.TicketCategoryCreateInput[];

export const isTicketSupportUser = (user: UserProfile): boolean =>
  TICKET_SUPPORT_ROLES.includes(String(user.role));

export const isTicketLineManager = (user: UserProfile): boolean =>
  String(user.userRank || user.userD?.userRank || "") === "LINE_MANAGER";

const isManagerOf = (managerField: string | null, user: UserProfile): boolean =>
  Boolean(
    managerField
      ?.split(",")
      .map((email) => email.trim().toLowerCase())
      .includes(String(user.email || "").trim().toLowerCase()),
  );

const userSummary = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  officialEmail: true,
  employeeId: true,
  department: true,
  position: true,
  profilePicture: true,
  role: true,
  userRank: true,
} satisfies Prisma.UserSelect;

const ticketListInclude = {
  requester: { select: userSummary },
  assignees: {
    include: { user: { select: userSummary } },
    orderBy: { assignedAt: "asc" as const },
  },
  category: true,
  company: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true, assignees: true, watchers: true } },
} satisfies Prisma.TicketInclude;

const priorityMultiplier: Record<TicketPriority, number> = {
  LOW: 2,
  MEDIUM: 1,
  HIGH: 0.5,
  CRITICAL: 0.25,
};

const impactMultiplier: Record<TicketImpact, number> = {
  SINGLE_USER: 1,
  MULTIPLE_USERS: 0.85,
  DEPARTMENT: 0.7,
  COMPANY: 0.5,
};

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);

const attachmentFromFile = (
  file: Express.Multer.File,
  uploadedById: string,
  ticketId?: string,
) => {
  const cloudUrl = String((file as any).path || "");
  return {
    ...(ticketId ? { ticketId } : {}),
    fileName: file.originalname,
    fileUrl: /^https?:\/\//i.test(cloudUrl)
      ? cloudUrl
      : `/uploads/tickets/${file.filename}`,
    mimeType: file.mimetype,
    fileSize: file.size,
    storageKey: file.filename,
    uploadedById,
  };
};

export class TicketAccessError extends Error {
  constructor(
    message: string,
    public statusCode = 403,
  ) {
    super(message);
  }
}

export class TicketService {
  static async ensureDefaultCategories(): Promise<void> {
    await Promise.all(
      DEFAULT_TICKET_CATEGORIES.map((category) =>
        prisma.ticketCategory.upsert({
          where: { id: category.id },
          update: {},
          create: category,
        }),
      ),
    );
  }

  static async resolveCompanyId(
    user: UserProfile,
    requestedCompanyId?: string,
  ): Promise<string | null> {
    if (requestedCompanyId) {
      const company = await prisma.company.findFirst({
        where: { id: requestedCompanyId, isActive: true },
        select: { id: true },
      });
      if (!company) throw new TicketAccessError("Invalid or inactive company", 400);

      if (!isTicketSupportUser(user)) {
        const membership = await prisma.companyEmployee.findUnique({
          where: {
            companyId_userId: { companyId: requestedCompanyId, userId: user.id },
          },
        });
        if (!membership) {
          throw new TicketAccessError("You are not assigned to this company");
        }
      }
      return company.id;
    }

    const membership = await prisma.companyEmployee.findFirst({
      where: { userId: user.id, company: { isActive: true } },
      orderBy: { assignedAt: "asc" },
      select: { companyId: true },
    });
    if (membership) return membership.companyId;

    const defaultCompany = await prisma.company.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });
    return defaultCompany?.id || null;
  }

  static calculateSla(
    category: { firstResponseMinutes: number; resolutionMinutes: number } | null,
    priority: TicketPriority,
    impact: TicketImpact,
    createdAt = new Date(),
  ) {
    const priorityFactor = priorityMultiplier[priority];
    const impactFactor = impactMultiplier[impact];
    const responseMinutes = Math.max(
      15,
      Math.round((category?.firstResponseMinutes || 240) * priorityFactor * impactFactor),
    );
    const resolutionMinutes = Math.max(
      60,
      Math.round((category?.resolutionMinutes || 2880) * priorityFactor * impactFactor),
    );
    return {
      responseDueAt: addMinutes(createdAt, responseMinutes),
      resolutionDueAt: addMinutes(createdAt, resolutionMinutes),
    };
  }

  static serviceCode(
    category: { slug: string; routingDepartment: string | null } | null,
  ): string {
    const knownCodes: Record<string, string> = {
      "it-systems": "IT",
      "people-hr": "HR",
      "payroll-finance": "PAY",
      "facilities-admin": "FAC",
      "security-compliance": "SEC",
      "general-request": "GEN",
    };
    if (category?.slug && knownCodes[category.slug]) return knownCodes[category.slug];

    const source = category?.routingDepartment || category?.slug || "General";
    const words = source.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    const code =
      words.length > 1
        ? words.map((word) => word[0]).join("")
        : words[0] || "GEN";
    return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "GEN";
  }

  static async generateTicketNumber(
    category: { slug: string; routingDepartment: string | null } | null,
    createdAt = new Date(),
  ): Promise<string> {
    const period = `${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const serviceCode = this.serviceCode(category);
    const sequence = await prisma.ticketSequence.upsert({
      where: { period_serviceCode: { period, serviceCode } },
      create: { period, serviceCode, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });
    return `TKT-${period}-${serviceCode}-${String(sequence.lastNumber).padStart(5, "0")}`;
  }

  static normalizeAssigneeIds(assigneeIds: string[] = []): string[] {
    const normalized = [
      ...new Set(assigneeIds.map((id) => String(id || "").trim()).filter(Boolean)),
    ];
    if (normalized.length > 20) {
      throw new TicketAccessError("A ticket can be assigned to a maximum of 20 people", 400);
    }
    return normalized;
  }

  static async validateAssigneeIds(assigneeIds: string[]): Promise<string[]> {
    const normalized = this.normalizeAssigneeIds(assigneeIds);
    if (!normalized.length) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: normalized }, isActive: true, hasSystemAccess: true },
      select: { id: true },
    });
    if (users.length !== normalized.length) {
      throw new TicketAccessError("One or more selected assignees are unavailable", 400);
    }
    return normalized;
  }

  static accessWhere(user: UserProfile): Prisma.TicketWhereInput {
    if (isTicketSupportUser(user)) return {};
    return {
      OR: [
        { requesterId: user.id },
        { assignees: { some: { userId: user.id } } },
        { watchers: { some: { userId: user.id } } },
        ...(isTicketLineManager(user)
          ? [{ requester: { manager: { contains: user.email } } }]
          : []),
      ],
    };
  }

  static async assertAccess(
    ticketId: string,
    user: UserProfile,
    manage = false,
  ) {
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        requester: { select: { manager: true } },
        assignees: { select: { userId: true } },
        watchers: { select: { userId: true } },
      },
    });
    if (!ticket) throw new TicketAccessError("Ticket not found", 404);

    const isAssignee = ticket.assignees.some((assignee) => assignee.userId === user.id);
    const isRequesterManager = isManagerOf(ticket.requester.manager, user);
    const canManage = isTicketSupportUser(user) || isAssignee;
    const canAssign = canManage || ticket.requesterId === user.id || isRequesterManager;
    const canView =
      canManage ||
      ticket.requesterId === user.id ||
      isRequesterManager ||
      ticket.watchers.some((watcher) => watcher.userId === user.id);

    if (!canView || (manage && !canManage)) {
      throw new TicketAccessError(
        manage
          ? "You do not have permission to manage this ticket"
          : "You do not have access to this ticket",
      );
    }
    return { ticket, canManage, canAssign };
  }

  static async list(user: UserProfile, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(query.limit) || 20));
    const where: Prisma.TicketWhereInput = { ...this.accessWhere(user) };
    const scope = String(query.scope || "all");

    if (scope === "mine") where.requesterId = user.id;
    if (scope === "assigned") where.assignees = { some: { userId: user.id } };
    if (scope === "team" && isTicketLineManager(user)) {
      where.requester = { manager: { contains: user.email } };
    }
    if (scope === "watching") where.watchers = { some: { userId: user.id } };
    if (scope === "unassigned" && isTicketSupportUser(user)) where.assignees = { none: {} };

    if (query.status) {
      const statuses = String(query.status)
        .split(",")
        .filter((value): value is TicketStatus =>
          Object.values(TicketStatus).includes(value as TicketStatus),
        );
      if (statuses.length) where.status = { in: statuses };
    }
    if (query.priority && Object.values(TicketPriority).includes(query.priority as TicketPriority)) {
      where.priority = query.priority as TicketPriority;
    }
    if (query.categoryId) where.categoryId = String(query.categoryId);
    if (query.companyId) where.companyId = String(query.companyId);
    if (query.assigneeId && isTicketSupportUser(user)) {
      where.assignees = { some: { userId: String(query.assigneeId) } };
    }
    if (String(query.overdue) === "true") {
      where.resolutionDueAt = { lt: new Date() };
      where.status = { notIn: CLOSED_TICKET_STATUSES };
    }
    const search = String(query.search || "").trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { ticketNumber: { contains: search } },
            { subject: { contains: search } },
            { description: { contains: search } },
            { requester: { firstName: { contains: search } } },
            { requester: { lastName: { contains: search } } },
          ],
        },
      ];
    }

    const allowedSortFields = new Set([
      "createdAt",
      "updatedAt",
      "lastActivityAt",
      "resolutionDueAt",
      "priority",
      "status",
    ]);
    const sortBy = allowedSortFields.has(String(query.sortBy))
      ? String(query.sortBy)
      : "lastActivityAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: ticketListInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  static async summary(user: UserProfile) {
    const base = this.accessWhere(user);
    const activeStatuses = [
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_ON_REQUESTER,
      TicketStatus.ON_HOLD,
    ];
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [total, open, assignedToMe, requestedByMe, teamTickets, unassigned, overdue, resolvedThisMonth, responseRows] =
      await Promise.all([
        prisma.ticket.count({ where: base }),
        prisma.ticket.count({ where: { AND: [base, { status: { in: activeStatuses } }] } }),
        prisma.ticket.count({
          where: {
            AND: [base, { assignees: { some: { userId: user.id } }, status: { in: activeStatuses } }],
          },
        }),
        prisma.ticket.count({
          where: { AND: [base, { requesterId: user.id, status: { in: activeStatuses } }] },
        }),
        isTicketLineManager(user)
          ? prisma.ticket.count({
              where: {
                requester: { manager: { contains: user.email } },
                status: { in: activeStatuses },
              },
            })
          : Promise.resolve(0),
        isTicketSupportUser(user)
          ? prisma.ticket.count({
              where: { assignees: { none: {} }, status: { in: activeStatuses } },
            })
          : Promise.resolve(0),
        prisma.ticket.count({
          where: {
            AND: [
              base,
              { resolutionDueAt: { lt: new Date() }, status: { in: activeStatuses } },
            ],
          },
        }),
        prisma.ticket.count({
          where: {
            AND: [
              base,
              { resolvedAt: { gte: startOfMonth }, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
            ],
          },
        }),
        prisma.ticket.findMany({
          where: { AND: [base, { firstResponseAt: { not: null } }] },
          select: { createdAt: true, firstResponseAt: true },
          orderBy: { firstResponseAt: "desc" },
          take: 500,
        }),
      ]);

    const avgFirstResponseMinutes = responseRows.length
      ? Math.round(
          responseRows.reduce(
            (sum, row) =>
              sum + ((row.firstResponseAt?.getTime() || row.createdAt.getTime()) - row.createdAt.getTime()) / 60_000,
            0,
          ) / responseRows.length,
        )
      : 0;

    return {
      total,
      open,
      assignedToMe,
      requestedByMe,
      teamTickets,
      unassigned,
      overdue,
      resolvedThisMonth,
      avgFirstResponseMinutes,
    };
  }

  static async meta(user: UserProfile, companyId?: string) {
    await this.ensureDefaultCategories();
    const resolvedCompanyId = companyId
      ? await this.resolveCompanyId(user, companyId)
      : undefined;
    const [categories, assignableUsers, companies] = await Promise.all([
      prisma.ticketCategory.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            ...(resolvedCompanyId ? [{ companyId: resolvedCompanyId }] : []),
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.user.findMany({
        where: { isActive: true, hasSystemAccess: true },
        select: userSummary,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        take: 1000,
      }),
      isTicketSupportUser(user)
        ? prisma.company.findMany({
            where: { isActive: true },
            select: { id: true, name: true, isDefault: true },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          })
        : prisma.company.findMany({
            where: { employees: { some: { userId: user.id } }, isActive: true },
            select: { id: true, name: true, isDefault: true },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          }),
    ]);

    return {
      categories,
      assignableUsers,
      agents: assignableUsers,
      companies,
      statuses: Object.values(TicketStatus),
      priorities: Object.values(TicketPriority),
      impacts: Object.values(TicketImpact),
      canManage: isTicketSupportUser(user),
      canAssign: true,
      isLineManager: isTicketLineManager(user),
    };
  }

  static async getById(
    ticketId: string,
    user: UserProfile,
    allowPostAssignmentResult = false,
  ) {
    let canManage: boolean;
    let canAssign: boolean;
    if (allowPostAssignmentResult) {
      const access = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: {
          requesterId: true,
          requester: { select: { manager: true } },
          assignees: { select: { userId: true } },
        },
      });
      canManage =
        isTicketSupportUser(user) ||
        access.assignees.some((assignee) => assignee.userId === user.id);
      canAssign =
        canManage ||
        access.requesterId === user.id ||
        isManagerOf(access.requester.manager, user);
    } else {
      const access = await this.assertAccess(ticketId, user);
      canManage = access.canManage;
      canAssign = access.canAssign;
    }
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        requester: { select: userSummary },
        assignees: {
          include: {
            user: { select: userSummary },
            assignedBy: { select: userSummary },
          },
          orderBy: { assignedAt: "asc" },
        },
        category: true,
        company: { select: { id: true, name: true } },
        attachments: {
          where: { commentId: null },
          include: { uploadedBy: { select: userSummary } },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          where: canManage ? undefined : { isInternal: false },
          include: {
            author: { select: userSummary },
            attachments: true,
          },
          orderBy: { createdAt: "asc" },
        },
        watchers: {
          include: { user: { select: userSummary } },
          orderBy: { addedAt: "asc" },
        },
        activities: {
          include: { actor: { select: userSummary } },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });
    return {
      ...ticket,
      permissions: {
        canManage,
        canAssign,
        canRate: ticket.requesterId === user.id,
      },
    };
  }

  static async create(
    user: UserProfile,
    data: {
      subject: string;
      description: string;
      categoryId?: string;
      customCategory?: string;
      priority: TicketPriority;
      impact: TicketImpact;
      contactPreference?: string;
      companyId?: string;
      assigneeIds?: string[];
    },
    files: Express.Multer.File[] = [],
  ) {
    const companyId = await this.resolveCompanyId(user, data.companyId);
    const category = data.categoryId
      ? await prisma.ticketCategory.findFirst({
          where: {
            id: data.categoryId,
            isActive: true,
            OR: [{ companyId: null }, ...(companyId ? [{ companyId }] : [])],
          },
        })
      : null;
    if (data.categoryId && !category) {
      throw new TicketAccessError("Selected category is unavailable", 400);
    }
    const assigneeIds = await this.validateAssigneeIds(data.assigneeIds || []);

    const createdAt = new Date();
    const sla = this.calculateSla(category, data.priority, data.impact, createdAt);
    const ticketNumber = await this.generateTicketNumber(category, createdAt);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject: data.subject.trim(),
        description: data.description.trim(),
        categoryId: category?.id,
        customCategory: data.customCategory?.trim() || null,
        priority: data.priority,
        impact: data.impact,
        contactPreference: data.contactPreference || "PORTAL_EMAIL",
        companyId,
        requesterId: user.id,
        assignees: assigneeIds.length
          ? {
              create: assigneeIds.map((userId) => ({
                userId,
                assignedById: user.id,
              })),
            }
          : undefined,
        createdAt,
        lastActivityAt: createdAt,
        ...sla,
        attachments: files.length
          ? {
              create: files.map((file) => attachmentFromFile(file, user.id)),
            }
          : undefined,
        activities: {
          create: {
            actorId: user.id,
            action: "CREATED",
            newValue: "OPEN",
            metadata: { channel: "PORTAL" },
          },
        },
      },
      include: ticketListInclude,
    });
    return ticket;
  }

  static async update(
    ticketId: string,
    user: UserProfile,
    data: Record<string, unknown>,
  ) {
    const { ticket, canManage } = await this.assertAccess(ticketId, user);
    const isRequester = ticket.requesterId === user.id;
    if (!canManage && !isRequester) throw new TicketAccessError("Ticket cannot be edited");
    if (!canManage && CLOSED_TICKET_STATUSES.includes(ticket.status)) {
      throw new TicketAccessError("Closed tickets cannot be edited by the requester", 400);
    }

    const updateData: Prisma.TicketUpdateInput = {};
    const activities: Prisma.TicketActivityCreateWithoutTicketInput[] = [];
    const editableTextFields = ["subject", "description", "contactPreference", "customCategory"];
    for (const field of editableTextFields) {
      if (data[field] !== undefined) {
        const value = String(data[field] || "").trim();
        if ((field === "subject" || field === "description") && !value) {
          throw new TicketAccessError(`${field === "subject" ? "Subject" : "Description"} cannot be empty`, 400);
        }
        (updateData as any)[field] = value || null;
        activities.push({
          actor: { connect: { id: user.id } },
          action: "FIELD_UPDATED",
          field,
          oldValue: String((ticket as any)[field] || ""),
          newValue: value,
        });
      }
    }

    if (data.impact && Object.values(TicketImpact).includes(data.impact as TicketImpact)) {
      updateData.impact = data.impact as TicketImpact;
      activities.push({
        actor: { connect: { id: user.id } },
        action: "FIELD_UPDATED",
        field: "impact",
        oldValue: ticket.impact,
        newValue: String(data.impact),
      });
    }
    if (canManage && data.priority && Object.values(TicketPriority).includes(data.priority as TicketPriority)) {
      updateData.priority = data.priority as TicketPriority;
      activities.push({
        actor: { connect: { id: user.id } },
        action: "FIELD_UPDATED",
        field: "priority",
        oldValue: ticket.priority,
        newValue: String(data.priority),
      });
    }
    if (data.categoryId !== undefined) {
      const categoryId = String(data.categoryId || "") || null;
      if (categoryId) {
        const category = await prisma.ticketCategory.findFirst({
          where: {
            id: categoryId,
            isActive: true,
            OR: [{ companyId: null }, ...(ticket.companyId ? [{ companyId: ticket.companyId }] : [])],
          },
        });
        if (!category) throw new TicketAccessError("Selected category is unavailable", 400);
      }
      updateData.category = categoryId
        ? { connect: { id: categoryId } }
        : { disconnect: true };
      activities.push({
        actor: { connect: { id: user.id } },
        action: "FIELD_UPDATED",
        field: "categoryId",
        oldValue: ticket.categoryId || "",
        newValue: categoryId || "",
      });
    }

    updateData.lastActivityAt = new Date();
    if (activities.length) updateData.activities = { create: activities };
    await prisma.ticket.update({ where: { id: ticketId }, data: updateData });
    return this.getById(ticketId, user);
  }

  static async assign(ticketId: string, user: UserProfile, requestedAssigneeIds: string[]) {
    const { ticket, canAssign } = await this.assertAccess(ticketId, user);
    if (!canAssign) {
      throw new TicketAccessError("You do not have permission to assign this ticket");
    }

    const assigneeIds = await this.validateAssigneeIds(requestedAssigneeIds);
    const previousIds = ticket.assignees.map((assignee) => assignee.userId);
    const addedIds = assigneeIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !assigneeIds.includes(id));

    await prisma.$transaction(async (tx) => {
      if (removedIds.length) {
        await tx.ticketAssignee.deleteMany({
          where: { ticketId, userId: { in: removedIds } },
        });
      }
      if (addedIds.length) {
        await tx.ticketAssignee.createMany({
          data: addedIds.map((userId) => ({ ticketId, userId, assignedById: user.id })),
          skipDuplicates: true,
        });
      }
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          lastActivityAt: new Date(),
          activities: {
            create: {
              actorId: user.id,
              action: assigneeIds.length ? "ASSIGNEES_UPDATED" : "UNASSIGNED",
              field: "assignees",
              oldValue: JSON.stringify(previousIds),
              newValue: JSON.stringify(assigneeIds),
              metadata: { addedIds, removedIds },
            },
          },
        },
      });
    });
    return this.getById(ticketId, user, true);
  }

  static validateStatusTransition(from: TicketStatus, to: TicketStatus): boolean {
    const allowed: Record<TicketStatus, TicketStatus[]> = {
      OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
      IN_PROGRESS: [
        TicketStatus.WAITING_ON_REQUESTER,
        TicketStatus.ON_HOLD,
        TicketStatus.RESOLVED,
        TicketStatus.CANCELLED,
      ],
      WAITING_ON_REQUESTER: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.ON_HOLD,
        TicketStatus.RESOLVED,
        TicketStatus.CANCELLED,
      ],
      ON_HOLD: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
      RESOLVED: [TicketStatus.CLOSED, TicketStatus.OPEN],
      CLOSED: [TicketStatus.OPEN],
      CANCELLED: [TicketStatus.OPEN],
    };
    return from === to || allowed[from].includes(to);
  }

  static async changeStatus(
    ticketId: string,
    user: UserProfile,
    status: TicketStatus,
    resolutionSummary?: string,
    rootCause?: string,
  ) {
    const { ticket, canManage } = await this.assertAccess(ticketId, user);
    const requesterActionAllowed =
      ticket.requesterId === user.id &&
      ((ticket.status === TicketStatus.OPEN && status === TicketStatus.CANCELLED) ||
        ((ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) &&
          status === TicketStatus.OPEN));
    if (!canManage && !requesterActionAllowed) {
      throw new TicketAccessError("You do not have permission to change this status");
    }
    if (!this.validateStatusTransition(ticket.status, status)) {
      throw new TicketAccessError(
        `Cannot move a ticket from ${ticket.status} to ${status}`,
        400,
      );
    }
    if (status === TicketStatus.RESOLVED && !resolutionSummary?.trim()) {
      throw new TicketAccessError("A resolution summary is required", 400);
    }

    const now = new Date();
    const isReopening =
      status === TicketStatus.OPEN && CLOSED_TICKET_STATUSES.includes(ticket.status);
    const category = isReopening && ticket.categoryId
      ? await prisma.ticketCategory.findUnique({ where: { id: ticket.categoryId } })
      : null;
    const reopenedSla = isReopening
      ? this.calculateSla(category, ticket.priority, ticket.impact, now)
      : null;
    const updateData: Prisma.TicketUpdateInput = {
      status,
      lastActivityAt: now,
      resolutionSummary: resolutionSummary?.trim() || ticket.resolutionSummary,
      rootCause: rootCause?.trim() || ticket.rootCause,
      resolvedAt: status === TicketStatus.RESOLVED ? now : status === TicketStatus.OPEN ? null : ticket.resolvedAt,
      closedAt: status === TicketStatus.CLOSED ? now : status === TicketStatus.OPEN ? null : ticket.closedAt,
      reopenedAt: isReopening ? now : ticket.reopenedAt,
      responseDueAt: reopenedSla?.responseDueAt || ticket.responseDueAt,
      resolutionDueAt: reopenedSla?.resolutionDueAt || ticket.resolutionDueAt,
      isEscalated: isReopening ? false : CLOSED_TICKET_STATUSES.includes(status) ? false : ticket.isEscalated,
      firstResponseAt:
        !ticket.firstResponseAt && status === TicketStatus.IN_PROGRESS
          ? now
          : ticket.firstResponseAt,
      activities: {
        create: {
          actor: { connect: { id: user.id } },
          action: isReopening ? "REOPENED" : "STATUS_CHANGED",
          field: "status",
          oldValue: ticket.status,
          newValue: status,
          metadata: resolutionSummary ? { resolutionSummary } : undefined,
        },
      },
    };
    await prisma.ticket.update({ where: { id: ticketId }, data: updateData });
    return this.getById(ticketId, user);
  }

  static async addComment(
    ticketId: string,
    user: UserProfile,
    body: string,
    isInternal: boolean,
    files: Express.Multer.File[] = [],
  ) {
    const { ticket, canManage } = await this.assertAccess(ticketId, user);
    if (isInternal && !canManage) {
      throw new TicketAccessError("Only helpdesk staff can add internal notes");
    }
    if (!body.trim() && !files.length) {
      throw new TicketAccessError("Write a message or attach a file", 400);
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new TicketAccessError("Cancelled tickets cannot receive replies", 400);
    }

    const now = new Date();
    const isFirstSupportResponse = canManage && ticket.requesterId !== user.id && !ticket.firstResponseAt;
    const shouldResume =
      ticket.status === TicketStatus.WAITING_ON_REQUESTER && ticket.requesterId === user.id;

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: user.id,
        body: body.trim() || "Attachment added",
        isInternal,
        attachments: files.length
          ? {
              create: files.map((file) => ({
                ...attachmentFromFile(file, user.id),
                ticketId,
              })),
            }
          : undefined,
      },
      include: { author: { select: userSummary }, attachments: true },
    });

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        lastActivityAt: now,
        firstResponseAt: isFirstSupportResponse ? now : ticket.firstResponseAt,
        status: shouldResume ? TicketStatus.IN_PROGRESS : ticket.status,
        activities: {
          create: {
            actorId: user.id,
            action: isInternal ? "INTERNAL_NOTE_ADDED" : "COMMENT_ADDED",
            metadata: { commentId: comment.id, attachments: files.length },
          },
        },
      },
    });
    return { comment, ticket: await this.getById(ticketId, user) };
  }

  static async rate(
    ticketId: string,
    user: UserProfile,
    rating: number,
    comment?: string,
  ) {
    const { ticket } = await this.assertAccess(ticketId, user);
    if (ticket.requesterId !== user.id) {
      throw new TicketAccessError("Only the requester can rate this ticket");
    }
    if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) {
      throw new TicketAccessError("Resolve the ticket before submitting feedback", 400);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new TicketAccessError("Rating must be between 1 and 5", 400);
    }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        satisfactionRating: rating,
        satisfactionComment: comment?.trim() || null,
        activities: {
          create: {
            actorId: user.id,
            action: "RATED",
            newValue: String(rating),
          },
        },
      },
    });
    return this.getById(ticketId, user);
  }

  static async setWatcher(
    ticketId: string,
    user: UserProfile,
    watcherId: string,
    watching: boolean,
  ) {
    const { canManage } = await this.assertAccess(ticketId, user);
    if (watcherId !== user.id && !canManage) {
      throw new TicketAccessError("Only helpdesk staff can manage other watchers");
    }
    if (watching) {
      const watcher = await prisma.user.findFirst({
        where: { id: watcherId, isActive: true },
        select: { id: true },
      });
      if (!watcher) throw new TicketAccessError("Watcher is unavailable", 400);
      await prisma.ticketWatcher.upsert({
        where: { ticketId_userId: { ticketId, userId: watcherId } },
        update: {},
        create: { ticketId, userId: watcherId },
      });
    } else {
      await prisma.ticketWatcher.deleteMany({ where: { ticketId, userId: watcherId } });
    }
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        actorId: user.id,
        action: watching ? "WATCHER_ADDED" : "WATCHER_REMOVED",
        newValue: watcherId,
      },
    });
    return this.getById(ticketId, user);
  }

  static async recipientIds(ticketId: string): Promise<{
    requesterId: string;
    assigneeIds: string[];
    watcherIds: string[];
  }> {
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: {
        requesterId: true,
        assignees: { select: { userId: true } },
        watchers: { select: { userId: true } },
      },
    });
    return {
      requesterId: ticket.requesterId,
      assigneeIds: ticket.assignees.map((assignee) => assignee.userId),
      watcherIds: ticket.watchers.map((watcher) => watcher.userId),
    };
  }

  static async supportRecipientIds(companyId: string | null): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["HR", "ADMIN", "SUPERADMIN"] },
        ...(companyId
          ? {
              OR: [
                { role: "SUPERADMIN" },
                { companyMemberships: { some: { companyId } } },
              ],
            }
          : {}),
      },
      select: { id: true },
    });
    return users.map((item) => item.id);
  }
}
