"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdrController = void 0;
const client_1 = require("@prisma/client");
const pdrService_1 = require("../services/pdrService");
const prisma_1 = require("../lib/prisma");
class PdrController {
    /**
     * Get all PDRs (filtered by user role)
     */
    static async getAllPdrs(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const page = parseInt(req.query.page || "1", 10);
            const limit = parseInt(req.query.limit || "10", 10);
            const status = req.query.status;
            const cycle = req.query.cycle;
            const section = req.query.section; // New section parameter
            const result = await pdrService_1.PdrService.getPdrsForUser(req.user.id, req.user.role, req.user.userRank, { page, limit, status, cycle, section });
            res.status(200).json(result);
        }
        catch (error) {
            console.error("❌ Error fetching PDRs:", error);
            res.status(500).json({
                message: "Failed to fetch PDR records",
                error: error.message,
            });
        }
    }
    /**
     * Get single PDR by ID
     */
    static async getPdrById(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const pdr = await pdrService_1.PdrService.getPdrById(pdrId, req.user.id, req.user.role, req.user.userRank);
            res.status(200).json({ success: true, data: pdr });
        }
        catch (error) {
            console.error("❌ Error fetching PDR:", error);
            const status = error.message === "Access denied to this PDR" ? 403 : 500;
            res.status(status).json({
                success: false,
                message: error.message || "Failed to fetch PDR",
            });
        }
    }
    /**
     * Create PDR for specific employee (HR only)
     */
    static async createPdr(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const { userId, linemanagerId, directorId, pdrCycle } = req.body;
            if (!linemanagerId) {
                return res.status(400).json({
                    success: false,
                    message: "linemanagerId is required",
                });
            }
            if (!userId || !pdrCycle) {
                return res.status(400).json({
                    success: false,
                    message: "userId and pdrCycle are required",
                });
            }
            const pdr = await pdrService_1.PdrService.createPdr({
                userId,
                linemanager_id: linemanagerId,
                directorId,
                pdrCycle,
            }, req.user.id);
            res.status(201).json({
                success: true,
                message: "PDR created successfully",
                data: pdr,
            });
        }
        catch (error) {
            console.error("❌ Error creating PDR:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to create PDR",
            });
        }
    }
    /**
     * Create bulk PDRs (HR only)
     */
    static async createBulkPdrs(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const { pdrCycle, departmentId } = req.body;
            if (!pdrCycle) {
                return res.status(400).json({
                    success: false,
                    message: "pdrCycle is required",
                });
            }
            const results = await pdrService_1.PdrService.createBulkPdrs(pdrCycle, req.user.id, departmentId);
            res.status(201).json({
                success: true,
                message: "Bulk PDR creation completed",
                data: results,
            });
        }
        catch (error) {
            console.error("❌ Error creating bulk PDRs:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to create bulk PDRs",
            });
        }
    }
    /**
     * Start filling PDR (Employee or Manager)
     */
    static async startFilling(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { comment } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            // Determine target status based on current status
            let targetStatus;
            if (pdr.overallStatus === client_1.PdrOverallStatus.CREATED_BY_HR ||
                pdr.overallStatus === client_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE) {
                targetStatus = client_1.PdrOverallStatus.EMPLOYEE_FILLING;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE ||
                pdr.overallStatus === client_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER) {
                targetStatus = client_1.PdrOverallStatus.MANAGER_FILLING;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER) {
                targetStatus = client_1.PdrOverallStatus.MANAGER_REVISING;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status for starting to fill",
                });
            }
            // Determine effective role: if user is the PDR owner, they act as EMPLOYEE
            // Otherwise, use their actual role/rank
            // HR with LINE_MANAGER rank can fill manager sections (use LINE_MANAGER)
            let effectiveRole;
            if (pdr.userId === req.user.id) {
                // User is filling their own PDR - they are the EMPLOYEE
                effectiveRole = "EMPLOYEE";
            }
            else if (pdr.linemanager_id === req.user.id ||
                (req.user.role === "HR" &&
                    req.user.userRank === "LINE_MANAGER" &&
                    targetStatus === client_1.PdrOverallStatus.MANAGER_FILLING)) {
                // User is the line manager OR HR with LINE_MANAGER rank filling manager section
                // Use LINE_MANAGER for filling manager sections
                effectiveRole = "LINE_MANAGER";
            }
            else {
                // User is director or admin/HR
                effectiveRole = req.user.userRank || req.user.role;
            }
            const updatedPdr = await pdrService_1.PdrService.transitionStatus({
                pdrId,
                userId: req.user.id,
                userRole: effectiveRole,
                userRank: req.user.userRank || undefined,
                comment,
            }, targetStatus);
            res.status(200).json({
                success: true,
                message: "PDR filling started",
                data: updatedPdr,
            });
        }
        catch (error) {
            console.error("❌ Error starting PDR filling:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to start PDR filling",
            });
        }
    }
    /**
     * Submit PDR (Employee or Manager submits to HR)
     */
    static async submitPdr(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { comment } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            // Determine target status
            let targetStatus;
            if (pdr.overallStatus === client_1.PdrOverallStatus.EMPLOYEE_FILLING) {
                targetStatus = client_1.PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.MANAGER_FILLING) {
                targetStatus = client_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.MANAGER_REVISING) {
                // After revising (triggered by employee disagreement), manager sends back to employee for acknowledgment
                targetStatus = client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status for submission",
                });
            }
            // Determine effective role: if user is the PDR owner, they act as EMPLOYEE
            // HR with LINE_MANAGER rank submitting manager section uses LINE_MANAGER role
            let effectiveRole;
            if (pdr.userId === req.user.id) {
                effectiveRole = "EMPLOYEE";
            }
            else if (pdr.linemanager_id === req.user.id ||
                (req.user.role === "HR" &&
                    req.user.userRank === "LINE_MANAGER" &&
                    targetStatus === client_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR)) {
                // User is the line manager OR HR with LINE_MANAGER rank submitting manager section
                effectiveRole = "LINE_MANAGER";
            }
            else {
                effectiveRole = req.user.userRank || req.user.role;
            }
            const updatedPdr = await pdrService_1.PdrService.transitionStatus({
                pdrId,
                userId: req.user.id,
                userRole: effectiveRole,
                userRank: req.user.userRank || undefined,
                comment,
            }, targetStatus);
            res.status(200).json({
                success: true,
                message: "PDR submitted successfully",
                data: updatedPdr,
            });
        }
        catch (error) {
            console.error("❌ Error submitting PDR:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to submit PDR",
            });
        }
    }
    /**
     * HR Approve PDR
     */
    static async approvePdr(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { comment } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            // Determine workflow step
            let targetStatus;
            if (pdr.overallStatus === client_1.PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR) {
                // First transition to reviewing
                await pdrService_1.PdrService.transitionStatus({
                    pdrId,
                    userId: req.user.id,
                    userRole: req.user.role === "HR" ? "HR" : req.user.role,
                    userRank: req.user.userRank || undefined,
                    comment: "Starting review",
                }, client_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE);
                targetStatus = client_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE) {
                targetStatus = client_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR) {
                await pdrService_1.PdrService.transitionStatus({
                    pdrId,
                    userId: req.user.id,
                    userRole: req.user.role === "HR" ? "HR" : req.user.role,
                    userRank: req.user.userRank || undefined,
                    comment: "Starting review",
                }, client_1.PdrOverallStatus.HR_REVIEWING_MANAGER);
                targetStatus = client_1.PdrOverallStatus.HR_APPROVED_MANAGER;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.HR_REVIEWING_MANAGER) {
                targetStatus = client_1.PdrOverallStatus.HR_APPROVED_MANAGER;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.DIRECTOR_REVIEWED) {
                targetStatus = client_1.PdrOverallStatus.COMPLETED;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status for approval",
                });
            }
            // Use HR role for HR tasks (approve, revert, complete)
            // HR role is used regardless of userRank for HR operations
            const updatedPdr = await pdrService_1.PdrService.transitionStatus({
                pdrId,
                userId: req.user.id,
                userRole: req.user.role === "HR" ? "HR" : req.user.role, // Ensure HR role is used for HR tasks
                userRank: req.user.userRank || undefined,
                comment,
            }, targetStatus);
            res.status(200).json({
                success: true,
                message: "PDR approved successfully",
                data: updatedPdr,
            });
        }
        catch (error) {
            console.error("❌ Error approving PDR:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to approve PDR",
            });
        }
    }
    /**
     * HR Revert PDR
     */
    static async revertPdr(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { message, comment } = req.body;
            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: "Revert message is required",
                });
            }
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            let targetStatus;
            let sentTo;
            if (pdr.overallStatus === client_1.PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR ||
                pdr.overallStatus === client_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE) {
                targetStatus = client_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE;
                sentTo = "EMPLOYEE";
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR ||
                pdr.overallStatus === client_1.PdrOverallStatus.HR_REVIEWING_MANAGER) {
                targetStatus = client_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER;
                sentTo = "LINE_MANAGER";
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status for revert. PDR must be submitted or under review.",
                });
            }
            // Create revert message using PdrComment
            await pdrService_1.PdrService.sendRevertMessage(pdrId, req.user.id, req.user.role, sentTo, message, pdr.overallStatus);
            // Transition status
            // Use HR role for revert operations
            const updatedPdr = await pdrService_1.PdrService.transitionStatus({
                pdrId,
                userId: req.user.id,
                userRole: req.user.role === "HR" ? "HR" : req.user.role,
                userRank: req.user.userRank || undefined,
                comment: comment || `Reverted with message: ${message}`,
            }, targetStatus);
            res.status(200).json({
                success: true,
                message: "PDR reverted successfully",
                data: updatedPdr,
            });
        }
        catch (error) {
            console.error("❌ Error reverting PDR:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to revert PDR",
            });
        }
    }
    /**
     * Employee Acknowledge PDR
     */
    static async acknowledgePdr(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { comment, disagree } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            let targetStatus;
            if (pdr.overallStatus === client_1.PdrOverallStatus.DIRECTOR_REVIEWED ||
                pdr.overallStatus === client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING ||
                pdr.overallStatus === client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGED) {
                targetStatus = disagree
                    ? client_1.PdrOverallStatus.EMPLOYEE_DISAGREED
                    : client_1.PdrOverallStatus.COMPLETED;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status for acknowledgment",
                });
            }
            // Employee acknowledges - use EMPLOYEE role regardless of actual role
            const updatedPdr = await pdrService_1.PdrService.transitionStatus({
                pdrId,
                userId: req.user.id,
                userRole: "EMPLOYEE", // Employee acknowledgment always uses EMPLOYEE role
                userRank: req.user.userRank || undefined,
                comment,
            }, targetStatus);
            res.status(200).json({
                success: true,
                message: disagree
                    ? "Disagreement recorded"
                    : "PDR acknowledged successfully",
                data: updatedPdr,
            });
        }
        catch (error) {
            console.error("❌ Error acknowledging PDR:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to acknowledge PDR",
            });
        }
    }
    /**
     * Director Review PDR
     */
    static async directorReview(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const isDirectorLevelAdmin = req.user.role === "ADMIN" && req.user.userRank === "DIRECTOR";
            // ADMIN can only perform director review if they hold DIRECTOR rank
            if (req.user.role === "ADMIN" && !isDirectorLevelAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "ADMIN users without DIRECTOR rank cannot perform director review.",
                });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { comment } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            let targetStatus;
            if (pdr.overallStatus === client_1.PdrOverallStatus.HR_APPROVED_MANAGER) {
                targetStatus = client_1.PdrOverallStatus.DIRECTOR_REVIEWING;
            }
            else if (pdr.overallStatus === client_1.PdrOverallStatus.DIRECTOR_REVIEWING) {
                targetStatus = client_1.PdrOverallStatus.DIRECTOR_REVIEWED;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status for director review",
                });
            }
            // Persist director overall comment if provided
            if (comment && comment.trim()) {
                await prisma_1.prisma.pdr.update({
                    where: { id: pdrId },
                    data: {
                        director_overall_comment: comment.trim(),
                        lastModifiedBy: req.user.id,
                        lastModifiedAt: new Date(),
                    },
                });
            }
            const updatedPdr = await pdrService_1.PdrService.transitionStatus({
                pdrId,
                userId: req.user.id,
                userRole: req.user.userRank || req.user.role,
                userRank: req.user.userRank || undefined,
                comment,
            }, targetStatus);
            res.status(200).json({
                success: true,
                message: "Director review submitted successfully",
                data: updatedPdr,
            });
        }
        catch (error) {
            console.error("❌ Error in director review:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to submit director review",
            });
        }
    }
    /**
     * Delete PDR (HR only)
     */
    static async deletePdr(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const result = await pdrService_1.PdrService.deletePdr(pdrId);
            res.status(200).json(result);
        }
        catch (error) {
            console.error("❌ Error deleting PDR:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to delete PDR",
            });
        }
    }
    /**
     * Get PDR Statistics (for dashboard)
     */
    static async getPdrStatistics(req, res) {
        try {
            const cycle = req.query.cycle;
            const departmentId = req.query.departmentId;
            const stats = await pdrService_1.PdrService.getPdrStatistics({ cycle, departmentId });
            res.status(200).json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            console.error("❌ Error fetching PDR statistics:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch statistics",
            });
        }
    }
    /**
     * Update PDR content (comments, qualities, goals, etc.)
     */
    static async updatePdrContent(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            const { personalQualities, goalsTasks, comments, overallComments } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            if (pdr.isCompleted) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot modify completed PDR",
                });
            }
            const results = {};
            if (personalQualities) {
                results.personalQualities = await pdrService_1.PdrService.savePersonalQualities({
                    pdrId,
                    employeeType: personalQualities.employeeType || req.user.role,
                    ratings: personalQualities.ratings,
                    comment: personalQualities.comment || "",
                });
            }
            if (goalsTasks) {
                results.goalsTasks = await pdrService_1.PdrService.saveGoalsTasks({
                    pdrId,
                    goals: goalsTasks,
                });
            }
            if (overallComments) {
                results.overallComments = await pdrService_1.PdrService.saveOverallComment({
                    pdrId,
                    employeeType: overallComments.employeeType || req.user.role,
                    comment: overallComments.comment,
                });
            }
            if (comments) {
                results.comment = await pdrService_1.PdrService.addComment({
                    pdrId,
                    employeeType: req.user.userRank || req.user.role,
                    pdrStatusType: pdr.overallStatus,
                    description: comments,
                });
            }
            res.status(200).json({
                success: true,
                message: "PDR content updated successfully",
                data: results,
            });
        }
        catch (error) {
            console.error("❌ Error updating PDR content:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to update PDR content",
            });
        }
    }
    /**
     * Save PDR form data (Part 1 and Part 2)
     */
    static async savePdrFormData(req, res) {
        try {
            console.log("🔵 Incoming PDR Save Request:");
            console.log("Params:", req.params);
            console.log("User:", req.user);
            console.log("Body:", req.body);
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const pdrId = parseInt(req.params.id, 10);
            // const { employeeType, part1, part2, managerRecommendations, directorOverallComment } = req.body;
            const { employeeType, part1, part2, managerRecommendations, directorOverallComment, pdr_timeline, comment, } = req.body;
            const pdr = await prisma_1.prisma.pdr.findUnique({ where: { id: pdrId } });
            if (!pdr) {
                return res.status(404).json({
                    success: false,
                    message: "PDR not found",
                });
            }
            // Determine employee type based on user role
            let actualEmployeeType = employeeType;
            if (!actualEmployeeType) {
                if (pdr.userId === req.user.id) {
                    actualEmployeeType = "EMPLOYEE";
                }
                else if (pdr.linemanager_id === req.user.id) {
                    actualEmployeeType = "MANAGER";
                }
            }
            // Save form data
            const result = await pdrService_1.PdrService.savePdrFormData({
                pdrId,
                userId: req.user.id,
                employeeType: actualEmployeeType,
                part1,
                part2,
                managerRecommendations,
                directorOverallComment,
                pdr_timeline,
                comment,
            });
            res.status(200).json({
                success: true,
                message: "PDR form data saved successfully",
                data: result,
            });
        }
        catch (error) {
            console.error("❌ Error saving PDR form data:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to save PDR form data",
            });
        }
    }
    /**
     * Resolve a PDR comment (mark as addressed)
     */
    static async resolveComment(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            const commentId = parseInt(req.params.commentId, 10);
            const comment = await prisma_1.prisma.pdrComment.update({
                where: { id: commentId },
                data: {
                    isResolved: true,
                    resolvedAt: new Date(),
                },
            });
            res.status(200).json({
                success: true,
                message: "Comment marked as resolved",
                data: comment,
            });
        }
        catch (error) {
            console.error("❌ Error resolving comment:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to resolve comment",
            });
        }
    }
}
exports.PdrController = PdrController;
