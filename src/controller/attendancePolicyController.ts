import { Request, Response } from "express";
import { AttendancePolicyService } from "../services/attendancePolicyService";
import { prisma } from "../lib/prisma";

export class AttendancePolicyController {
  /**
   * Get active attendance policy settings
   */
  static async getPolicy(req: Request, res: Response) {
    try {
      const policy = await AttendancePolicyService.getActivePolicy(true);
      res.json({
        success: true,
        message: "Attendance policy retrieved successfully",
        data: policy,
      });
    } catch (error: any) {
      console.error("Error fetching attendance policy:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch attendance policy",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Update attendance policy settings
   */
  static async updatePolicy(req: Request, res: Response) {
    try {
      const currentPolicy = await AttendancePolicyService.getActivePolicy();
      const updated = await AttendancePolicyService.updatePolicy(
        currentPolicy.id,
        req.body
      );

      res.json({
        success: true,
        message: "Attendance policy updated successfully",
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating attendance policy:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update attendance policy",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Restore default attendance policy settings
   */
  static async restoreDefaults(req: Request, res: Response) {
    try {
      const currentPolicy = await AttendancePolicyService.getActivePolicy();
      const updated = await AttendancePolicyService.updatePolicy(
        currentPolicy.id,
        {
          policyName: "Iris Communications Attendance & Punctuality Policy",
          scopeDescription:
            "Applies to all Iris Communications employees to record attendance, punctuality, and discipline across Head Office and Regional Offices.",
          gracePeriodMinutes: 15,
          monthlyLateArrivalsAllowed: 3,
          lateArrivalThresholdMinutes: 60,
          monthlyEarlyOutAllowed: 1,
          earlyOutThresholdMinutes: 60,
          lateExceededDeduction: "HALF_DAY_LEAVE",
          earlyOutExceededDeduction: "HALF_DAY_LEAVE",
          missingBothPunchesAction: "ABSENT",
          missingOnePunchAction: "LATE_OR_EARLY",
          deductSalaryOnUnjustifiedAbsent: true,
          mandatoryBiometric: true,
          allowedBiometricMethods: "THUMB_FACE",
          trackHeadAndRegionalOffices: true,
          regularisationDeadlineDays: 1,
          regularisationNotifyHR: true,
          regularisationNotifyIT: true,
          regularisationNotifyHOD: true,
          regularisationNotifyLineManager: true,
          hrEmails: "hr@iriscommunications.com.pk",
          itEmails: "it@iriscommunications.com.pk",
          allowTechnicalIssueRegularisation: true,
          allowFieldWorkRegularisation: true,
          isActive: true,
        }
      );

      res.json({
        success: true,
        message: "Attendance policy reset to Iris Communications defaults",
        data: updated,
      });
    } catch (error: any) {
      console.error("Error restoring default policy:", error);
      res.status(500).json({
        success: false,
        message: "Failed to restore default attendance policy",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Get all Department Shift Timings
   */
  static async getDepartmentTimings(req: Request, res: Response) {
    try {
      const timings = await AttendancePolicyService.getAllDepartmentTimings();
      res.json({
        success: true,
        message: "Department shift timings retrieved successfully",
        data: timings,
      });
    } catch (error: any) {
      console.error("Error fetching department timings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch department shift timings",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Create Department Shift Timing
   */
  static async createDepartmentTiming(req: Request, res: Response) {
    try {
      const {
        name,
        departmentId,
        category,
        monThuStart,
        monThuEnd,
        friStart,
        friEnd,
        satStart,
        satEnd,
        satWorkingType,
        sunWorkingType,
        notes,
        isActive,
      } = req.body;

      if (!name || !monThuStart || !monThuEnd || !friStart || !friEnd) {
        return res.status(400).json({
          success: false,
          message: "Name, Mon-Thu timings, and Friday timings are required",
        });
      }

      const created = await AttendancePolicyService.createDepartmentTiming({
        name,
        departmentId: departmentId || null,
        category,
        monThuStart,
        monThuEnd,
        friStart,
        friEnd,
        satStart: satStart || monThuStart,
        satEnd: satEnd || monThuEnd,
        satWorkingType,
        sunWorkingType,
        notes,
        isActive,
      });

      res.status(201).json({
        success: true,
        message: "Department shift timing created successfully",
        data: created,
      });
    } catch (error: any) {
      console.error("Error creating department timing:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create department timing",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Update Department Shift Timing
   */
  static async updateDepartmentTiming(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updated = await AttendancePolicyService.updateDepartmentTiming(
        id,
        req.body
      );

      res.json({
        success: true,
        message: "Department shift timing updated successfully",
        data: updated,
      });
    } catch (error: any) {
      console.error("Error updating department timing:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update department timing",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Delete Department Shift Timing
   */
  static async deleteDepartmentTiming(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await AttendancePolicyService.deleteDepartmentTiming(id);

      res.json({
        success: true,
        message: "Department shift timing deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting department timing:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete department timing",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Get employee monthly allowances tracking
   */
  static async getMonthlyAllowances(req: Request, res: Response) {
    try {
      const authenticatedRequest = req as any;
      let targetEmployeeId = req.params.employeeId;
      if (!targetEmployeeId || targetEmployeeId === "me" || targetEmployeeId === "self") {
        targetEmployeeId = authenticatedRequest.user?.id;
      }

      if (!targetEmployeeId) {
        return res.status(400).json({
          success: false,
          message: "Employee ID or authentication is required",
        });
      }

      const { month } = req.query;

      let date = new Date();
      if (month && typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
        date = new Date(`${month}-01T00:00:00Z`);
      }

      const summary = await AttendancePolicyService.getMonthlyAllowanceStatus(
        targetEmployeeId,
        date
      );

      res.json({
        success: true,
        message: "Monthly allowance summary retrieved successfully",
        data: summary,
      });
    } catch (error: any) {
      console.error("Error calculating monthly allowances:", error);
      res.status(500).json({
        success: false,
        message: "Failed to calculate monthly allowances",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Submit regularisation request (technical issues, official field work, missing punch)
   */
  static async submitRegularisation(req: Request, res: Response) {
    try {
      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;
      const {
        attendanceId,
        employeeId,
        date,
        regularisationType,
        reason,
        reasonDetails,
        fieldAddress,
        taskDetail,
        projectName,
        projectManager,
        projectDepartment,
      } = req.body;

      const targetEmployeeId = employeeId || currentUser?.id;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid reason (at least 5 characters)",
        });
      }

      const regularisation = await AttendancePolicyService.submitRegularisation({
        attendanceId,
        employeeId: targetEmployeeId,
        date: date || new Date(),
        regularisationType: regularisationType || "TECHNICAL_ISSUE",
        reason: reason.trim(),
        reasonDetails,
        fieldAddress,
        taskDetail,
        projectName,
        projectManager,
        projectDepartment,
      });

      res.status(201).json({
        success: true,
        message:
          "Regularisation request submitted successfully. Email notifications have been dispatched to HR, IT Executive, HOD, and Line Manager.",
        data: regularisation,
      });
    } catch (error: any) {
      console.error("Error submitting regularisation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit regularisation request",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * List all regularisations with filters
   */
  static async getRegularisations(req: Request, res: Response) {
    try {
      const {
        status,
        regularisationType,
        employeeId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (status) {
        where.status = status as string;
      }
      if (regularisationType) {
        where.regularisationType = regularisationType as string;
      }
      if (employeeId) {
        where.employeeId = employeeId as string;
      }
      if (startDate || endDate) {
        where.datetime = {};
        if (startDate) where.datetime.gte = new Date(startDate as string);
        if (endDate) where.datetime.lte = new Date(endDate as string);
      }

      const [records, total] = await Promise.all([
        prisma.attendanceReason.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
            attachments: true,
          },
          orderBy: { datetime: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.attendanceReason.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Regularisation records retrieved successfully",
        data: {
          records,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching regularisations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch regularisations",
        error: error.message || "Unknown error",
      });
    }
  }

  /**
   * Review regularisation (Approve or Reject)
   */
  static async reviewRegularisation(req: Request, res: Response) {
    try {
      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;
      const { id } = req.params;
      const { status, comments } = req.body;

      if (!["APPROVED", "REJECTED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be either APPROVED or REJECTED",
        });
      }

      const updated = await AttendancePolicyService.reviewRegularisation(
        id,
        status as "APPROVED" | "REJECTED",
        currentUser?.id || "system",
        comments
      );

      res.json({
        success: true,
        message: `Regularisation has been ${status.toLowerCase()} successfully`,
        data: updated,
      });
    } catch (error: any) {
      console.error("Error reviewing regularisation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to review regularisation",
        error: error.message || "Unknown error",
      });
    }
  }
}
