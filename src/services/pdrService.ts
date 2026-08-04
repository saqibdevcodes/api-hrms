// services/pdrService.ts
import {
  PdrOverallStatus,
  PdrStatus,
  UserRank,
  Role,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  queuePdrCreatedEmail,
  queuePdrStatusEmail,
} from "../queues/email.jobs";

import { getSocketManager } from "../index";

import { NotificationService } from "../services/notificationService";

type TeamHierarchyNode = {
  pdr: Prisma.PdrGetPayload<{
    include: {
      user: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          userRank: true;
          email: true;
        };
      };
    };
  }>;
  children: TeamHierarchyNode[];
};

const pdrInclude = {
  user: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      officialEmail: true,
      position: true,
      department: true,
    },
  },
  linemanager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      officialEmail: true,
    },
  },
  director: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      officialEmail: true,
    },
  },
  comments: {
    where: {
      commentType: "REVERT",
      isResolved: false,
    },
    orderBy: { datetime: "desc" as const },
  },
};

export interface PdrCreationData {
  userId: string;
  /** Stored on `pdr.linemanager_id`. */
  linemanager_id?: string;
  directorId?: string;
  pdrCycle: string;
  pdrCycleId?: number;
  phaseDeadlines?: PdrPhaseDeadlinesInput;
}

export interface PdrPhaseDeadlineInput {
  noRestriction?: boolean;
  deadline?: string | Date | null;
}

export interface PdrPhaseDeadlinesInput {
  employeeAccess?: PdrPhaseDeadlineInput;
  hrEmployeeApproval?: PdrPhaseDeadlineInput;
  managerAccess?: PdrPhaseDeadlineInput;
  hrManagerApproval?: PdrPhaseDeadlineInput;
  directorReview?: PdrPhaseDeadlineInput;
  employeeAcknowledgement?: PdrPhaseDeadlineInput;
}

export type PdrPhaseKey =
  | "employeeAccess"
  | "hrEmployeeApproval"
  | "managerAccess"
  | "hrManagerApproval"
  | "directorReview"
  | "employeeAcknowledgement";

export interface PdrTransitionData {
  pdrId: number;
  userId: string;
  userRole: string;
  userRank?: string; // Add userRank to interface
  comment?: string;
  /** HR revert message shown in notification email */
  revertMessage?: string;
}

export interface PdrOverallSummary {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
}

