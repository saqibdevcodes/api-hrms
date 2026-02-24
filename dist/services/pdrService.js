"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdrService = void 0;
// services/pdrService.ts
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class PdrService {
    /**
     * Create PDR for a specific employee
     */
    static async createPdr(data, createdBy) {
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
            throw new Error(`PDR already exists for user ${data.userId} in cycle ${data.pdrCycle}`);
        }
        // Get user details to find line manager and director
        const user = await prisma.user.findUnique({
            where: { id: data.userId },
            select: { id: true, manager: true },
        });
        if (!user) {
            throw new Error("User not found");
        }
        // Find line manager if not provided
        let linemanagerId = data.linemanagerId;
        if (!linemanagerId && user.manager) {
            // The user.manager field stores the manager's USER ID (not employeeId)
            // First, check if it's a direct user ID
            const managerById = await prisma.user.findUnique({
                where: { id: user.manager },
                select: { id: true, userRank: true },
            });
            if (managerById && managerById.userRank === prisma_1.UserRank.LINE_MANAGER) {
                linemanagerId = managerById.id;
            }
            else {
                // If not found by ID, try finding by employeeId (backward compatibility)
                const managerByEmpId = await prisma.user.findFirst({
                    where: {
                        employeeId: user.manager,
                        userRank: prisma_1.UserRank.LINE_MANAGER,
                    },
                });
                linemanagerId = managerByEmpId?.id;
            }
        }
        // Find director if not provided
        let directorId = data.directorId;
        if (!directorId) {
            const director = await prisma.user.findFirst({
                where: { userRank: prisma_1.UserRank.DIRECTOR },
            });
            directorId = director?.id;
        }
        const pdr = await prisma.pdr.create({
            data: {
                userId: data.userId,
                pdr_cycle: data.pdrCycle,
                linemanager_id: linemanagerId,
                director_id: directorId,
                overallStatus: prisma_1.PdrOverallStatus.CREATED_BY_HR,
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
        return pdr;
    }
    /**
     * Create PDRs for all employees in a department or all employees
     */
    static async createBulkPdrs(pdrCycle, createdBy, departmentId) {
        const whereClause = {
            role: prisma_1.Role.EMPLOYEE,
            isActive: true,
        };
        if (departmentId) {
            whereClause.departmentId = departmentId;
        }
        const employees = await prisma.user.findMany({
            where: whereClause,
            select: { id: true, manager: true },
        });
        const results = {
            created: [],
            skipped: [],
            errors: [],
        };
        for (const employee of employees) {
            try {
                const pdr = await this.createPdr({
                    userId: employee.id,
                    pdrCycle,
                }, createdBy);
                results.created.push(pdr);
            }
            catch (error) {
                if (error.message.includes("already exists")) {
                    results.skipped.push({ userId: employee.id, reason: error.message });
                }
                else {
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
        if (!transitions)
            return false;
        const validTransition = transitions.find((t) => t.nextStatus === targetStatus);
        if (!validTransition)
            return false;
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
        const requiresManager = validTransition.allowedRoles.includes("LINE_MANAGER");
        if (requiresManager && userRank === "LINE_MANAGER") {
            return true;
        }
        // Check other roles
        return validTransition.allowedRoles.some((role) => role === userRole || role === userRank);
    }
    /**
     * Transition PDR to next status
     */
    static async transitionStatus(data, targetStatus) {
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
        const canTransition = this.canTransition(pdr.overallStatus, targetStatus, data.userRole, data.userRank);
        if (!canTransition) {
            throw new Error(`Invalid transition from ${pdr.overallStatus} to ${targetStatus} for role ${data.userRole}`);
        }
        // Update PDR status and create transition record
        const updatedPdr = await prisma.$transaction(async (tx) => {
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
                    isCompleted: targetStatus === prisma_1.PdrOverallStatus.COMPLETED,
                    completedAt: targetStatus === prisma_1.PdrOverallStatus.COMPLETED
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
        return updatedPdr;
    }
    /**
     * Send revert message (HR to Employee/Manager) using PdrComment
     */
    static async sendRevertMessage(pdrId, sentBy, sentByRole, sentTo, message, currentStatus) {
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
    static async getPdrsForUser(userId, userRole, userRank, filters) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 10;
        const skip = (page - 1) * limit;
        let whereClause = {};
        const isHR = userRole === prisma_1.Role.HR; // HR role only
        const isAdmin = userRole === prisma_1.Role.ADMIN; // ADMIN role
        // Section-based filtering for HR users
        if (isHR && filters?.section) {
            if (filters.section === "mine") {
                // Section 1: My PDRs (HR's own PDRs)
                whereClause.userId = userId;
            }
            else if (filters.section === "team" &&
                userRank === prisma_1.UserRank.LINE_MANAGER) {
                // Section 2: Team PDRs (Only for HR with LINE_MANAGER rank)
                // PDRs where HR is the line manager, but exclude HR's own PDRs
                whereClause.AND = [
                    { linemanager_id: userId },
                    { userId: { not: userId } },
                ];
            }
            else if (filters.section === "all") {
                // Section 3: All Employee PDRs (HR role functionality)
                // No filter - shows all PDRs
            }
        }
        else if (isAdmin) {
            // ADMIN can only view all employee PDRs (excluding their own)
            whereClause.userId = { not: userId };
        }
        else {
            // Non-HR users or HR without section filter - use role-based filtering
            if (userRole === prisma_1.Role.EMPLOYEE &&
                userRank !== prisma_1.UserRank.LINE_MANAGER &&
                userRank !== prisma_1.UserRank.DIRECTOR) {
                // Regular employees see only their own PDRs
                whereClause.userId = userId;
            }
            else if (userRank === prisma_1.UserRank.LINE_MANAGER) {
                // Managers see BOTH their own PDRs AND subordinate PDRs
                if (userRole === prisma_1.Role.EMPLOYEE) {
                    // Regular manager (not HR)
                    whereClause.OR = [
                        { userId: userId }, // Their own PDRs
                        { linemanager_id: userId }, // PDRs where they are the line manager
                    ];
                }
                else if (isHR) {
                    // HR with LINE_MANAGER rank: by default show all (unless section specified)
                    // No filter - shows all PDRs
                }
            }
            else if (userRank === prisma_1.UserRank.DIRECTOR) {
                // Directors see their own PDRs AND PDRs where they are the director
                if (userRole === prisma_1.Role.EMPLOYEE) {
                    // Regular director (not HR)
                    whereClause.OR = [
                        { userId: userId }, // Their own PDRs
                        { director_id: userId }, // PDRs where they are the director
                    ];
                }
                else if (isHR) {
                    // HR with DIRECTOR rank: by default show all
                    // No filter - shows all PDRs
                }
            }
            else if (isHR) {
                // HR role (regardless of rank) sees all PDRs (no additional filter)
                // No filter applied
            }
        }
        // Additional filters
        if (filters?.status) {
            whereClause.overallStatus = filters.status;
        }
        if (filters?.cycle) {
            whereClause.pdr_cycle = filters.cycle;
        }
        const [pdrs, total] = await Promise.all([
            prisma.pdr.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { creation_date: "desc" },
                include: {
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
                },
            }),
            prisma.pdr.count({ where: whereClause }),
        ]);
        return {
            data: pdrs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                limit,
            },
        };
    }
    /**
     * Get single PDR with full details
     */
    static async getPdrById(pdrId, userId, userRole, userRank) {
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
        // Check access permissions
        // HR has access to all PDRs (can do HR tasks)
        // Also check if user is the owner, manager, or director
        const hasAccess = userRole === prisma_1.Role.ADMIN || // Keep for backward compatibility
            userRole === "HR" || // HR role has access to all PDRs
            pdr.userId === userId ||
            pdr.linemanager_id === userId ||
            pdr.director_id === userId;
        if (!hasAccess) {
            throw new Error("Access denied to this PDR");
        }
        return pdr;
    }
    /**
     * Delete PDR (HR only)
     */
    static async deletePdr(pdrId) {
        const pdr = await prisma.pdr.findUnique({
            where: { id: pdrId },
        });
        if (!pdr) {
            throw new Error("PDR not found");
        }
        if (pdr.isCompleted) {
            throw new Error("Cannot delete completed PDR");
        }
        await prisma.pdr.delete({
            where: { id: pdrId },
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
        const [total, completed, pendingAtEmployee, pendingAtManager, pendingAtDirector, pendingAtHR,] = await Promise.all([
            prisma.pdr.count({ where: whereClause }),
            prisma.pdr.count({ where: { ...whereClause, isCompleted: true } }),
            prisma.pdr.count({
                where: {
                    ...whereClause,
                    overallStatus: {
                        in: [
                            prisma_1.PdrOverallStatus.EMPLOYEE_FILLING,
                            prisma_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
                        ],
                    },
                },
            }),
            prisma.pdr.count({
                where: {
                    ...whereClause,
                    overallStatus: {
                        in: [
                            prisma_1.PdrOverallStatus.MANAGER_FILLING,
                            prisma_1.PdrOverallStatus.MANAGER_REVISING,
                        ],
                    },
                },
            }),
            prisma.pdr.count({
                where: {
                    ...whereClause,
                    overallStatus: prisma_1.PdrOverallStatus.DIRECTOR_REVIEWING,
                },
            }),
            prisma.pdr.count({
                where: {
                    ...whereClause,
                    overallStatus: {
                        in: [
                            prisma_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
                            prisma_1.PdrOverallStatus.HR_REVIEWING_MANAGER,
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
        }
        else {
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
    static async saveGoalsTasks(data) {
        // Delete existing goals for this PDR
        await prisma.pdrGoalsTask.deleteMany({
            where: { pdr_id: data.pdrId },
        });
        // Filter out goals with empty tasks
        const validGoals = data.goals.filter((goal) => goal.task && goal.task.trim() !== "");
        // If no valid goals, return empty array
        if (validGoals.length === 0) {
            return [];
        }
        // Create new goals
        const createdGoals = await Promise.all(validGoals.map((goal) => prisma.pdrGoalsTask.create({
            data: {
                pdr_id: data.pdrId,
                task: goal.task.trim(),
                employee_self_rating: goal.employee_self_rating || 0,
                linemanager_rating: goal.linemanager_rating || 0,
                datetime: new Date(),
            },
        })));
        return createdGoals;
    }
    /**
     * Save PDR Overall Comment
     */
    static async saveOverallComment(data) {
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
        }
        else {
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
        await prisma.pdr.update({
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
                comment: data.employeeType === "EMPLOYEE"
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
            if (data.employeeType === "EMPLOYEE" &&
                data.part2.employeeRemarks !== undefined) {
                results.employeeOverallComment = await this.saveOverallComment({
                    pdrId: data.pdrId,
                    employeeType: "EMPLOYEE",
                    comment: data.part2.employeeRemarks,
                });
            }
            if (data.employeeType === "MANAGER" &&
                data.part2.managerRemarks !== undefined) {
                results.managerOverallComment = await this.saveOverallComment({
                    pdrId: data.pdrId,
                    employeeType: "MANAGER",
                    comment: data.part2.managerRemarks,
                });
            }
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
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_FILLING,
            allowedRoles: ["EMPLOYEE", "HR"],
        },
    ],
    EMPLOYEE_FILLING: [
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR,
            allowedRoles: ["EMPLOYEE"],
        },
    ],
    EMPLOYEE_SUBMITTED_TO_HR: [
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
            allowedRoles: ["HR"],
        },
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
            allowedRoles: ["HR"],
        },
    ],
    HR_REVIEWING_EMPLOYEE: [
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE,
            allowedRoles: ["HR"],
        },
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE,
            allowedRoles: ["HR"],
        },
    ],
    HR_REVERTED_TO_EMPLOYEE: [
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_FILLING,
            allowedRoles: ["EMPLOYEE"],
        },
    ],
    HR_APPROVED_EMPLOYEE: [
        {
            nextStatus: prisma_1.PdrOverallStatus.MANAGER_FILLING,
            allowedRoles: ["LINE_MANAGER", "HR"],
        },
    ],
    MANAGER_FILLING: [
        {
            nextStatus: prisma_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR,
            allowedRoles: ["LINE_MANAGER"],
        },
    ],
    MANAGER_SUBMITTED_TO_HR: [
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_REVIEWING_MANAGER,
            allowedRoles: ["HR"],
        },
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER,
            allowedRoles: ["HR"],
        },
    ],
    HR_REVIEWING_MANAGER: [
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_APPROVED_MANAGER,
            allowedRoles: ["HR"],
        },
        {
            nextStatus: prisma_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER,
            allowedRoles: ["HR"],
        },
    ],
    HR_REVERTED_TO_MANAGER: [
        {
            nextStatus: prisma_1.PdrOverallStatus.MANAGER_FILLING,
            allowedRoles: ["LINE_MANAGER"],
        },
    ],
    HR_APPROVED_MANAGER: [
        {
            nextStatus: prisma_1.PdrOverallStatus.DIRECTOR_REVIEWING,
            allowedRoles: ["DIRECTOR", "HR"],
        },
    ],
    DIRECTOR_REVIEWING: [
        {
            nextStatus: prisma_1.PdrOverallStatus.DIRECTOR_REVIEWED,
            allowedRoles: ["DIRECTOR", "HR"],
        },
    ],
    DIRECTOR_REVIEWED: [
        {
            nextStatus: prisma_1.PdrOverallStatus.COMPLETED,
            allowedRoles: ["EMPLOYEE", "HR"],
        },
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_DISAGREED,
            allowedRoles: ["EMPLOYEE", "HR"],
        },
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
            allowedRoles: ["HR"],
        }, // legacy support
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGED,
            allowedRoles: ["HR"],
        }, // legacy support
    ],
    EMPLOYEE_ACKNOWLEDGING: [
        { nextStatus: prisma_1.PdrOverallStatus.COMPLETED, allowedRoles: ["EMPLOYEE"] },
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_DISAGREED,
            allowedRoles: ["EMPLOYEE"],
        },
    ],
    EMPLOYEE_DISAGREED: [
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER,
            allowedRoles: ["HR"],
        },
    ],
    EMPLOYEE_REVERT_TO_MANAGER: [
        {
            nextStatus: prisma_1.PdrOverallStatus.MANAGER_REVISING,
            allowedRoles: ["LINE_MANAGER"],
        },
    ],
    MANAGER_REVISING: [
        {
            nextStatus: prisma_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING,
            allowedRoles: ["LINE_MANAGER"],
        },
    ],
    EMPLOYEE_ACKNOWLEDGED: [
        { nextStatus: prisma_1.PdrOverallStatus.COMPLETED, allowedRoles: ["HR"] },
    ],
    COMPLETED: [], // No transitions from completed state
};
