"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdrService = void 0;
// services/pdrService.ts
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const email_jobs_1 = require("../queues/email.jobs");
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
    orderBy: { datetime: "desc" },
  },
};
class PdrService {
  /**
   * Split `users.manager` into candidates (single email or comma/semicolon-separated).
   */
  static parseManagerFieldTokens(managerField) {
    return managerField
      .split(/[,;\n\r]+/)
      .map((s) => s.replace(/[\u200B-\u200D\uFEFF]/g, "").trim())
      .filter((s) => s.length > 0);
  }
  /** Substrings from a token that might be an email (`users.email`, `officialEmail`, `personalEmail`). */
  static emailCandidatesFromToken(token) {
    const t = token.trim();
    if (!t) return [];
    const uniq = new Set();
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
  static async lookupUserByEmailAcrossColumns(emailLike) {
    const normalized = emailLike.trim();
    if (!normalized || !normalized.includes("@")) return undefined;
    const rows = await prisma_1.prisma.$queryRaw`
      SELECT id FROM users
      WHERE LOWER(TRIM(IFNULL(email, ''))) = LOWER(TRIM(${normalized}))
         OR LOWER(TRIM(IFNULL(officialEmail, ''))) = LOWER(TRIM(${normalized}))
         OR LOWER(TRIM(IFNULL(personalEmail, ''))) = LOWER(TRIM(${normalized}))
      LIMIT 1
    `;
    return rows[0]?.id;
  }
  /** Resolve one token to `users.id` (primary key first, then any known email columns, then employeeId). */
  static async resolveSingleManagerToken(token) {
    if (!token?.trim()) return undefined;
    const t = token.trim();
    const byId = await prisma_1.prisma.user.findUnique({
      where: { id: t },
      select: { id: true },
    });
    if (byId) return byId.id;
    const forEmailAttempts = this.emailCandidatesFromToken(t);
    for (const candidate of forEmailAttempts) {
      const byExact = await prisma_1.prisma.user.findUnique({
        where: { email: candidate },
        select: { id: true },
      });
      if (byExact) return byExact.id;
      const byAnyColumn = await this.lookupUserByEmailAcrossColumns(candidate);
      if (byAnyColumn) return byAnyColumn;
    }
    const byEmp = await prisma_1.prisma.user.findFirst({
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
  static async resolveManagerFieldToLineManagerUserId(managerField) {
    if (!managerField?.trim()) return undefined;
    const tokens = this.parseManagerFieldTokens(managerField);
    for (const token of tokens) {
      const id = await this.resolveSingleManagerToken(token);
      if (id) return id;
    }
    return undefined;
  }
  /**
   * Create PDR for a specific employee
   */
  static async createPdr(data, createdBy) {
    // Check for duplicate PDR in the same cycle
    const existingPdr = await prisma_1.prisma.pdr.findUnique({
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
    const user = await prisma_1.prisma.user.findUnique({
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
      const exists = await prisma_1.prisma.user.findUnique({
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
      const director = await prisma_1.prisma.user.findFirst({
        where: { userRank: client_1.UserRank.DIRECTOR },
      });
      directorId = director?.id;
    }
    const pdr = await prisma_1.prisma.pdr.create({
      data: {
        userId: data.userId,
        pdr_cycle: data.pdrCycle,
        linemanager_id: linemanagerId,
        director_id: directorId,
        overallStatus: client_1.PdrOverallStatus.CREATED_BY_HR,
        lastModifiedBy: createdBy,
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
    await (0, email_jobs_1.queuePdrCreatedEmail)(pdr.id.toString());
    return pdr;
  }
  /**
   * Create PDRs for all employees in a department or all employees
   */
  static async createBulkPdrs(pdrCycle, createdBy, departmentId) {
    const whereClause = {
      role: client_1.Role.EMPLOYEE,
      isActive: true,
      hasSystemAccess: true,
    };
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }
    const employees = await prisma_1.prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });
    const results = {
      created: [],
      skipped: [],
      errors: [],
    };
    for (const employee of employees) {
      try {
        // `linemanager_id` FK → `users.id`; resolved from `users.manager` in `createPdr`.
        const pdr = await this.createPdr(
          {
            userId: employee.id,
            pdrCycle,
          },
          createdBy,
        );
        results.created.push(pdr);
      } catch (error) {
        if (error.message.includes("already exists")) {
          results.skipped.push({ userId: employee.id, reason: error.message });
        } else {
          results.errors.push({ userId: employee.id, error: error.message });
        }
      }
    }
    return results;
  }
  /**
   * Validate if user can perform transition
   */
  static canTransition(currentStatus, targetStatus, userRole, userRank) {
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
  static async transitionStatus(data, targetStatus) {
    const pdr = await prisma_1.prisma.pdr.findUnique({
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
      data.userRank,
    );
    if (!canTransition) {
      throw new Error(
        `Invalid transition from ${pdr.overallStatus} to ${targetStatus} for role ${data.userRole}`,
      );
    }
    // Update PDR status and create transition record
    const updatedPdr = await prisma_1.prisma.$transaction(async (tx) => {
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
          isCompleted: targetStatus === client_1.PdrOverallStatus.COMPLETED,
          completedAt:
            targetStatus === client_1.PdrOverallStatus.COMPLETED
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
    await (0, email_jobs_1.queuePdrStatusEmail)({
      pdrId: data.pdrId,
      targetStatus,
      fromStatus,
      revertMessage: data.revertMessage,
    });
    return updatedPdr;
  }
  /**
   * Send revert message (HR to Employee/Manager) using PdrComment
   */
  static async sendRevertMessage(
    pdrId,
    sentBy,
    sentByRole,
    sentTo,
    message,
    currentStatus,
  ) {
    const revertComment = await prisma_1.prisma.pdrComment.create({
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
  static async getPdrSummary(scopeWhere) {
    const [total, completed, pending, inProgress] = await Promise.all([
      prisma_1.prisma.pdr.count({ where: scopeWhere }),
      prisma_1.prisma.pdr.count({
        where: { ...scopeWhere, isCompleted: true },
      }),
      prisma_1.prisma.pdr.count({
        where: {
          ...scopeWhere,
          isCompleted: false,
          overallStatus: client_1.PdrOverallStatus.CREATED_BY_HR,
        },
      }),
      prisma_1.prisma.pdr.count({
        where: {
          ...scopeWhere,
          isCompleted: false,
          overallStatus: { not: client_1.PdrOverallStatus.CREATED_BY_HR },
        },
      }),
    ]);
    return { total, completed, pending, inProgress };
  }
  /**
   * Scope for summary cards — mirrors HR section tabs / Admin employee list.
   * Returns null when summary should not be computed.
   */
  static buildSummaryScopeWhere(userId, userRole, userRank, section) {
    const isHR = userRole === client_1.Role.HR;
    const isAdmin =
      userRole === client_1.Role.ADMIN || userRole === client_1.Role.SUPERADMIN;
    if (isHR) {
      if (!section) return null;
      if (section === "mine") {
        return { userId };
      }
      if (section === "team" && userRank === client_1.UserRank.LINE_MANAGER) {
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
  static async getAllSubordinateIds(managerId, visited = new Set()) {
    const directReports = await prisma_1.prisma.pdr.findMany({
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
    const subordinateIds = [];
    for (const report of directReports) {
      if (visited.has(report.userId)) continue;
      visited.add(report.userId);
      subordinateIds.push(report.userId);
      // Only recurse if the subordinate is also a line manager
      if (report.user?.userRank === client_1.UserRank.LINE_MANAGER) {
        const nestedIds = await this.getAllSubordinateIds(
          report.userId,
          visited,
        );
        subordinateIds.push(...nestedIds);
      }
    }
    return subordinateIds;
  }
  static async getTeamHierarchy(managerId) {
    const directReports = await prisma_1.prisma.pdr.findMany({
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
      directReports.map(async (pdr) => ({
        pdr,
        children:
          pdr.user?.userRank === client_1.UserRank.LINE_MANAGER
            ? await this.getTeamHierarchy(pdr.userId)
            : [],
      })),
    );
  }
  static async getPdrsForUser(userId, userRole, userRank, filters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;
    let baseWhereClause = {};
    const isHR = userRole === client_1.Role.HR; // HR role only
    const isAdmin =
      userRole === client_1.Role.ADMIN || userRole === client_1.Role.SUPERADMIN;
    const buildCommonFilterAnd = () => {
      const AND = [];
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
    const applyCommonFilters = (scopeWhere) => {
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
        userRank === client_1.UserRank.LINE_MANAGER
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
        userRole === client_1.Role.EMPLOYEE &&
        userRank !== client_1.UserRank.LINE_MANAGER &&
        userRank !== client_1.UserRank.DIRECTOR
      ) {
        // Regular employees see only their own PDRs
        baseWhereClause.userId = userId;
      } else if (userRank === client_1.UserRank.LINE_MANAGER) {
        // Managers see BOTH their own PDRs AND subordinate PDRs
        if (userRole === client_1.Role.EMPLOYEE) {
          const subordinateIds = await this.getAllSubordinateIds(userId);
          baseWhereClause.userId = {
            in: [userId, ...subordinateIds],
          };
        } else if (isHR) {
          // HR with LINE_MANAGER rank: by default show all (unless section specified)
          // No filter - shows all PDRs
        }
      } else if (userRank === client_1.UserRank.DIRECTOR) {
        // Directors see their own PDRs AND PDRs where they are director/line manager.
        // Separate lists are also returned below as `directorPdrLists`.
        if (userRole === client_1.Role.EMPLOYEE) {
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
      prisma_1.prisma.pdr.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          user: {
            firstName: "asc",
          },
        },
        include: pdrInclude,
      }),
      prisma_1.prisma.pdr.count({ where: whereClause }),
    ]);
    let teamHierarchy = [];
    if (userRank === client_1.UserRank.LINE_MANAGER) {
      teamHierarchy = await this.getTeamHierarchy(userId);
    }
    let directorPdrLists;
    if (
      userRole === client_1.Role.EMPLOYEE &&
      userRank === client_1.UserRank.DIRECTOR
    ) {
      const [ownPdrs, directorReviewPdrs, lineManagerReviewPdrs] =
        await Promise.all([
          prisma_1.prisma.pdr.findMany({
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
          prisma_1.prisma.pdr.findMany({
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
          prisma_1.prisma.pdr.findMany({
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
      userRole === client_1.Role.HR ||
      userRole === client_1.Role.ADMIN ||
      userRole === client_1.Role.SUPERADMIN;
    const result = {
      data: pdrs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit,
      },
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
  static async getLineManagerVisibleEmployeeIds(managerUserId) {
    const allEmployeeIDs = [managerUserId];
    let managerIDs = [managerUserId];
    while (managerIDs.length > 0) {
      const rows = await prisma_1.prisma.pdr.findMany({
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
  static async getPdrById(pdrId, userId, userRole, userRank) {
    const pdr = await prisma_1.prisma.pdr.findUnique({
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
    if (
      userRank === client_1.UserRank.LINE_MANAGER &&
      userRole === client_1.Role.EMPLOYEE
    ) {
      const visibleEmployeeIds =
        await this.getLineManagerVisibleEmployeeIds(userId);
      canViewAsLineManager = visibleEmployeeIds.includes(pdr.userId);
    }
    const hasAccess =
      userRole === client_1.Role.ADMIN ||
      userRole === client_1.Role.HR ||
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
  static async deletePdr(pdrId) {
    const pdr = await prisma_1.prisma.pdr.findUnique({
      where: { id: pdrId },
    });
    if (!pdr) {
      throw new Error("PDR not found");
    }
    if (pdr.isCompleted) {
      throw new Error("Cannot delete completed PDR");
    }
    await prisma_1.prisma.$transaction(async (tx) => {
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
  static async getPdrStatistics(filters) {
    const whereClause = {};
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
      prisma_1.prisma.pdr.count({ where: whereClause }),
      prisma_1.prisma.pdr.count({
        where: { ...whereClause, isCompleted: true },
      }),
      prisma_1.prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: {
            in: [
              client_1.PdrOverallStatus.EMPLOYEE_FILLING,
              client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
            ],
          },
        },
      }),
      prisma_1.prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: {
            in: [
              client_1.PdrOverallStatus.MANAGER_FILLING,
              client_1.PdrOverallStatus.MANAGER_REVISING,
            ],
          },
        },
      }),
      prisma_1.prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: client_1.PdrOverallStatus.DIRECTOR_REVIEWING,
        },
      }),
      prisma_1.prisma.pdr.count({
        where: {
          ...whereClause,
          overallStatus: {
            in: [
              client_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
              client_1.PdrOverallStatus.HR_REVIEWING_MANAGER,
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
  static async savePersonalQualities(data) {
    // Check if entry already exists for this PDR and employee type
    const existing = await prisma_1.prisma.pdrPersonalQuality.findFirst({
      where: {
        pdr_id: data.pdrId,
        employee_type: data.employeeType,
      },
    });
    if (existing) {
      // Update existing
      return await prisma_1.prisma.pdrPersonalQuality.update({
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
      return await prisma_1.prisma.pdrPersonalQuality.create({
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
  static async saveGoalsTasks(data) {
    // Delete existing goals for this PDR
    await prisma_1.prisma.pdrGoalsTask.deleteMany({
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
        prisma_1.prisma.pdrGoalsTask.create({
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
  static async addComment(data) {
    return await prisma_1.prisma.pdrComment.create({
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
  static async saveOverallComment(data) {
    // Check if entry already exists
    const existing = await prisma_1.prisma.pdrOverallComment.findFirst({
      where: {
        pdr_id: data.pdrId,
        employee_type: data.employeeType,
      },
    });
    if (existing) {
      return await prisma_1.prisma.pdrOverallComment.update({
        where: { id: existing.id },
        data: {
          comment: data.comment,
          datetime: new Date(),
        },
      });
    } else {
      return await prisma_1.prisma.pdrOverallComment.create({
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
  static async savePdrFormData(data) {
    // Prepare update data
    const updateData = {
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
    await prisma_1.prisma.pdr.update({
      where: { id: data.pdrId },
      data: updateData,
    });
    const results = {};
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
      const pdr = await prisma_1.prisma.pdr.findUnique({
        where: { id: data.pdrId },
      });
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
}
exports.PdrService = PdrService;
/**
 * Status transition map - defines valid transitions and who can make them
 */
PdrService.statusTransitions = {
  CREATED_BY_HR: [
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_FILLING,
      allowedRoles: ["EMPLOYEE", "HR"],
    },
  ],
  EMPLOYEE_FILLING: [
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR,
      allowedRoles: ["EMPLOYEE"],
    },
  ],
  EMPLOYEE_SUBMITTED_TO_HR: [
    {
      nextStatus: client_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
      allowedRoles: ["HR"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
      allowedRoles: ["HR"],
    },
  ],
  HR_REVIEWING_EMPLOYEE: [
    {
      nextStatus: client_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE,
      allowedRoles: ["HR"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
      allowedRoles: ["HR"],
    },
  ],
  HR_REVERTED_TO_EMPLOYEE: [
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_FILLING,
      allowedRoles: ["EMPLOYEE"],
    },
  ],
  HR_APPROVED_EMPLOYEE: [
    {
      nextStatus: client_1.PdrOverallStatus.MANAGER_FILLING,
      allowedRoles: ["LINE_MANAGER", "HR"],
    },
  ],
  MANAGER_FILLING: [
    {
      nextStatus: client_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR,
      allowedRoles: ["LINE_MANAGER"],
    },
  ],
  MANAGER_SUBMITTED_TO_HR: [
    {
      nextStatus: client_1.PdrOverallStatus.HR_REVIEWING_MANAGER,
      allowedRoles: ["HR"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER,
      allowedRoles: ["HR"],
    },
  ],
  HR_REVIEWING_MANAGER: [
    {
      nextStatus: client_1.PdrOverallStatus.HR_APPROVED_MANAGER,
      allowedRoles: ["HR"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER,
      allowedRoles: ["HR"],
    },
  ],
  HR_REVERTED_TO_MANAGER: [
    {
      nextStatus: client_1.PdrOverallStatus.MANAGER_FILLING,
      allowedRoles: ["LINE_MANAGER"],
    },
  ],
  HR_APPROVED_MANAGER: [
    {
      nextStatus: client_1.PdrOverallStatus.DIRECTOR_REVIEWING,
      allowedRoles: ["DIRECTOR", "HR"],
    },
  ],
  DIRECTOR_REVIEWING: [
    {
      nextStatus: client_1.PdrOverallStatus.DIRECTOR_REVIEWED,
      allowedRoles: ["DIRECTOR", "HR"],
    },
  ],
  DIRECTOR_REVIEWED: [
    {
      nextStatus: client_1.PdrOverallStatus.COMPLETED,
      allowedRoles: ["EMPLOYEE", "HR"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_DISAGREED,
      allowedRoles: ["EMPLOYEE", "HR"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
      allowedRoles: ["HR"],
    }, // legacy support
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGED,
      allowedRoles: ["HR"],
    }, // legacy support
  ],
  EMPLOYEE_ACKNOWLEDGING: [
    {
      nextStatus: client_1.PdrOverallStatus.COMPLETED,
      allowedRoles: ["EMPLOYEE"],
    },
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_DISAGREED,
      allowedRoles: ["EMPLOYEE"],
    },
  ],
  EMPLOYEE_DISAGREED: [
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER,
      allowedRoles: ["HR"],
    },
  ],
  EMPLOYEE_REVERT_TO_MANAGER: [
    {
      nextStatus: client_1.PdrOverallStatus.MANAGER_REVISING,
      allowedRoles: ["LINE_MANAGER"],
    },
  ],
  MANAGER_REVISING: [
    {
      nextStatus: client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
      allowedRoles: ["LINE_MANAGER"],
    },
  ],
  EMPLOYEE_ACKNOWLEDGED: [
    { nextStatus: client_1.PdrOverallStatus.COMPLETED, allowedRoles: ["HR"] },
  ],
  COMPLETED: [], // No transitions from completed state
};