export class PdrService {
  private static toDateOrNull(value?: string | Date | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid PDR deadline date");
    }
    return date;
  }

  private static mapPhaseDeadlines(deadlines?: PdrPhaseDeadlinesInput) {
    const stage = (key: keyof PdrPhaseDeadlinesInput) => {
      const value = deadlines?.[key];
      const noRestriction = value?.noRestriction !== false;
      return {
        noRestriction,
        deadline: noRestriction ? null : this.toDateOrNull(value?.deadline),
      };
    };

    const employeeAccess = stage("employeeAccess");
    const hrEmployeeApproval = stage("hrEmployeeApproval");
    const managerAccess = stage("managerAccess");
    const hrManagerApproval = stage("hrManagerApproval");
    const directorReview = stage("directorReview");
    const employeeAcknowledgement = stage("employeeAcknowledgement");

    return {
      employeeAccessNoRestriction: employeeAccess.noRestriction,
      employeeAccessDeadline: employeeAccess.deadline,
      hrEmployeeApprovalNoRestriction: hrEmployeeApproval.noRestriction,
      hrEmployeeApprovalDeadline: hrEmployeeApproval.deadline,
      managerAccessNoRestriction: managerAccess.noRestriction,
      managerAccessDeadline: managerAccess.deadline,
      hrManagerApprovalNoRestriction: hrManagerApproval.noRestriction,
      hrManagerApprovalDeadline: hrManagerApproval.deadline,
      directorReviewNoRestriction: directorReview.noRestriction,
      directorReviewDeadline: directorReview.deadline,
      employeeAcknowledgementNoRestriction: employeeAcknowledgement.noRestriction,
      employeeAcknowledgementDeadline: employeeAcknowledgement.deadline,
    };
  }

  static assertPhaseOpen(pdr: any, phase: PdrPhaseKey) {
    const config: Record<PdrPhaseKey, { noRestriction: string; deadline: string; label: string }> = {
      employeeAccess: {
        noRestriction: "employeeAccessNoRestriction",
        deadline: "employeeAccessDeadline",
        label: "Employee filling",
      },
      hrEmployeeApproval: {
        noRestriction: "hrEmployeeApprovalNoRestriction",
        deadline: "hrEmployeeApprovalDeadline",
        label: "HR employee approval",
      },
      managerAccess: {
        noRestriction: "managerAccessNoRestriction",
        deadline: "managerAccessDeadline",
        label: "Manager filling",
      },
      hrManagerApproval: {
        noRestriction: "hrManagerApprovalNoRestriction",
        deadline: "hrManagerApprovalDeadline",
        label: "HR manager approval",
      },
      directorReview: {
        noRestriction: "directorReviewNoRestriction",
        deadline: "directorReviewDeadline",
        label: "Director review",
      },
      employeeAcknowledgement: {
        noRestriction: "employeeAcknowledgementNoRestriction",
        deadline: "employeeAcknowledgementDeadline",
        label: "Employee acknowledgement",
      },
    };

    const phaseConfig = config[phase];
    if (pdr[phaseConfig.noRestriction]) return;

    const deadline = pdr[phaseConfig.deadline] ? new Date(pdr[phaseConfig.deadline]) : null;
    if (!deadline) return;

    if (new Date() > deadline) {
      throw new Error(`${phaseConfig.label} deadline has passed`);
    }
  }

  static getPhaseForStatus(status: PdrOverallStatus): PdrPhaseKey | null {
    if (
      ([
        PdrOverallStatus.CREATED_BY_HR,
        PdrOverallStatus.EMPLOYEE_PENDING,
        PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
      ] as PdrOverallStatus[]).includes(status)
    ) {
      return "employeeAccess";
    }

    if (
      ([
        PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR,
        PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
      ] as PdrOverallStatus[]).includes(status)
    ) {
      return "hrEmployeeApproval";
    }

    if (
      ([
        PdrOverallStatus.HR_APPROVED_EMPLOYEE,
        PdrOverallStatus.MANAGER_PENDING,
        PdrOverallStatus.HR_REVERTED_TO_MANAGER,
        PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER,
        PdrOverallStatus.MANAGER_REVISING,
      ] as PdrOverallStatus[]).includes(status)
    ) {
      return "managerAccess";
    }

    if (
      ([
        PdrOverallStatus.MANAGER_SUBMITTED_TO_HR,
        PdrOverallStatus.HR_REVIEWING_MANAGER,
      ] as PdrOverallStatus[]).includes(status)
    ) {
      return "hrManagerApproval";
    }

    if (
      ([PdrOverallStatus.HR_APPROVED_MANAGER, PdrOverallStatus.DIRECTOR_REVIEWING] as PdrOverallStatus[]).includes(
        status,
      )
    ) {
      return "directorReview";
    }

    if (
      ([
        PdrOverallStatus.DIRECTOR_REVIEWED,
        PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
        PdrOverallStatus.EMPLOYEE_ACKNOWLEDGED,
      ] as PdrOverallStatus[]).includes(status)
    ) {
      return "employeeAcknowledgement";
    }

    return null;
  }

  static async getCycles() {
    return prisma.pdrCycle.findMany({
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }, { name: "asc" }],
    });
  }

  static async createCycle(data: {
    name: string;
    description?: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    createdBy?: string;
  }) {
    const name = data.name.trim();
    if (!name) {
      throw new Error("Cycle name is required");
    }

    const startDate = this.toDateOrNull(data.startDate);
    const endDate = this.toDateOrNull(data.endDate);

    if (startDate && endDate && startDate > endDate) {
      throw new Error("Cycle start date must be before end date");
    }

    return prisma.pdrCycle.create({
      data: {
        name,
        description: data.description?.trim() || null,
        startDate,
        endDate,
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Split `users.manager` into candidates (single email or comma/semicolon-separated).
   */
  private static parseManagerFieldTokens(managerField: string): string[] {
    return managerField
      .split(/[,;\n\r]+/)
      .map((s) => s.replace(/[\u200B-\u200D\uFEFF]/g, "").trim())
      .filter((s) => s.length > 0);
  }

  /** Substrings from a token that might be an email (`users.email`, `officialEmail`, `personalEmail`). */
  private static emailCandidatesFromToken(token: string): string[] {
    const t = token.trim();
    if (!t) return [];
    const uniq = new Set<string>();
    const extracted = Array.from(
      t.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g),
      (m) => m[0],
    );
    for (const e of extracted) uniq.add(e);
    if (t.includes("@")) uniq.add(t);
    if (uniq.size === 0) uniq.add(t);
    return [...uniq];
  }

  /** Case-insensitive match on login `email`, `officialEmail`, and `personalEmail` (see `employeeController`). */
  private static async lookupUserByEmailAcrossColumns(
    emailLike: string,
  ): Promise<string | undefined> {
    const normalized = emailLike.trim();
    if (!normalized || !normalized.includes("@")) return undefined;
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users
      WHERE LOWER(TRIM(IFNULL(email, ''))) = LOWER(TRIM(${normalized}))
         OR LOWER(TRIM(IFNULL(officialEmail, ''))) = LOWER(TRIM(${normalized}))
         OR LOWER(TRIM(IFNULL(personalEmail, ''))) = LOWER(TRIM(${normalized}))
      LIMIT 1
    `;
    return rows[0]?.id;
  }

  /** Resolve one token to `users.id` (primary key first, then any known email columns, then employeeId). */
  private static async resolveSingleManagerToken(
    token: string,
  ): Promise<string | undefined> {
    if (!token?.trim()) return undefined;
    const t = token.trim();

    const byId = await prisma.user.findUnique({
      where: { id: t },
      select: { id: true },
    });
    if (byId) return byId.id;

    const forEmailAttempts = this.emailCandidatesFromToken(t);
    for (const candidate of forEmailAttempts) {
      const byExact = await prisma.user.findUnique({
        where: { email: candidate },
        select: { id: true },
      });
      if (byExact) return byExact.id;

      const byAnyColumn = await this.lookupUserByEmailAcrossColumns(candidate);
      if (byAnyColumn) return byAnyColumn;
    }

    const byEmp = await prisma.user.findFirst({
      where: { employeeId: t },
      select: { id: true },
    });
    return byEmp?.id;
  }

  /**
   * Map `users.manager` to a `users.id` for `pdr.linemanager_id`.
   * Stores supervisor email(s): one for EMPLOYEE, comma-separated for LINE_MANAGER.
   * Tries every token until one matches (first missing user in list no longer blocks later emails).
   */
  private static async resolveManagerFieldToLineManagerUserId(
    managerField: string | null | undefined,
  ): Promise<string | undefined> {
    if (!managerField?.trim()) return undefined;
    const tokens = this.parseManagerFieldTokens(managerField);
    for (const token of tokens) {
      const id = await this.resolveSingleManagerToken(token);
      if (id) return id;
    }
    return undefined;
  }

  /**
   * Status transition map - defines valid transitions and who can make them
   */
  private static statusTransitions: Record<
    PdrOverallStatus,
    { nextStatus: PdrOverallStatus; allowedRoles: string[] }[]
  > = {
    CREATED_BY_HR: [
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_PENDING,
        allowedRoles: ["EMPLOYEE", "HR"],
      },
    ],
    EMPLOYEE_PENDING: [
      {
        nextStatus: "EMPLOYEE_SUBMITTED_TO_HR",
        allowedRoles: ["EMPLOYEE"],
      },
    ],

    EMPLOYEE_FILLING: [
      {
        nextStatus: "EMPLOYEE_SUBMITTED_TO_HR",
        allowedRoles: ["EMPLOYEE"],
      },
    ],
    EMPLOYEE_SUBMITTED_TO_HR: [
      {
        nextStatus: PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
        allowedRoles: ["HR"],
      },
      {
        nextStatus: PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
        allowedRoles: ["HR"],
      },
    ],
    HR_REVIEWING_EMPLOYEE: [
      {
        nextStatus: PdrOverallStatus.HR_APPROVED_EMPLOYEE,
        allowedRoles: ["HR"],
      },
      {
        nextStatus: PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
        allowedRoles: ["HR"],
      },
    ],
    HR_REVERTED_TO_EMPLOYEE: [
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_PENDING,
        allowedRoles: ["EMPLOYEE"],
      },
    ],
    HR_APPROVED_EMPLOYEE: [
      {
        nextStatus: PdrOverallStatus.MANAGER_PENDING,
        allowedRoles: ["LINE_MANAGER", "HR"],
      },
    ],
    MANAGER_FILLING: [
      {
        nextStatus: PdrOverallStatus.MANAGER_SUBMITTED_TO_HR,
        allowedRoles: ["LINE_MANAGER"],
      },
    ],
    MANAGER_PENDING: [
      {
        nextStatus: PdrOverallStatus.MANAGER_SUBMITTED_TO_HR,
        allowedRoles: ["LINE_MANAGER"],
      },
    ],
    MANAGER_SUBMITTED_TO_HR: [
      {
        nextStatus: PdrOverallStatus.HR_REVIEWING_MANAGER,
        allowedRoles: ["HR"],
      },
      {
        nextStatus: PdrOverallStatus.HR_REVERTED_TO_MANAGER,
        allowedRoles: ["HR"],
      },
    ],
    HR_REVIEWING_MANAGER: [
      {
        nextStatus: PdrOverallStatus.HR_APPROVED_MANAGER,
        allowedRoles: ["HR"],
      },
      {
        nextStatus: PdrOverallStatus.HR_REVERTED_TO_MANAGER,
        allowedRoles: ["HR"],
      },
    ],
    HR_REVERTED_TO_MANAGER: [
      {
        nextStatus: PdrOverallStatus.MANAGER_PENDING,
        allowedRoles: ["LINE_MANAGER"],
      },
    ],
    HR_APPROVED_MANAGER: [
      {
        nextStatus: PdrOverallStatus.DIRECTOR_REVIEWING,
        allowedRoles: ["DIRECTOR", "HR"],
      },
    ],
    DIRECTOR_REVIEWING: [
      {
        nextStatus: PdrOverallStatus.DIRECTOR_REVIEWED,
        allowedRoles: ["DIRECTOR", "HR"],
      },
    ],
    DIRECTOR_REVIEWED: [
      {
        nextStatus: PdrOverallStatus.COMPLETED,
        allowedRoles: ["EMPLOYEE", "HR"],
      },
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_DISAGREED,
        allowedRoles: ["EMPLOYEE", "HR"],
      },
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
        allowedRoles: ["HR"],
      }, // legacy support
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_ACKNOWLEDGED,
        allowedRoles: ["HR"],
      }, // legacy support
    ],
    EMPLOYEE_ACKNOWLEDGING: [
      { nextStatus: PdrOverallStatus.COMPLETED, allowedRoles: ["EMPLOYEE"] },
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_DISAGREED,
        allowedRoles: ["EMPLOYEE"],
      },
    ],
    EMPLOYEE_DISAGREED: [
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER,
        allowedRoles: ["HR"],
      },
    ],
    EMPLOYEE_REVERT_TO_MANAGER: [
      {
        nextStatus: PdrOverallStatus.MANAGER_REVISING,
        allowedRoles: ["LINE_MANAGER"],
      },
    ],
    MANAGER_REVISING: [
      {
        nextStatus: PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
        allowedRoles: ["LINE_MANAGER"],
      },
    ],
    EMPLOYEE_ACKNOWLEDGED: [
      { nextStatus: PdrOverallStatus.COMPLETED, allowedRoles: ["HR"] },
    ],
    COMPLETED: [], // No transitions from completed state
  };

  /**
   * Create PDR for a specific employee
   */
  static async createPdr(data: PdrCreationData, createdBy: string) {
    // Check for duplicate PDR in the same cycle
    const existingPdr = await prisma.pdr.findUnique({
      where: {
        userId_pdr_cycle: {
          userId: data.userId,
          pdr_cycle: data.pdrCycle,
        },
      },
    });

    if (existingPdr) {
      throw new Error(
        `PDR already exists for user ${data.userId} in cycle ${data.pdrCycle}`,
      );
    }

    // Get user details to find line manager and director
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, manager: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Line manager: explicit `linemanager_id` (HR) when it is a real `users.id`;
    // otherwise treat value like `manager` (email / id / employeeId).
    // If omitted, derive from `User.manager` (single or comma-separated emails).
    let linemanagerId = data.linemanager_id?.trim() || undefined;
    if (linemanagerId) {
      const exists = await prisma.user.findUnique({
        where: { id: linemanagerId },
        select: { id: true },
      });
      if (!exists) {
        linemanagerId =
          (await this.resolveSingleManagerToken(linemanagerId)) ?? undefined;
      }
    } else {
      linemanagerId = await this.resolveManagerFieldToLineManagerUserId(
        user.manager,
      );
    }

    // Find director if not provided
    let directorId = data.directorId;
    if (!directorId) {
      const director = await prisma.user.findFirst({
        where: { userRank: UserRank.DIRECTOR },
      });
      directorId = director?.id;
    }

    let cycleId = data.pdrCycleId;
    if (cycleId) {
      const cycle = await prisma.pdrCycle.findUnique({
        where: { id: cycleId },
        select: { id: true, name: true },
      });
      if (!cycle) {
        throw new Error("Selected PDR cycle was not found");
      }
      if (!data.pdrCycle) {
        data.pdrCycle = cycle.name;
      }
    } else {
      const cycle = await prisma.pdrCycle.findUnique({
        where: { name: data.pdrCycle },
        select: { id: true },
      });
      cycleId = cycle?.id;
    }

    const pdr = await prisma.pdr.create({
      data: {
        userId: data.userId,
        pdr_cycle: data.pdrCycle,
        pdrCycleId: cycleId,
        linemanager_id: linemanagerId,
        director_id: directorId,
        overallStatus: PdrOverallStatus.CREATED_BY_HR,
        lastModifiedBy: createdBy,
        ...this.mapPhaseDeadlines(data.phaseDeadlines),
      },
      include: {
        user: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
          },
        },
        linemanager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
          },
        },
        director: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
          },
        },
      },
    });

    await queuePdrCreatedEmail(pdr.id.toString());

    // In-app notification: employee + line manager
    try {
      const socketManager = getSocketManager();
      const notificationService = new NotificationService(socketManager);
      const employeeName = `${pdr.user.firstName} ${pdr.user.lastName}`;
      await notificationService.sendPdrCreatedNotification(
        pdr.user.id,
        employeeName,
        pdr.pdr_cycle ?? "",
        pdr.linemanager?.id,
      );
    } catch (notificationError) {
      console.error("Error sending PDR created notification:", notificationError);
    }

    return pdr;
  }

  /**
   * Create PDRs for all employees in a department or all employees
   */
  static async createBulkPdrs(
    pdrCycle: string,
    createdBy: string,
    departmentId?: string,
    userIds?: string[],
    pdrCycleId?: number,
    phaseDeadlines?: PdrPhaseDeadlinesInput,
  ) {
    const whereClause: any = {
      role: Role.EMPLOYEE,
      isActive: true,
      hasSystemAccess: true,
    };

    if (userIds?.length) {
      whereClause.id = { in: [...new Set(userIds)] };
    }

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const employees = await prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    const results = {
      created: [] as any[],
      skipped: [] as any[],
      errors: [] as any[],
    };

    const users = [] as string[];

    for (const employee of employees) {
      try {
        // `linemanager_id` FK → `users.id`; resolved from `users.manager` in `createPdr`.
        const pdr = await this.createPdr(
          {
            userId: employee.id,
            pdrCycle,
            pdrCycleId,
            phaseDeadlines,
          },
          createdBy,
        );
        results.created.push(pdr);
        users.push(employee.id);

      } catch (error: any) {
        if (error.message.includes("already exists")) {
          results.skipped.push({ userId: employee.id, reason: error.message });
        } else {
          results.errors.push({ userId: employee.id, error: error.message });
        }
      }
    }

      // Individual per-employee notifications are already sent inside createPdr above.



    return results;
  }

  /**
   * Validate if user can perform transition
   */
  static canTransition(
    currentStatus: PdrOverallStatus,
    targetStatus: PdrOverallStatus,
    userRole: string,
    userRank?: string,
  ): boolean {
    const transitions = this.statusTransitions[currentStatus];
    if (!transitions) return false;

    const validTransition = transitions.find(
      (t) => t.nextStatus === targetStatus,
    );
    if (!validTransition) return false;

    // Check if user's role or rank is allowed
    // HR role is allowed for HR tasks
    // HR with LINE_MANAGER rank is also allowed for LINE_MANAGER tasks
    const isHR = userRole === "HR" || userRole === "ADMIN"; // Backward compatibility

    // Check if transition requires HR role
    const requiresHR = validTransition.allowedRoles.includes("HR");
    if (requiresHR && isHR) {
      return true;
    }

    // Check if transition requires LINE_MANAGER and user has LINE_MANAGER rank (even if HR)
    const requiresManager =
      validTransition.allowedRoles.includes("LINE_MANAGER");
    if (requiresManager && userRank === "LINE_MANAGER") {
      return true;
    }

    // Check other roles
    return validTransition.allowedRoles.some(
      (role) => role === userRole || role === userRank,
    );
  }

  /**
   * Transition PDR to next status
   */
  static async transitionStatus(
    data: PdrTransitionData,
    targetStatus: PdrOverallStatus,
  ) {
    const pdr = await prisma.pdr.findUnique({
      where: { id: data.pdrId },
      include: { user: true },
    });

    if (!pdr) {
      throw new Error("PDR not found");
    }

    if (pdr.isCompleted) {
      throw new Error("Cannot modify completed PDR");
    }

    // Validate transition
    const canTransition = this.canTransition(
      pdr.overallStatus,
      targetStatus,
      data.userRole,
      data.userRank, // Pass userRank separately
    );

    if (!canTransition) {
      throw new Error(
        `Invalid transition from ${pdr.overallStatus} to ${targetStatus} for role ${data.userRole}`,
      );
    }

    // Update PDR status and create transition record
    const updatedPdr = await prisma.$transaction(async (tx: any) => {
      // Create transition record
      await tx.pdrStatusTransition.create({
        data: {
          pdrId: data.pdrId,
          fromStatus: pdr.overallStatus,
          toStatus: targetStatus,
          changedBy: data.userId,
          changedByRole: data.userRole,
          comment: data.comment,
        },
      });

      // Update PDR status
      const updated = await tx.pdr.update({
        where: { id: data.pdrId },
        data: {
          overallStatus: targetStatus,
          lastModifiedBy: data.userId,
          isCompleted: targetStatus === PdrOverallStatus.COMPLETED,
          completedAt:
            targetStatus === PdrOverallStatus.COMPLETED
              ? new Date()
              : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              officialEmail: true,
            },
          },
          linemanager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              officialEmail: true,
            },
          },
          director: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              officialEmail: true,
            },
          },
        },
      });

      return updated;
    });

    const fromStatus = pdr.overallStatus;
    await queuePdrStatusEmail({
      pdrId: data.pdrId,
      targetStatus,
      fromStatus,
      revertMessage: data.revertMessage,
    });

    // In-app notifications per target status
    try {
      const socketManager = getSocketManager();
      const notificationService = new NotificationService(socketManager);
      const employeeName = `${updatedPdr.user.firstName} ${updatedPdr.user.lastName}`;
      const cycle = updatedPdr.pdr_cycle;
      const employeeUserId = updatedPdr.user.id;
      const lineManagerUserId = updatedPdr.linemanager?.id;
      const directorUserId = updatedPdr.director?.id;

      switch (targetStatus) {
        case PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR:
          await notificationService.sendPdrSubmittedToHRNotification(
            employeeName,
            "EMPLOYEE",
            cycle,
          );
          break;

        case PdrOverallStatus.MANAGER_SUBMITTED_TO_HR:
          await notificationService.sendPdrSubmittedToHRNotification(
            employeeName,
            "MANAGER",
            cycle,
          );
          break;

        case PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING:
          await notificationService.sendPdrAcknowledgementRequiredNotification(
            employeeUserId,
            cycle,
          );
          break;

        case PdrOverallStatus.HR_APPROVED_EMPLOYEE:
          if (lineManagerUserId) {
            await notificationService.sendPdrEmployeeSectionApprovedNotification(
              lineManagerUserId,
              employeeName,
              cycle,
            );
          }
          break;

        case PdrOverallStatus.HR_APPROVED_MANAGER:
          if (directorUserId) {
            await notificationService.sendPdrManagerSectionApprovedNotification(
              directorUserId,
              employeeName,
              cycle,
            );
          }
          break;

        case PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE:
          await notificationService.sendPdrRevertedToEmployeeNotification(
            employeeUserId,
            cycle,
            data.revertMessage,
          );
          break;

        case PdrOverallStatus.HR_REVERTED_TO_MANAGER:
          if (lineManagerUserId) {
            await notificationService.sendPdrRevertedToManagerNotification(
              lineManagerUserId,
              employeeName,
              cycle,
              data.revertMessage,
            );
          }
          break;

        case PdrOverallStatus.MANAGER_PENDING:
          if (lineManagerUserId) {
            await notificationService.sendPdrManagerPendingNotification(
              lineManagerUserId,
              employeeName,
              cycle,
              false,
            );
          }
          break;

        case PdrOverallStatus.MANAGER_REVISING:
          if (lineManagerUserId) {
            await notificationService.sendPdrManagerPendingNotification(
              lineManagerUserId,
              employeeName,
              cycle,
              true,
            );
          }
          break;

        case PdrOverallStatus.DIRECTOR_REVIEWED:
          await notificationService.sendPdrDirectorReviewedNotification(
            employeeUserId,
            cycle,
          );
          break;

        case PdrOverallStatus.COMPLETED:
          await notificationService.sendPdrCompletedNotification(
            employeeUserId,
            employeeName,
            cycle,
          );
          break;

        case PdrOverallStatus.EMPLOYEE_DISAGREED:
          await notificationService.sendPdrDisagreedNotification(
            employeeName,
            cycle,
          );
          break;

        default:
          break;
      }
    } catch (notificationError) {
      console.error(
        "Error sending PDR transition notification:",
        notificationError,
      );
    }

    return updatedPdr;
  }

  /**
   * Send revert message (HR to Employee/Manager) using PdrComment
   */
  static async sendRevertMessage(
    pdrId: number,
    sentBy: string,
    sentByRole: string,
    sentTo: string,
    message: string,
    currentStatus: string,
  ) {
    const revertComment = await prisma.pdrComment.create({
      data: {
        pdr_id: pdrId,
        employee_type: sentByRole,
        pdr_status_type: currentStatus,
        description: message,
        commentType: "REVERT",
        sentTo: sentTo,
        isResolved: false,
      },
    });

    return revertComment;
  }

  /**
   * Get PDRs for a specific user (based on their role)
   */
  /**
   * PDR counts for a scope (not affected by status/cycle/pagination filters).
   * pending = not started (CREATED_BY_HR)
   * inProgress = all other non-completed PDRs
   */
  static async getPdrSummary(
    scopeWhere: Record<string, unknown>,
  ): Promise<PdrOverallSummary> {
    const [total, completed, pending, inProgress] = await Promise.all([
      prisma.pdr.count({ where: scopeWhere }),
      prisma.pdr.count({ where: { ...scopeWhere, isCompleted: true } }),
      prisma.pdr.count({
        where: {
          ...scopeWhere,
          isCompleted: false,
          overallStatus: {
            in: [PdrOverallStatus.CREATED_BY_HR, PdrOverallStatus.EMPLOYEE_PENDING],
          },
        },
      }),
      prisma.pdr.count({
        where: {
          ...scopeWhere,
          isCompleted: false,
          overallStatus: {
            notIn: [PdrOverallStatus.CREATED_BY_HR, PdrOverallStatus.EMPLOYEE_PENDING],
          },
        },
      }),
    ]);

    return { total, completed, pending, inProgress };
  }

  /**
   * Scope for summary cards — mirrors HR section tabs / Admin employee list.
   * Returns null when summary should not be computed.
   */
  private static buildSummaryScopeWhere(
    userId: string,
    userRole: Role,
    userRank?: UserRank,
    section?: "mine" | "team" | "all",
  ): Record<string, unknown> | null {
    const isHR = userRole === Role.HR;
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPERADMIN;

    if (isHR) {
      if (!section) return null;

      if (section === "mine") {
        return { userId };
      }
      if (section === "team" && userRank === UserRank.LINE_MANAGER) {
        return {
          AND: [{ linemanager_id: userId }, { userId: { not: userId } }],
        };
      }
      if (section === "all") {
        return {};
      }
      return null;
    }

    if (isAdmin) {
      return { userId: { not: userId } };
    }

    return null;
  }

  private static async getAllSubordinateIds(
    managerId: string,
    visited = new Set<string>(),
  ): Promise<string[]> {
    const directReports = await prisma.pdr.findMany({
      where: {
        linemanager_id: managerId,
      },
      select: {
        userId: true,
        user: {
          select: {
            userRank: true,
          },
        },
      },
    });

    const subordinateIds: string[] = [];

    for (const report of directReports) {
      if (visited.has(report.userId)) continue;

      visited.add(report.userId);
      subordinateIds.push(report.userId);

      // Only recurse if the subordinate is also a line manager
      if (report.user?.userRank === UserRank.LINE_MANAGER) {
        const nestedIds = await this.getAllSubordinateIds(
          report.userId,
          visited,
        );

        subordinateIds.push(...nestedIds);
      }
    }

    return subordinateIds;
  }
  private static async getTeamHierarchy(
    managerId: string,
  ): Promise<TeamHierarchyNode[]> {
    const directReports = await prisma.pdr.findMany({
      where: {
        linemanager_id: managerId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userRank: true,
            email: true,
          },
        },
      },
    });

    return Promise.all(
      directReports.map(
        async (pdr): Promise<TeamHierarchyNode> => ({
          pdr,
          children:
            pdr.user?.userRank === UserRank.LINE_MANAGER
              ? await this.getTeamHierarchy(pdr.userId)
              : [],
        }),
      ),
    );
  }

  static async getPdrsForUser(
    userId: string,
    userRole: Role,
    userRank?: UserRank,
    filters?: {
      page?: number;
      limit?: number;
      status?: PdrOverallStatus;
      cycle?: string;
      section?: "mine" | "team" | "all"; // Section filter for HR users
      department?: string; // New department filter
      includeSummary?: boolean;
      search?: string;
    },
  ) {
    const page = filters?.page || 1;

    const rawLimit = filters?.limit || 10;
    const isUnlimited = rawLimit === -1;


    // When unlimited, don't pass skip/take to Prisma
const take = isUnlimited ? undefined : rawLimit;
const skip = isUnlimited ? undefined : (page - 1) * rawLimit;



    // const limit = filters?.limit || 10;


    

    let baseWhereClause: any = {};
    const isHR = userRole === Role.HR; // HR role only
    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPERADMIN;

    const buildCommonFilterAnd = () => {
      const AND: any[] = [];

      if (filters?.status) {
        AND.push({ overallStatus: filters.status });
      }

      if (filters?.cycle) {
        AND.push({ pdr_cycle: filters.cycle });
      }

      if (filters?.department) {
        AND.push({
          user: {
            department: filters.department,
          },
        });
      }

      if (filters?.search?.trim()) {
        const search = filters.search.trim();

        AND.push({
          OR: [
            {
              pdr_cycle: {
                contains: search,
              },
            },
            {
              user: {
                firstName: {
                  contains: search,
                },
              },
            },
            {
              user: {
                lastName: {
                  contains: search,
                },
              },
            },
            {
              user: {
                officialEmail: {
                  contains: search,
                },
              },
            },
          ],
        });
      }

      return AND;
    };

    const applyCommonFilters = (scopeWhere: any) => {
      const commonFilters = buildCommonFilterAnd();

      if (commonFilters.length === 0) {
        return scopeWhere;
      }

      if (!scopeWhere || Object.keys(scopeWhere).length === 0) {
        return { AND: commonFilters };
      }

      return {
        AND: [scopeWhere, ...commonFilters],
      };
    };

    // Section-based filtering for HR users
    if (isHR && filters?.section) {
      if (filters.section === "mine") {
        // Section 1: My PDRs (HR's own PDRs)
        baseWhereClause.userId = userId;
      } else if (
        filters.section === "team" &&
        userRank === UserRank.LINE_MANAGER
      ) {
        // Section 2: Team PDRs (Only for HR with LINE_MANAGER rank)
        // PDRs where HR is the line manager, but exclude HR's own PDRs
        baseWhereClause.AND = [
          { linemanager_id: userId },
          { userId: { not: userId } },
        ];
      } else if (filters.section === "all") {
        // Section 3: All Employee PDRs (HR role functionality)
        // No filter - shows all PDRs
      }
    } else if (isAdmin) {
      // ADMIN can only view all employee PDRs (excluding their own)
      baseWhereClause.userId = { not: userId };
    } else {
      // Non-HR users or HR without section filter - use role-based filtering
      if (
        userRole === Role.EMPLOYEE &&
        userRank !== UserRank.LINE_MANAGER &&
        userRank !== UserRank.DIRECTOR
      ) {
        // Regular employees see only their own PDRs
        baseWhereClause.userId = userId;
      } else if (userRank === UserRank.LINE_MANAGER) {
        // Managers see BOTH their own PDRs AND subordinate PDRs
        if (userRole === Role.EMPLOYEE) {
          const subordinateIds = await this.getAllSubordinateIds(userId);

          baseWhereClause.userId = {
            in: [userId, ...subordinateIds],
          };
        } else if (isHR) {
          // HR with LINE_MANAGER rank: by default show all (unless section specified)
          // No filter - shows all PDRs
        }
      } else if (userRank === UserRank.DIRECTOR) {
        // Directors see their own PDRs AND PDRs where they are director/line manager.
        // Separate lists are also returned below as `directorPdrLists`.
        if (userRole === Role.EMPLOYEE) {
          baseWhereClause.OR = [
            { userId: userId }, // Their own PDRs
            { director_id: userId }, // PDRs where they are the director
            { linemanager_id: userId }, // PDRs where they are the line manager
          ];
        } else if (isHR) {
          // HR with DIRECTOR rank: by default show all
          // No filter - shows all PDRs
        }
      } else if (isHR) {
        // HR role (regardless of rank) sees all PDRs (no additional filter)
        // No filter applied
      }
    }

    const whereClause = applyCommonFilters(baseWhereClause);

    const [pdrs, total] = await Promise.all([
      prisma.pdr.findMany({
        where: whereClause,
        ...(skip !== undefined && { skip }),
        ...(take !== undefined && { take }),
        orderBy: {
          user: {
            firstName: "asc",
          },
        },
        include: pdrInclude,
      }),
      prisma.pdr.count({ where: whereClause }),
    ]);

    let teamHierarchy = [] as TeamHierarchyNode[];

    if (userRank === UserRank.LINE_MANAGER) {
      teamHierarchy = await this.getTeamHierarchy(userId);
    }

    let directorPdrLists:
      | {
          ownPdrs: typeof pdrs;
          directorReviewPdrs: typeof pdrs;
          lineManagerReviewPdrs: typeof pdrs;
        }
      | undefined;

    if (userRole === Role.EMPLOYEE && userRank === UserRank.DIRECTOR) {
      const [ownPdrs, directorReviewPdrs, lineManagerReviewPdrs] =
        await Promise.all([
          prisma.pdr.findMany({
            where: applyCommonFilters({
              userId,
            }),
            orderBy: {
              user: {
                firstName: "asc",
              },
            },
            include: pdrInclude,
          }),
          prisma.pdr.findMany({
            where: applyCommonFilters({
              director_id: userId,
              userId: { not: userId },
            }),
            orderBy: {
              user: {
                firstName: "asc",
              },
            },
            include: pdrInclude,
          }),
          prisma.pdr.findMany({
            where: applyCommonFilters({
              linemanager_id: userId,
              userId: { not: userId },
            }),
            orderBy: {
              user: {
                firstName: "asc",
              },
            },
            include: pdrInclude,
          }),
        ]);

      directorPdrLists = {
        ownPdrs,
        directorReviewPdrs,
        lineManagerReviewPdrs,
      };
    }

    const isPrivilegedViewer =
      userRole === Role.HR ||
      userRole === Role.ADMIN ||
      userRole === Role.SUPERADMIN;

    const result: {
      data: typeof pdrs;
      pagination: {
        currentPage: number;
        totalPages: number;
        totalRecords: number;
        limit: number;
      };
      teamHierarchy?: TeamHierarchyNode[];
      summary?: PdrOverallSummary;
      directorPdrLists?: {
        ownPdrs: typeof pdrs;
        directorReviewPdrs: typeof pdrs;
        lineManagerReviewPdrs: typeof pdrs;
      };
    } = {
      data: pdrs,
      pagination: {
        currentPage: isUnlimited ? 1 : page,
        totalPages: isUnlimited ? 1 : Math.ceil(total / rawLimit),
        totalRecords: total,
        limit: isUnlimited ? total : rawLimit,
      }
    };

    if (isPrivilegedViewer && filters?.includeSummary) {
      const scopeWhere = this.buildSummaryScopeWhere(
        userId,
        userRole,
        userRank,
        filters?.section,
      );
      if (scopeWhere !== null) {
        result.summary = await this.getPdrSummary(scopeWhere);
      }
    }

    if (teamHierarchy.length > 0) {
      result.teamHierarchy = teamHierarchy;
    }

    if (directorPdrLists) {
      result.directorPdrLists = directorPdrLists;
    }

    return result;
  }

  /**
   * Get single PDR with full details
   */
  private static async getLineManagerVisibleEmployeeIds(
    managerUserId: string,
  ): Promise<string[]> {
    const allEmployeeIDs = [managerUserId];
    let managerIDs = [managerUserId];
    while (managerIDs.length > 0) {
      const rows = await prisma.pdr.findMany({
        where: { linemanager_id: { in: managerIDs } },
        select: { userId: true },
      });
      managerIDs = rows.map((r) => r.userId);
      allEmployeeIDs.push(...managerIDs);
    }
    return [...new Set(allEmployeeIDs)];
  }

  /**
   * Get single PDR with full details
   */
  static async getPdrById(
    pdrId: number,
    userId: string,
    userRole: Role,
    userRank?: UserRank,
  ) {
    const pdr = await prisma.pdr.findUnique({
      where: { id: pdrId },
      include: {
        user: true,
        linemanager: true,
        director: true,
        comments: {
          orderBy: { datetime: "desc" },
        },
        personalQualities: {
          orderBy: { datetime: "desc" },
        },
        goalsTasks: {
          orderBy: { datetime: "desc" },
        },
        overallComments: {
          orderBy: { datetime: "desc" },
        },
        transitions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!pdr) {
      throw new Error("PDR not found");
    }

    let canViewAsLineManager = false;

    if (userRank === UserRank.LINE_MANAGER && userRole === Role.EMPLOYEE) {
      const visibleEmployeeIds =
        await this.getLineManagerVisibleEmployeeIds(userId);
      canViewAsLineManager = visibleEmployeeIds.includes(pdr.userId);
    }

    const hasAccess =
      userRole === Role.ADMIN ||
      userRole === Role.HR ||
      pdr.userId === userId ||
      pdr.linemanager_id === userId || // optional; covered by tree anyway
      pdr.director_id === userId ||
      canViewAsLineManager;

    if (!hasAccess) {
      throw new Error("Access denied to this PDR");
    }

    return pdr;
  }

  /**
   * Delete PDR (HR only)
   */
  static async deletePdr(pdrId: number) {
    const pdr = await prisma.pdr.findUnique({
      where: { id: pdrId },
    });

    if (!pdr) {
      throw new Error("PDR not found");
    }

    if (pdr.isCompleted) {
      throw new Error("Cannot delete completed PDR");
    }

    await prisma.$transaction(async (tx) => {
      await tx.pdrComment.deleteMany({ where: { pdr_id: pdrId } });
      await tx.pdrPersonalQuality.deleteMany({ where: { pdr_id: pdrId } });
      await tx.pdrGoalsTask.deleteMany({ where: { pdr_id: pdrId } });
      await tx.pdrOverallComment.deleteMany({ where: { pdr_id: pdrId } });
      await tx.pdrStatusTransition.deleteMany({ where: { pdrId } });
      await tx.pdr.delete({ where: { id: pdrId } });
    });

    return { success: true, message: "PDR deleted successfully" };
  }


  /**
   * Get PDR statistics for dashboard
   */
  static async getPdrStatistics(filters?: {
    cycle?: string;
    departmentId?: string;
  }) {
    const whereClause: any = {};
    if (filters?.cycle) {
      whereClause.pdr_cycle = filters.cycle;
    }

    const [
      total,
      completed,
      pendingAtEmployee,
      pendingAtManager,
      pendingAtDirector,
      pendingAtHR,
    ] = await Promise.all([
      prisma.pdr.count({ where: whereClause }),
      prisma.pdr.count({ where: { ...whereClause, isCompleted: true } }),
      prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: {
            in: [
              PdrOverallStatus.EMPLOYEE_PENDING,
              PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
            ],
          },
        },
      }),
      prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: {
            in: [
              PdrOverallStatus.MANAGER_PENDING,
              PdrOverallStatus.MANAGER_REVISING,
            ],
          },
        },
      }),
      prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: PdrOverallStatus.DIRECTOR_REVIEWING,
        },
      }),
      prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: {
            in: [
              PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
              PdrOverallStatus.HR_REVIEWING_MANAGER,
            ],
          },
        },
      }),
    ]);

    return {
      total,
      completed,
      pending: total - completed,
      pendingAtEmployee,
      pendingAtManager,
      pendingAtDirector,
      pendingAtHR,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : "0",
    };
  }

  /**
   * Save PDR Personal Qualities (Part 1)
   */
  static async savePersonalQualities(data: {
    pdrId: number;
    employeeType: string; // "EMPLOYEE" or "MANAGER"
    ratings: {
      communication: number;
      innovation: number;
      work_ethics: number;
      teamwork: number;
      maturity: number;
      initiative: number;
      self_management: number;
      customer_focus: number;
      sense_of_responsibilities: number;
      accountability: number;
      work_knowledge: number;
      attendance: number;
      leadership: number;
    };
    comment: string;
  }) {
    // Check if entry already exists for this PDR and employee type
    const existing = await prisma.pdrPersonalQuality.findFirst({
      where: {
        pdr_id: data.pdrId,
        employee_type: data.employeeType,
      },
    });

    if (existing) {
      // Update existing
      return await prisma.pdrPersonalQuality.update({
        where: { id: existing.id },
        data: {
          communication: data.ratings.communication,
          innovation: data.ratings.innovation,
          work_ethics: data.ratings.work_ethics,
          teamwork: data.ratings.teamwork,
          maturity: data.ratings.maturity,
          initiative: data.ratings.initiative,
          self_management: data.ratings.self_management,
          customer_focus: data.ratings.customer_focus,
          sense_of_responsibilities: data.ratings.sense_of_responsibilities,
          accountability: data.ratings.accountability,
          work_knowledge: data.ratings.work_knowledge,
          attendance: data.ratings.attendance,
          leadership: data.ratings.leadership,
          comment: data.comment,
          datetime: new Date(),
        },
      });
    } else {
      // Create new
      return await prisma.pdrPersonalQuality.create({
        data: {
          pdr_id: data.pdrId,
          employee_type: data.employeeType,
          communication: data.ratings.communication,
          innovation: data.ratings.innovation,
          work_ethics: data.ratings.work_ethics,
          teamwork: data.ratings.teamwork,
          maturity: data.ratings.maturity,
          initiative: data.ratings.initiative,
          self_management: data.ratings.self_management,
          customer_focus: data.ratings.customer_focus,
          sense_of_responsibilities: data.ratings.sense_of_responsibilities,
          accountability: data.ratings.accountability,
          work_knowledge: data.ratings.work_knowledge,
          attendance: data.ratings.attendance,
          leadership: data.ratings.leadership,
          comment: data.comment,
          datetime: new Date(),
        },
      });
    }
  }

  /**
   * Save PDR Goals and Tasks (Part 2)
   */
  static async saveGoalsTasks(data: {
    pdrId: number;
    goals: {
      id?: number; // For updates
      task: string;
      employee_self_rating: number;
      linemanager_rating: number;
    }[];
  }) {
    // Delete existing goals for this PDR
    await prisma.pdrGoalsTask.deleteMany({
      where: { pdr_id: data.pdrId },
    });

    // Filter out goals with empty tasks
    const validGoals = data.goals.filter(
      (goal) => goal.task && goal.task.trim() !== "",
    );

    // If no valid goals, return empty array
    if (validGoals.length === 0) {
      return [];
    }

    // Create new goals
    const createdGoals = await Promise.all(
      validGoals.map((goal) =>
        prisma.pdrGoalsTask.create({
          data: {
            pdr_id: data.pdrId,
            task: goal.task.trim(),
            employee_self_rating: goal.employee_self_rating || 0,
            linemanager_rating: goal.linemanager_rating || 0,
            datetime: new Date(),
          },
        }),
      ),
    );

    return createdGoals;
  }

  /**
   * Add a general comment to the PDR
   */
  static async addComment(data: {
    pdrId: number;
    employeeType: string;
    pdrStatusType: string;
    description: string;
    commentType?: string;
    sentTo?: string;
  }) {
    return await prisma.pdrComment.create({
      data: {
        pdr_id: data.pdrId,
        employee_type: data.employeeType,
        pdr_status_type: data.pdrStatusType,
        description: data.description,
        commentType: data.commentType || "GENERAL",
        sentTo: data.sentTo || null,
        isResolved: false,
      },
    });
  }

  /**
   * Save PDR Overall Comment
   */
  static async saveOverallComment(data: {
    pdrId: number;
    employeeType: string; // "EMPLOYEE" or "MANAGER"
    comment: string;
  }) {
    // Check if entry already exists
    const existing = await prisma.pdrOverallComment.findFirst({
      where: {
        pdr_id: data.pdrId,
        employee_type: data.employeeType,
      },
    });

    if (existing) {
      return await prisma.pdrOverallComment.update({
        where: { id: existing.id },
        data: {
          comment: data.comment,
          datetime: new Date(),
        },
      });
    } else {
      return await prisma.pdrOverallComment.create({
        data: {
          pdr_id: data.pdrId,
          employee_type: data.employeeType,
          comment: data.comment,
          datetime: new Date(),
        },
      });
    }
  }

  /**
   * Save complete PDR form data
   */
  static async savePdrFormData(data: {
    pdrId: number;
    userId: string;
    employeeType: string; // "EMPLOYEE", "MANAGER", or "DIRECTOR"
    part1?: {
      ratings: {
        communication: number;
        innovation: number;
        work_ethics: number;
        teamwork: number;
        maturity: number;
        initiative: number;
        self_management: number;
        customer_focus: number;
        sense_of_responsibilities: number;
        accountability: number;
        work_knowledge: number;
        attendance: number;
        leadership: number;
      };
      employeeRemarks?: string;
      managerRemarks?: string;
    };
    part2?: {
      goals: {
        id?: number;
        task: string;
        employee_self_rating: number;
        linemanager_rating: number;
      }[];
      employeeRemarks?: string;
      managerRemarks?: string;
    };
    // Manager-only recommendations (not visible to employee)
    managerRecommendations?: {
      trainingRequired: boolean;
      trainingDescription?: string;
      promotionRecommended: boolean;
      promotionDescription?: string;
    };
    // Director's overall PDR comment
    directorOverallComment?: string;
    // PDR timeline (employee selectable)
    pdr_timeline?: string;
    // Optional comment to record along with this save
    comment?: string;
  }) {
    // Prepare update data
    const updateData: any = {
      lastModifiedBy: data.userId,
      lastModifiedAt: new Date(),
    };

    // Add timeline if provided (only employee can set this)
    if (data.pdr_timeline !== undefined && data.employeeType === "EMPLOYEE") {
      updateData.pdr_timeline = data.pdr_timeline;
    }

    // Add manager recommendations if provided
    if (data.managerRecommendations) {
      updateData.training_required =
        data.managerRecommendations.trainingRequired;
      updateData.training_description =
        data.managerRecommendations.trainingDescription || null;
      updateData.promotion_recommended =
        data.managerRecommendations.promotionRecommended;
      updateData.promotion_description =
        data.managerRecommendations.promotionDescription || null;
    }

    // Add director's overall comment if provided
    if (data.directorOverallComment !== undefined) {
      updateData.director_overall_comment = data.directorOverallComment;
    }

    // Update PDR
    await prisma.pdr.update({
      where: { id: data.pdrId },
      data: updateData,
    });

    const results: any = {};

    // Save Part 1 if provided
    if (data.part1) {
      // Save based on the employeeType - this ensures only the correct user's data is saved
      results.personalQualities = await this.savePersonalQualities({
        pdrId: data.pdrId,
        employeeType: data.employeeType,
        ratings: data.part1.ratings,
        comment:
          data.employeeType === "EMPLOYEE"
            ? data.part1.employeeRemarks || ""
            : data.employeeType === "MANAGER"
              ? data.part1.managerRemarks || ""
              : "",
      });
    }

    // Save Part 2 if provided
    if (data.part2) {
      results.goalsTasks = await this.saveGoalsTasks({
        pdrId: data.pdrId,
        goals: data.part2.goals,
      });

      // Save Part 2 overall comments based on employeeType
      if (
        data.employeeType === "EMPLOYEE" &&
        data.part2.employeeRemarks !== undefined
      ) {
        results.employeeOverallComment = await this.saveOverallComment({
          pdrId: data.pdrId,
          employeeType: "EMPLOYEE",
          comment: data.part2.employeeRemarks,
        });
      }

      if (
        data.employeeType === "MANAGER" &&
        data.part2.managerRemarks !== undefined
      ) {
        results.managerOverallComment = await this.saveOverallComment({
          pdrId: data.pdrId,
          employeeType: "MANAGER",
          comment: data.part2.managerRemarks,
        });
      }
    }

    // Save optional comment if provided
    if (data.comment && data.comment.trim()) {
      const pdr = await prisma.pdr.findUnique({ where: { id: data.pdrId } });
      results.comment = await this.addComment({
        pdrId: data.pdrId,
        employeeType: data.employeeType,
        pdrStatusType: pdr?.overallStatus || "UNKNOWN",
        description: data.comment.trim(),
        commentType: "GENERAL",
      });
    }

    return results;
  }


  static async updatePdrDeadlines(
    pdrId: number,
    phaseDeadlines?: PdrPhaseDeadlinesInput,
    pdr_timeline?: string,
  ) {
    const pdr = await prisma.pdr.findUnique({
      where: { id: pdrId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
            department: true,
          },
        },
        linemanager: { select: { id: true } },
        director: { select: { id: true } },
      },
    });
    if (!pdr) {
      throw new Error("PDR not found");
    }
    if (pdr.isCompleted) {
      throw new Error("Cannot modify deadlines on a completed PDR");
    }
    const deadlineData = this.mapPhaseDeadlines(phaseDeadlines);
    const updatedPdr = await prisma.pdr.update({
      where: { id: pdrId },
      data: {
        ...deadlineData,
        ...(pdr_timeline !== undefined && { pdr_timeline }),
        lastModifiedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            officialEmail: true,
            department: true,
          },
        },
      },
    });

    // Notify all parties whose deadline may have changed
    try {
      const socketManager = getSocketManager();
      const notificationService = new NotificationService(socketManager);
      const employeeName = `${pdr.user.firstName} ${pdr.user.lastName}`;
      const recipientIds = [
        pdr.user.id,
        pdr.linemanager?.id,
        pdr.director?.id,
      ].filter((id): id is string => Boolean(id));

      await notificationService.sendPdrDeadlinesUpdatedNotification(
        recipientIds,
        employeeName,
        pdr.pdr_cycle ?? "",
      );
    } catch (notificationError) {
      console.error(
        "Error sending PDR deadlines updated notification:",
        notificationError,
      );
    }

    return updatedPdr;
  }


}
