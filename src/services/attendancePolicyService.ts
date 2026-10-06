import { prisma } from "../lib/prisma";
import { EmailService } from "../utils/emailService";

export interface AttendancePolicyData {
  policyName?: string;
  scopeDescription?: string;
  gracePeriodMinutes?: number;
  monthlyLateArrivalsAllowed?: number;
  lateArrivalThresholdMinutes?: number;
  monthlyEarlyOutAllowed?: number;
  earlyOutThresholdMinutes?: number;
  lateExceededDeduction?: string;
  earlyOutExceededDeduction?: string;
  missingBothPunchesAction?: string;
  missingOnePunchAction?: string;
  deductSalaryOnUnjustifiedAbsent?: boolean;
  mandatoryBiometric?: boolean;
  allowedBiometricMethods?: string;
  trackHeadAndRegionalOffices?: boolean;
  regularisationDeadlineDays?: number;
  regularisationNotifyHR?: boolean;
  regularisationNotifyIT?: boolean;
  regularisationNotifyHOD?: boolean;
  regularisationNotifyLineManager?: boolean;
  hrEmails?: string;
  itEmails?: string;
  allowTechnicalIssueRegularisation?: boolean;
  allowFieldWorkRegularisation?: boolean;
  isActive?: boolean;
}

export interface DepartmentShiftTimingData {
  name: string;
  departmentId?: string | null;
  category?: string;
  monThuStart: string;
  monThuEnd: string;
  friStart: string;
  friEnd: string;
  satStart: string;
  satEnd: string;
  satWorkingType?: string;
  sunWorkingType?: string;
  notes?: string;
  isActive?: boolean;
}

