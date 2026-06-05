import { prisma } from "../lib/prisma";
import { EmailService } from "../utils/emailService";

export interface AttendanceReminderQuery {
  sendAll: boolean;
  fromDate?: string;
  toDate?: string;
}

export interface AttendanceReminderJobData {
  employeeId: string;
  recordIds: string[];
}

const TEN_AM_MINUTES = 10 * 60;
const SIX_PM_MINUTES = 18 * 60;

const attendanceInclude = {
  employee: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      officialEmail: true,
      shift: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  },
  zktecoRecords: {
    select: {
      id: true,
      timestamp: true,
      checkType: true,
      overallStatus: true,
    },
  },
} as const;

type AttendanceRecord = Awaited<
  ReturnType<typeof AttendanceReminderService.fetchRecordsWithoutReasons>
>[number];

function resolveNotifyEmail(employee: {
  officialEmail: string | null;
  email: string;
  firstName: string;
}): string | null {
  const official = employee.officialEmail?.trim();
  if (official) return official;
  const login = employee.email?.trim();
  if (login) {
    console.warn(
      `⚠️ No officialEmail for ${employee.firstName} — using login email: ${login}`,
    );
    return login;
  }
  return null;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export class AttendanceReminderService {
  static recordNeedsReason(record: {
    checkIn: Date | null;
    checkOut: Date | null;
  }): boolean {
    if (!record.checkIn) return true;
    if (!record.checkOut) return true;

    if (record.checkIn) {
      const checkInTime = new Date(record.checkIn);
      const checkInMinutes =
        checkInTime.getUTCHours() * 60 + checkInTime.getUTCMinutes();
      if (checkInMinutes > TEN_AM_MINUTES) return true;
    }

    if (record.checkOut) {
      const checkOutTime = new Date(record.checkOut);
      const checkOutMinutes =
        checkOutTime.getUTCHours() * 60 + checkOutTime.getUTCMinutes();
      if (checkOutMinutes < SIX_PM_MINUTES) return true;
    }

    return false;
  }

  static async fetchRecordsWithoutReasons(query: AttendanceReminderQuery) {
    const dateFilter =
      !query.sendAll && query.fromDate && query.toDate
        ? {
            date: {
              gte: parseDateOnly(query.fromDate),
              lte: parseDateOnly(query.toDate),
            },
          }
        : {};

    const allRecords = await prisma.attendance.findMany({
      where: {
        AND: [
          { OR: [{ reason: null }, { reason: "" }] },
          { OR: [{ checkIn: { not: null } }, { checkOut: { not: null } }] },
          dateFilter,
        ],
      },
      include: attendanceInclude,
      orderBy: { date: "desc" },
    });

    return allRecords.filter((r) => this.recordNeedsReason(r));
  }

  static groupByEmployee(records: AttendanceRecord[]) {
    const map = new Map<string, AttendanceRecord[]>();
    for (const record of records) {
      const employee = record.employee;
      if (!employee || !resolveNotifyEmail(employee)) continue;
      const list = map.get(employee.id) ?? [];
      list.push(record);
      map.set(employee.id, list);
    }
    return map;
  }

  static buildReminderHtml(
    employeeName: string,
    records: AttendanceRecord[],
  ): { subject: string; html: string } {
    const htmlIssues = records
      .map((record) => {
        const date = new Date(record.date).toLocaleDateString();
        const issues: string[] = [];

        if (!record.checkIn) {
          issues.push(
            "<strong style='color: #dc2626;'>⚠️ No check-in recorded</strong>",
          );
        } else {
          const checkInTime = new Date(record.checkIn);
          const h = checkInTime.getUTCHours();
          const m = checkInTime.getUTCMinutes();
          const s = checkInTime.getUTCSeconds();
          const mins = h * 60 + m;
          if (mins > TEN_AM_MINUTES) {
            const lateMinutes = mins - TEN_AM_MINUTES;
            let hour = h % 12 || 12;
            const ampm = h >= 12 ? "PM" : "AM";
            const timeStr = `${hour}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")} ${ampm}`;
            issues.push(
              `<span style='color: #ea580c;'>Checked in late at <strong>${timeStr}</strong> (${lateMinutes} min after 10:00 AM)</span>`,
            );
          }
        }

        if (!record.checkOut) {
          issues.push(
            "<strong style='color: #dc2626;'>⚠️ No check-out recorded</strong>",
          );
        } else {
          const checkOutTime = new Date(record.checkOut);
          const h = checkOutTime.getUTCHours();
          const m = checkOutTime.getUTCMinutes();
          const s = checkOutTime.getUTCSeconds();
          const mins = h * 60 + m;
          if (mins < SIX_PM_MINUTES) {
            const earlyMinutes = SIX_PM_MINUTES - mins;
            let hour = h % 12 || 12;
            const ampm = h >= 12 ? "PM" : "AM";
            const timeStr = `${hour}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")} ${ampm}`;
            issues.push(
              `<span style='color: #ea580c;'>Checked out early at <strong>${timeStr}</strong> (${earlyMinutes} min before 6:00 PM)</span>`,
            );
          }
        }

        const issueText =
          issues.length > 0 ? issues.join("<br/>") : "Attendance irregularity";
        return `<li style='margin-bottom: 12px;'><strong>${date}:</strong><br/>${issueText}</li>`;
      })
      .join("");

    const subject = `Reminder: Attendance Reason Required (${records.length} record${records.length > 1 ? "s" : ""})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f97316; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; }
    .records-list { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .steps { background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .steps ol { margin: 10px 0; padding-left: 20px; }
    .steps li { margin: 8px 0; }
    ul { list-style-type: none; padding-left: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">⚠️ Attendance Reason Required</h2>
    </div>
    <div class="content">
      <p>Dear <strong>${employeeName}</strong>,</p>
      <p>This is a reminder to provide reasons for the following attendance records:</p>
      <div class="records-list">
        <h3 style="margin-top: 0; color: #92400e;">📋 Attendance Issues (${records.length} record${records.length > 1 ? "s" : ""})</h3>
        <ul>${htmlIssues}</ul>
      </div>
      <p>Please log in to the HRMS portal and provide a reason for each of these attendance records.</p>
      <div class="steps">
        <h3 style="margin-top: 0; color: #1e40af;">📝 How to Provide Reason:</h3>
        <ol>
          <li>Log in to the HRMS portal</li>
          <li>Navigate to the <strong>Attendance</strong> page</li>
          <li>Find your attendance record(s)</li>
          <li>Click <strong>"Add Reason"</strong> and submit your explanation</li>
        </ol>
      </div>
      <p>Thank you for your cooperation.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;"><strong>Best regards,</strong><br/>HR Department</p>
      <p style="margin: 10px 0 0 0; font-size: 12px;">This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>`;

    return { subject, html };
  }

  static async processJob(data: AttendanceReminderJobData): Promise<void> {
    const records = await prisma.attendance.findMany({
      where: { id: { in: data.recordIds } },
      include: attendanceInclude,
      orderBy: { date: "desc" },
    });

    const needingReason = records.filter((r) => this.recordNeedsReason(r));
    if (needingReason.length === 0) {
      console.warn(
        `⚠️ Attendance reminder job for employee ${data.employeeId}: no valid records`,
      );
      return;
    }

    const employee = needingReason[0].employee;
    if (!employee) throw new Error("Employee not found for reminder");

    const to = resolveNotifyEmail(employee);
    if (!to) throw new Error(`No email for employee ${data.employeeId}`);

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const { subject, html } = this.buildReminderHtml(employeeName, needingReason);

    console.log(
      `📧 Attendance reminder → ${to} (${needingReason.length} record(s))`,
    );
    await EmailService.sendEmail(to, subject, html);
  }
}