// In-memory cache for policy settings to avoid hitting the DB on every single punch
let cachedPolicy: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export class AttendancePolicyService {
  /**
   * Get active attendance policy or create default if none exists
   */
  static async getActivePolicy(bypassCache = false) {
    const now = Date.now();
    if (!bypassCache && cachedPolicy && now - lastCacheTime < CACHE_TTL_MS) {
      return cachedPolicy;
    }

    let policy: any = null;
    try {
      if (prisma?.attendancePolicySetting?.findFirst) {
        policy = await prisma.attendancePolicySetting.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        });

        if (!policy) {
          policy = await this.initializeDefaultPolicy();
        }
      }
    } catch (err) {
      console.warn("Could not query attendance policy from DB, using fallback defaults:", err);
      policy = null;
    }

    if (!policy) {
      policy = {
        id: "default-policy",
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
      };
    }

    cachedPolicy = policy;
    lastCacheTime = now;
    return policy;
  }

  /**
   * Initialize default attendance policy matching Iris Communications specifications
   */
  static async initializeDefaultPolicy() {
    // Check if any policy exists at all
    const existing = await prisma.attendancePolicySetting.findFirst();
    if (existing) {
      return existing;
    }

    const policy = await prisma.attendancePolicySetting.create({
      data: {
        policyName: "Iris Communications Attendance & Punctuality Policy",
        scopeDescription:
          "Applies to all Iris Communications employees to record attendance, punctuality, and discipline across Head Office and Regional Offices.",
        gracePeriodMinutes: 15, // 15 minutes allowed after official reporting time
        monthlyLateArrivalsAllowed: 3, // 3 late comings allowed per month
        lateArrivalThresholdMinutes: 60, // up to 1 hour late
        monthlyEarlyOutAllowed: 1, // 1 early out allowed per month
        earlyOutThresholdMinutes: 60, // up to 1 hour early
        lateExceededDeduction: "HALF_DAY_LEAVE", // Exceeding results in Half Day Leave adjustments or LWOP
        earlyOutExceededDeduction: "HALF_DAY_LEAVE",
        missingBothPunchesAction: "ABSENT", // Missing both IN and OUT without justification counts as Absent
        missingOnePunchAction: "LATE_OR_EARLY", // Missing only one punch treated as Late IN or Early OUT
        deductSalaryOnUnjustifiedAbsent: true, // Salary deduction
        mandatoryBiometric: true, // Mandatory thumb impression or face scanning
        allowedBiometricMethods: "THUMB_FACE",
        trackHeadAndRegionalOffices: true,
        regularisationDeadlineDays: 1, // Next working day
        regularisationNotifyHR: true,
        regularisationNotifyIT: true,
        regularisationNotifyHOD: true,
        regularisationNotifyLineManager: true,
        hrEmails: "hr@iriscommunications.com.pk",
        itEmails: "it@iriscommunications.com.pk",
        allowTechnicalIssueRegularisation: true,
        allowFieldWorkRegularisation: true,
        isActive: true,
      },
    });

    // Also initialize default department shift timings if empty
    await this.initializeDefaultDepartmentTimings();

    return policy;
  }

  /**
   * Initialize default Department Shift Timings
   */
  static async initializeDefaultDepartmentTimings() {
    const count = await prisma.departmentShiftTiming.count();
    if (count > 0) return;

    // 1. General Departments schedule:
    // Mon-Thu: 9:30 AM - 6:00 PM, Fri: 9:30 AM - 6:00 PM, Alternate Saturdays: 9:30 AM - 6:00 PM
    await prisma.departmentShiftTiming.create({
      data: {
        name: "General Departments",
        category: "GENERAL",
        monThuStart: "09:30",
        monThuEnd: "18:00",
        friStart: "09:30",
        friEnd: "18:00",
        satStart: "09:30",
        satEnd: "18:00",
        satWorkingType: "ALTERNATE",
        sunWorkingType: "OFF",
        notes:
          "Official working schedule for General Departments: Monday–Thursday (9:30 AM – 6:00 PM), Fridays (9:30 AM – 6:00 PM), Alternate Saturdays (9:30 AM – 6:00 PM).",
        isActive: true,
      },
    });

    // 2. Administrative Staff (Research Wing):
    // Mon-Thu: 8:30 AM - 6:00 PM, Fri: 8:30 AM - 6:00 PM, Alternate Saturdays: 8:30 AM - 6:00 PM
    await prisma.departmentShiftTiming.create({
      data: {
        name: "Administrative Staff (Research Wing)",
        category: "RESEARCH_WING",
        monThuStart: "08:30",
        monThuEnd: "18:00",
        friStart: "08:30",
        friEnd: "18:00",
        satStart: "08:30",
        satEnd: "18:00",
        satWorkingType: "ALTERNATE",
        sunWorkingType: "OFF",
        notes:
          "Official working schedule for Administrative Staff / Research Wing: Monday–Thursday (8:30 AM – 6:00 PM), Fridays (8:30 AM – 6:00 PM), Alternate Saturdays (8:30 AM – 6:00 PM).",
        isActive: true,
      },
    });
  }

  /**
   * Update attendance policy
   */
  static async updatePolicy(id: string, data: AttendancePolicyData) {
    const updated = await prisma.attendancePolicySetting.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    cachedPolicy = updated;
    lastCacheTime = Date.now();
    return updated;
  }

  /**
   * Department Shift Timings CRUD
   */
  static async getAllDepartmentTimings() {
    const timings = await prisma.departmentShiftTiming.findMany({
      include: {
        department: {
          select: { id: true, name: true, manager: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (timings.length === 0) {
      await this.initializeDefaultDepartmentTimings();
      return prisma.departmentShiftTiming.findMany({
        include: {
          department: {
            select: { id: true, name: true, manager: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    return timings;
  }

  static async createDepartmentTiming(data: DepartmentShiftTimingData) {
    return prisma.departmentShiftTiming.create({
      data: {
        name: data.name,
        departmentId: data.departmentId || null,
        category: data.category || "GENERAL",
        monThuStart: data.monThuStart,
        monThuEnd: data.monThuEnd,
        friStart: data.friStart,
        friEnd: data.friEnd,
        satStart: data.satStart,
        satEnd: data.satEnd,
        satWorkingType: data.satWorkingType || "ALTERNATE",
        sunWorkingType: data.sunWorkingType || "OFF",
        notes: data.notes || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        department: { select: { id: true, name: true, manager: true } },
      },
    });
  }

  static async updateDepartmentTiming(id: string, data: Partial<DepartmentShiftTimingData>) {
    return prisma.departmentShiftTiming.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        department: { select: { id: true, name: true, manager: true } },
      },
    });
  }

  static async deleteDepartmentTiming(id: string) {
    return prisma.departmentShiftTiming.delete({
      where: { id },
    });
  }

  /**
   * Calculate employee's monthly allowances used and remaining
   */
  static async getMonthlyAllowanceStatus(employeeId: string, monthDate: Date = new Date()) {
    const policy = await this.getActivePolicy();

    const startOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0, 23, 59, 59));

    // Resolve user if employeeId is an employee code, email, or cuid
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: employeeId },
          { employeeId: employeeId },
          { email: employeeId },
        ],
      },
      select: { id: true },
    });

    const targetUserId = user ? user.id : employeeId;

    // Get all attendance records for this employee this month
    const records = await prisma.attendance.findMany({
      where: {
        employeeId: targetUserId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        employee: {
          include: { shift: true },
        },
        zktecoRecords: true,
      },
      orderBy: { date: "asc" },
    });

    let lateCount = 0;
    let lateWithinThresholdCount = 0;
    let lateExceededCount = 0;

    let earlyOutCount = 0;
    let earlyOutWithinThresholdCount = 0;
    let earlyOutExceededCount = 0;

    let absentCount = 0;
    let missingPunchCount = 0;

    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

    for (const record of records) {
      const shift = record.employee?.shift;
      if (!record.checkIn && !record.checkOut) {
        absentCount++;
        continue;
      }

      if ((!record.checkIn && record.checkOut) || (record.checkIn && !record.checkOut)) {
        missingPunchCount++;
      }

      if (shift && record.checkIn) {
        const checkInDate = new Date(record.checkIn);
        const shiftStartClock = new Date(new Date(shift.startTime).getTime() + PKT_OFFSET_MS);
        const shiftStartToday = new Date(record.date);
        shiftStartToday.setUTCHours(
          shiftStartClock.getUTCHours(),
          shiftStartClock.getUTCMinutes(),
          shiftStartClock.getUTCSeconds(),
          0
        );

        const diffSeconds = (checkInDate.getTime() - shiftStartToday.getTime()) / 1000;
        const diffMinutes = Math.floor(diffSeconds / 60);

        if (diffMinutes > policy.gracePeriodMinutes) {
          lateCount++;
          if (diffMinutes <= policy.lateArrivalThresholdMinutes) {
            lateWithinThresholdCount++;
          } else {
            lateExceededCount++;
          }
        }
      }

      if (shift && record.checkOut) {
        const checkOutDate = new Date(record.checkOut);
        const shiftEndClock = new Date(new Date(shift.endTime).getTime() + PKT_OFFSET_MS);
        const shiftEndToday = new Date(record.date);
        shiftEndToday.setUTCHours(
          shiftEndClock.getUTCHours(),
          shiftEndClock.getUTCMinutes(),
          shiftEndClock.getUTCSeconds(),
          0
        );

        const earlyDiffSeconds = (shiftEndToday.getTime() - checkOutDate.getTime()) / 1000;
        const earlyDiffMinutes = Math.floor(earlyDiffSeconds / 60);

        if (earlyDiffMinutes > 15) { // Early departure threshold
          earlyOutCount++;
          if (earlyDiffMinutes <= policy.earlyOutThresholdMinutes) {
            earlyOutWithinThresholdCount++;
          } else {
            earlyOutExceededCount++;
          }
        }
      }
    }

    const lateAllowancesAllowed = policy.monthlyLateArrivalsAllowed; // default 3
    const earlyOutAllowancesAllowed = policy.monthlyEarlyOutAllowed; // default 1

    const lateAllowancesUsed = Math.min(lateCount, lateAllowancesAllowed);
    const lateAllowancesRemaining = Math.max(0, lateAllowancesAllowed - lateCount);
    const lateDeductionsDue = Math.max(0, lateCount - lateAllowancesAllowed);

    const earlyOutAllowancesUsed = Math.min(earlyOutCount, earlyOutAllowancesAllowed);
    const earlyOutAllowancesRemaining = Math.max(0, earlyOutAllowancesAllowed - earlyOutCount);
    const earlyOutDeductionsDue = Math.max(0, earlyOutCount - earlyOutAllowancesAllowed);

    return {
      month: `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`,
      policy: {
        gracePeriodMinutes: policy.gracePeriodMinutes,
        monthlyLateArrivalsAllowed: policy.monthlyLateArrivalsAllowed,
        lateArrivalThresholdMinutes: policy.lateArrivalThresholdMinutes,
        monthlyEarlyOutAllowed: policy.monthlyEarlyOutAllowed,
        earlyOutThresholdMinutes: policy.earlyOutThresholdMinutes,
        lateExceededDeduction: policy.lateExceededDeduction,
        earlyOutExceededDeduction: policy.earlyOutExceededDeduction,
      },
      late: {
        total: lateCount,
        withinThreshold: lateWithinThresholdCount,
        allowed: lateAllowancesAllowed,
        used: lateAllowancesUsed,
        remaining: lateAllowancesRemaining,
        exceeded: lateDeductionsDue,
        deductionType: policy.lateExceededDeduction,
      },
      earlyOut: {
        total: earlyOutCount,
        withinThreshold: earlyOutWithinThresholdCount,
        allowed: earlyOutAllowancesAllowed,
        used: earlyOutAllowancesUsed,
        remaining: earlyOutAllowancesRemaining,
        exceeded: earlyOutDeductionsDue,
        deductionType: policy.earlyOutExceededDeduction,
      },
      absentCount,
      missingPunchCount,
    };
  }

  /**
   * Submit regularisation request for technical issue or official field work
   * Sends multi-party email notifications to HR, IT Executive, HOD, and Line Manager
   */
  static async submitRegularisation(data: {
    attendanceId?: string;
    employeeId: string;
    date: string | Date;
    regularisationType: string; // "TECHNICAL_ISSUE", "FIELD_WORK", "MISSING_PUNCH", "BIOMETRIC_GLITCH", "OTHER"
    reason: string;
    reasonDetails?: string;
    fieldAddress?: string;
    taskDetail?: string;
    projectName?: string;
    projectManager?: string;
    projectDepartment?: string;
  }) {
    const policy = await this.getActivePolicy();

    // 1. Fetch employee details with department, manager, and shift
    const employee = await prisma.user.findUnique({
      where: { id: data.employeeId },
      include: {
        departmentEntity: true,
        shift: true,
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    const attendanceDate = new Date(data.date);
    const dateOnly = new Date(Date.UTC(
      attendanceDate.getUTCFullYear(),
      attendanceDate.getUTCMonth(),
      attendanceDate.getUTCDate()
    ));

    // 2. Find or create attendance record
    let attendanceRecord: any = null;
    if (data.attendanceId) {
      attendanceRecord = await prisma.attendance.findUnique({
        where: { id: data.attendanceId },
      });
    }

    if (!attendanceRecord) {
      attendanceRecord = await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: dateOnly,
          },
        },
        create: {
          employeeId: employee.id,
          date: dateOnly,
          status: "PRESENT",
          reason: data.reason,
          notes: `Regularisation submitted: ${data.regularisationType}`,
        },
        update: {
          reason: data.reason,
          notes: `Regularisation submitted: ${data.regularisationType}`,
        },
      });
    }

    // 3. Collect notification email recipients:
    // HR, IT Executive, HOD, and Line Manager
    const recipients: string[] = [];
    const ccList: string[] = [];

    // HR Emails from policy
    if (policy.regularisationNotifyHR && policy.hrEmails) {
      const hrList = policy.hrEmails.split(/[,;\s]+/).filter(Boolean);
      recipients.push(...hrList);
    }

    // IT Executive Emails from policy
    if (policy.regularisationNotifyIT && policy.itEmails) {
      const itList = policy.itEmails.split(/[,;\s]+/).filter(Boolean);
      ccList.push(...itList);
    }

    // HOD / Department Manager
    if (policy.regularisationNotifyHOD && employee.departmentEntity?.manager) {
      const managerUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: employee.departmentEntity.manager },
            {
              firstName: {
                contains: employee.departmentEntity.manager.split(" ")[0] || "",
              },
            },
          ],
        },
      });
      if (managerUser?.email) {
        ccList.push(managerUser.email);
      }
    }

    // Line Manager
    if (policy.regularisationNotifyLineManager && employee.manager) {
      const lineManagerUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: employee.manager },
            {
              firstName: {
                contains: employee.manager.split(" ")[0] || "",
              },
            },
          ],
        },
      });
      if (lineManagerUser?.email) {
        ccList.push(lineManagerUser.email);
      }
    }

    // Employee email
    if (employee.email) {
      ccList.push(employee.email);
    }

    const uniqueRecipients = Array.from(new Set(recipients));
    const uniqueCc = Array.from(new Set(ccList.filter((e) => !uniqueRecipients.includes(e))));
    const primaryTo = uniqueRecipients.length > 0 ? uniqueRecipients[0] : (employee.email || "hr@iriscommunications.com.pk");
    const otherRecipients = uniqueRecipients.slice(1).concat(uniqueCc);

    // 4. Create AttendanceReason entry
    const regularisationReason = await prisma.attendanceReason.create({
      data: {
        attendanceId: attendanceRecord.id,
        employeeId: employee.id,
        reason: data.reason,
        reasonDetails: data.reasonDetails || null,
        regularisationType: data.regularisationType,
        fieldAddress: data.fieldAddress || null,
        taskDetail: data.taskDetail || null,
        projectName: data.projectName || null,
        projectManager: data.projectManager || null,
        projectDepartment: data.projectDepartment || employee.department || null,
        status: "PENDING",
        datetime: new Date(),
        notifiedRecipients: JSON.stringify({
          to: primaryTo,
          cc: otherRecipients,
        }),
      },
    });

    // Link to attendance
    await prisma.attendance.update({
      where: { id: attendanceRecord.id },
      data: {
        attendanceReasonId: regularisationReason.id,
        reason: data.reason,
      },
    });

    // 5. Send notification email to stakeholders
    try {
      const typeLabel =
        data.regularisationType === "TECHNICAL_ISSUE"
          ? "Biometric Technical / Device Issue"
          : data.regularisationType === "FIELD_WORK"
            ? "Official Field Work / Client Assignment"
            : data.regularisationType === "BIOMETRIC_GLITCH"
              ? "Biometric Sensor / Scanning Glitch"
              : data.regularisationType === "MISSING_PUNCH"
                ? "Missing Punch Regularisation"
                : "Attendance Regularisation";

      const formattedDate = dateOnly.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const emailSubject = `[Iris HRMS] Attendance Regularisation: ${employee.firstName} ${employee.lastName} (${typeLabel})`;
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; padding: 24px 28px; }
    .header h2 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .badge { display: inline-block; padding: 4px 10px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; border-radius: 20px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .body { padding: 28px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .info-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .info-table td:first-child { font-weight: 600; color: #64748b; width: 35%; }
    .info-table td:last-child { color: #0f172a; font-weight: 500; }
    .reason-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 13px; }
    .footer { background: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Attendance Regularisation Notification</h2>
      <p>Iris Communications HRMS Attendance & Punctuality Policy Compliance</p>
      <span class="badge">Status: Pending Approval</span>
    </div>
    <div class="body">
      <p style="font-size: 14px; margin-top: 0;">An attendance regularisation notice has been submitted under the Attendance Policy rules:</p>
      <table class="info-table">
        <tr>
          <td>Employee Name</td>
          <td><strong>${employee.firstName} ${employee.lastName}</strong> (${employee.employeeId || "N/A"})</td>
        </tr>
        <tr>
          <td>Department</td>
          <td>${employee.department || employee.departmentEntity?.name || "General"}</td>
        </tr>
        <tr>
          <td>Attendance Date</td>
          <td>${formattedDate}</td>
        </tr>
        <tr>
          <td>Regularisation Type</td>
          <td><strong style="color: #2563eb;">${typeLabel}</strong></td>
        </tr>
        ${data.fieldAddress ? `<tr><td>Field Location</td><td>${data.fieldAddress}</td></tr>` : ""}
        ${data.taskDetail ? `<tr><td>Task / Project</td><td>${data.taskDetail}</td></tr>` : ""}
        <tr>
          <td>Timely Notification</td>
          <td><span style="color: #16a34a; font-weight: 600;">✓ Notified HR, IT Executive, HOD, and Line Manager</span></td>
        </tr>
      </table>

      <div class="reason-box">
        <strong style="color: #1e293b; display: block; margin-bottom: 6px;">Reason & Justification:</strong>
        <p style="margin: 0; white-space: pre-wrap;">${data.reason}</p>
        ${data.reasonDetails ? `<p style="margin-top: 8px; color: #475569; font-size: 12px;">${data.reasonDetails}</p>` : ""}
      </div>

      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
        <strong>Policy Reminder:</strong> Per the Iris Communications Attendance Policy, technical issues and official field work require timely notifications by the next working day for verification and leave/deduction waiver.
      </p>
    </div>
    <div class="footer">
      Iris Communications (Pvt) Ltd. · HRMS Automated Attendance Policy Service
    </div>
  </div>
</body>
</html>
      `;

      await EmailService.sendEmail(primaryTo, emailSubject, emailHtml, {
        cc: otherRecipients,
      });
    } catch (emailErr) {
      console.error("Failed to send regularisation email:", emailErr);
      // Don't fail the request if SMTP fails
    }

    return regularisationReason;
  }

  /**
   * Approve or reject regularisation
   */
  static async reviewRegularisation(
    id: string,
    status: "APPROVED" | "REJECTED",
    reviewerId: string,
    comments?: string
  ) {
    const regularisation = await prisma.attendanceReason.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!regularisation) {
      throw new Error("Regularisation request not found");
    }

    const updated = await prisma.attendanceReason.update({
      where: { id },
      data: {
        status,
        reasonComment: comments || null,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    // If approved, update attendance status
    if (status === "APPROVED" && regularisation.attendanceId) {
      await prisma.attendance.update({
        where: { id: regularisation.attendanceId },
        data: {
          status: "PRESENT",
          notes: `Regularisation Approved: ${regularisation.regularisationType || "Approved by HR"}`,
        },
      });
    }

    // Send status update email to employee
    if (regularisation.employee?.email) {
      try {
        const subject = `[Iris HRMS] Regularisation Request ${status}`;
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
            <h3 style="color: ${status === "APPROVED" ? "#16a34a" : "#dc2626"};">
              Your Attendance Regularisation has been ${status}
            </h3>
            <p>Dear ${regularisation.employee.firstName},</p>
            <p>Your attendance regularisation request for <strong>${regularisation.datetime.toDateString()}</strong> has been reviewed.</p>
            <p><strong>Status:</strong> ${status}</p>
            ${comments ? `<p><strong>Reviewer Comments:</strong> ${comments}</p>` : ""}
            <p style="font-size: 12px; color: #64748b;">Iris Communications HRMS</p>
          </div>
        `;
        await EmailService.sendEmail(regularisation.employee.email, subject, html);
      } catch (err) {
        console.error("Error sending review email:", err);
      }
    }

    return updated;
  }
}
