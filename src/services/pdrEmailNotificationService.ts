import { PdrOverallStatus, Role } from "@prisma/client";
import { config } from "../config/env";
import { prisma } from "../lib/prisma";
import { EmailService } from "../utils/emailService";

type PdrWithRelations = {
  id: number;
  pdr_cycle: string | null;
  overallStatus: PdrOverallStatus;
  user: {
    id: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
    officialEmail: string | null;
    email: string;
    department: string | null;
    departmentEntity?: { name: string } | null;
    designation?: { title: string } | null;
  };
  linemanager: {
    id: string;
    firstName: string;
    lastName: string;
    officialEmail: string | null;
    email: string;
  } | null;
  director: {
    id: string;
    firstName: string;
    lastName: string;
    officialEmail: string | null;
    email: string;
  } | null;
};

export interface PdrEmailJobData {
  pdrId: number;
  targetStatus: PdrOverallStatus;
  fromStatus?: PdrOverallStatus;
  revertMessage?: string;
}

const SKIP_NOTIFY_STATUSES: PdrOverallStatus[] = [
  PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
  PdrOverallStatus.HR_REVIEWING_MANAGER,
  PdrOverallStatus.EMPLOYEE_PENDING,
  PdrOverallStatus.DIRECTOR_REVIEWING,
];

const pdrInclude = {
  user: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      officialEmail: true,
      email: true,
      department: true,
      departmentEntity: { select: { name: true } },
      designation: { select: { title: true } },
    },
  },
  linemanager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      officialEmail: true,
      email: true,
    },
  },
  director: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      officialEmail: true,
      email: true,
    },
  },
} as const;

/** Prefer officialEmail; fall back to login email when official is not set. */
function resolveNotifyEmail(
  user:
    | { officialEmail: string | null; email: string; firstName?: string }
    | null
    | undefined,
): string | null {
  if (!user) return null;
  const official = user.officialEmail?.trim();
  if (official) return official;
  const login = user.email?.trim();
  if (login) {
    console.warn(
      `⚠️ No officialEmail for ${user.firstName ?? "user"} — using login email: ${login}`,
    );
    return login;
  }
  return null;
}

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function pdrLink(pdrId: number): string {
  const base = (config.COMPANY_DOMAIN || "").replace(/\/$/, "");
  return `${base}/pdr/${pdrId}`;
}

function employeeDetailsBlock(pdr: PdrWithRelations): string {
  const u = pdr.user;
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0; border-collapse: separate; overflow: hidden;">
      <tr>
        <td style="padding: 16px; font-size: 13px; color: #334155;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; width: 35%; color: #64748b; font-weight: 500;">Employee Name:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${fullName(u)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Employee ID:</td>
              <td style="padding: 4px 0; color: #334155;">${u.employeeId || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 500;">PDR Cycle:</td>
              <td style="padding: 4px 0; color: #334155;">${pdr.pdr_cycle || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Department:</td>
              <td style="padding: 4px 0; color: #334155;">${u.departmentEntity?.name || u.department || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 500;">Designation:</td>
              <td style="padding: 4px 0; color: #334155;">${u.designation?.title || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 500;">PDR Reference:</td>
              <td style="padding: 4px 0; color: #4f46e5; font-weight: 600;">#${pdr.id}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function emailActionButton(label: string, url: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 6px; background-color: #4f46e5;">
          <a href="${url}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; display: inline-block;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function emailLayout(title: string, bodyHtml: string): string {
  const companyName = config.COMPANY_NAME || "HRMS";
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 12px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 26px 28px;">
            <span style="color: #6366f1; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">${companyName} PDR System</span>
            <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 6px 0 0 0;">${title}</h2>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 24px 28px; color: #334155; font-size: 14px; line-height: 1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
              This is an automated notification from ${companyName} HRMS. Please do not reply directly to this email.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

async function getHrOfficialEmails(): Promise<string[]> {
  const hrUsers = await prisma.user.findMany({
    where: {
      role: { in: [Role.HR, Role.ADMIN] },
      isActive: true,
    },
    select: { officialEmail: true, email: true },
  });

  const emails = new Set<string>();
  for (const u of hrUsers) {
    const addr = resolveNotifyEmail(u);
    if (addr) emails.add(addr);
  }
  return [...emails];
}

export class PdrEmailNotificationService {
  static shouldNotify(targetStatus: PdrOverallStatus): boolean {
    return !SKIP_NOTIFY_STATUSES.includes(targetStatus);
  }

  static async processJob(data: PdrEmailJobData): Promise<void> {
    if (!this.shouldNotify(data.targetStatus)) return;

    const pdr = await prisma.pdr.findUnique({
      where: { id: data.pdrId },
      include: pdrInclude,
    });

    if (!pdr) throw new Error(`PDR ${data.pdrId} not found`);

    const notifications = await this.buildNotifications(
      pdr as PdrWithRelations,
      data,
    );

    if (notifications.length === 0) {
      console.warn(
        `⚠️ PDR #${data.pdrId} [${data.targetStatus}]: no recipients — employee/manager/director may be missing officialEmail`,
      );
      return;
    }

    console.log(
      `📧 PDR #${data.pdrId} [${data.targetStatus}] → ${notifications.map((n) => n.to).join(", ")}`,
    );

    for (const n of notifications) {
      await EmailService.sendEmail(n.to, n.subject, n.html);
    }
  }

  private static async buildNotifications(
    pdr: PdrWithRelations,
    data: PdrEmailJobData,
  ): Promise<{ to: string; subject: string; html: string }[]> {
    const { targetStatus, fromStatus, revertMessage } = data;
    const employeeName = fullName(pdr.user);
    const cycle = pdr.pdr_cycle || "PDR Cycle";
    const link = pdrLink(pdr.id);
    const out: { to: string; subject: string; html: string }[] = [];

    const push = (to: string | null, subject: string, body: string) => {
      if (!to) return;
      out.push({ to, subject, html: emailLayout(subject, body) });
    };

    switch (targetStatus) {
      case PdrOverallStatus.CREATED_BY_HR:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — PDR Created`,
          `<p style="margin-top:0;">Hello <strong>${pdr.user.firstName}</strong>,</p>
           <p>HR has initiated your Performance Development Review (PDR) for <strong>${cycle}</strong>.</p>
           ${employeeDetailsBlock(pdr)}
           <p>Please log in to your HRMS portal to complete your self-assessment section.</p>
          `,
        );
        break;

      case PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR: {
        const hrEmails = await getHrOfficialEmails();
        const body = `<p style="margin-top:0;">Hello HR Team,</p>
          <p><strong>${employeeName}</strong> has completed and submitted their employee PDR section for review.</p>
          ${employeeDetailsBlock(pdr)}
          ${emailActionButton("Review PDR Submission", link)}`;
        for (const to of hrEmails) {
          push(
            to,
            `${cycle} — Employee Section Submitted (${employeeName})`,
            body,
          );
        }
        break;
      }

      case PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — Action Required: PDR Revision Requested`,
          `<p style="margin-top:0;">Hello <strong>${pdr.user.firstName}</strong>,</p>
           <p>HR has reviewed your PDR and requested revisions on your self-assessment section.</p>
           ${revertMessage
            ? `<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0; color: #991b1b;">
                    <strong>Message from HR:</strong>
                    <p style="margin: 4px 0 0 0; font-style: italic;">"${revertMessage}"</p>
                  </div>`
            : ""
          }
           ${employeeDetailsBlock(pdr)}
           <p>Please update your PDR entries and resubmit when complete.</p>
           ${emailActionButton("Update Your PDR", link)}`,
        );
        break;

      case PdrOverallStatus.HR_APPROVED_EMPLOYEE:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Manager Review Required (${employeeName})`,
          `<p style="margin-top:0;">Hello <strong>${pdr.linemanager?.firstName || "Manager"}</strong>,</p>
           <p>HR has approved the employee self-assessment section for <strong>${employeeName}</strong>.</p>
           ${employeeDetailsBlock(pdr)}
           <p>Please complete your line manager assessment section.</p>
           ${emailActionButton("Fill Manager Section", link)}`,
        );
        break;

      case PdrOverallStatus.MANAGER_PENDING:
        if (
          fromStatus === PdrOverallStatus.HR_APPROVED_EMPLOYEE ||
          fromStatus === PdrOverallStatus.HR_REVERTED_TO_MANAGER
        ) {
          push(
            resolveNotifyEmail(pdr.linemanager),
            `${cycle} — Manager Action Pending (${employeeName})`,
            `<p style="margin-top:0;">Hello <strong>${pdr.linemanager?.firstName || "Manager"}</strong>,</p>
             <p>The PDR line manager section is now open for <strong>${employeeName}</strong>.</p>
             ${employeeDetailsBlock(pdr)}
             <p>Please log in to complete your evaluation.</p>
             `,
          );
        }
        break;

      case PdrOverallStatus.MANAGER_SUBMITTED_TO_HR: {
        const hrEmails = await getHrOfficialEmails();
        const body = `<p style="margin-top:0;">Hello HR Team,</p>
          <p>The line manager (<strong>${pdr.linemanager ? fullName(pdr.linemanager) : "Line Manager"}</strong>) has submitted the manager section for <strong>${employeeName}</strong>.</p>
          ${employeeDetailsBlock(pdr)}
          ${emailActionButton("Review Manager Section", link)}`;
        for (const to of hrEmails) {
          push(
            to,
            `${cycle} — Manager Section Submitted (${employeeName})`,
            body,
          );
        }
        break;
      }

      case PdrOverallStatus.HR_REVERTED_TO_MANAGER:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Action Required: Manager Section Revision`,
          `<p style="margin-top:0;">Hello <strong>${pdr.linemanager?.firstName || "Manager"}</strong>,</p>
           <p>HR has reviewed the manager evaluation for <strong>${employeeName}</strong> and requested revisions.</p>
           ${revertMessage
            ? `<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0; color: #991b1b;">
                    <strong>Message from HR:</strong>
                    <p style="margin: 4px 0 0 0; font-style: italic;">"${revertMessage}"</p>
                  </div>`
            : ""
          }
           ${employeeDetailsBlock(pdr)}
           <p>Please update your assessment and resubmit.</p>
           ${emailActionButton("Revise Manager Section", link)}`,
        );
        break;

      case PdrOverallStatus.HR_APPROVED_MANAGER:
        push(
          resolveNotifyEmail(pdr.director),
          `${cycle} — Director Review Required (${employeeName})`,
          `<p style="margin-top:0;">Hello <strong>${pdr.director?.firstName || "Director"}</strong>,</p>
           <p>HR has approved the manager section for <strong>${employeeName}</strong>. The PDR is now ready for your director review and final comments.</p>
           ${employeeDetailsBlock(pdr)}
           ${emailActionButton("Review PDR", link)}`,
        );
        break;

      case PdrOverallStatus.DIRECTOR_REVIEWED:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — Action Required: Acknowledge Your PDR`,
          `<p style="margin-top:0;">Hello <strong>${pdr.user.firstName}</strong>,</p>
           <p>Director review has been completed for your <strong>${cycle}</strong> PDR. Please review the final ratings and submit your acknowledgement.</p>
           ${employeeDetailsBlock(pdr)}
           ${emailActionButton("Acknowledge PDR", link)}`,
        );
        break;

      case PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — Action Required: Acknowledge Updated PDR`,
          `<p style="margin-top:0;">Hello <strong>${pdr.user.firstName}</strong>,</p>
           <p>Your line manager has updated your PDR. Please review the changes and record your acknowledgement.</p>
           ${employeeDetailsBlock(pdr)}
           ${emailActionButton("Review & Acknowledge PDR", link)}`,
        );
        break;

      case PdrOverallStatus.EMPLOYEE_DISAGREED: {
        const hrEmails = await getHrOfficialEmails();
        const body = `<p style="margin-top:0;">Hello HR Team,</p>
          <p>Attention: <strong>${employeeName}</strong> has indicated disagreement with their PDR assessment upon acknowledgement.</p>
          ${employeeDetailsBlock(pdr)}
          ${emailActionButton("View Disagreed PDR", link)}`;
        for (const to of hrEmails) {
          push(to, `${cycle} — Employee Disagreed with PDR (${employeeName})`, body);
        }
        break;
      }

      case PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Revision Requested by HR (${employeeName})`,
          `<p style="margin-top:0;">Hello <strong>${pdr.linemanager?.firstName || "Manager"}</strong>,</p>
           <p>HR has requested manager revisions for <strong>${employeeName}</strong>'s PDR.</p>
           ${employeeDetailsBlock(pdr)}
           ${emailActionButton("Revise PDR", link)}`,
        );
        break;

      case PdrOverallStatus.MANAGER_REVISING:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Manager Section Revision Pending (${employeeName})`,
          `<p style="margin-top:0;">Hello <strong>${pdr.linemanager?.firstName || "Manager"}</strong>,</p>
           <p>Please revise the manager section for <strong>${employeeName}</strong>'s PDR.</p>
           ${employeeDetailsBlock(pdr)}
           ${emailActionButton("Revise Manager Section", link)}`,
        );
        break;

      case PdrOverallStatus.COMPLETED: {
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — PDR Complete`,
          `<p style="margin-top:0;">Hello <strong>${pdr.user.firstName}</strong>,</p>
           <p>Your Performance Development Review for <strong>${cycle}</strong> is now finalized and marked complete.</p>
           ${employeeDetailsBlock(pdr)}
           ${emailActionButton("View Completed PDR", link)}`,
        );
        const hrEmails = await getHrOfficialEmails();
        const hrBody = `<p style="margin-top:0;">Hello HR Team,</p>
          <p>The PDR workflow for <strong>${employeeName}</strong> has been successfully completed.</p>
          ${employeeDetailsBlock(pdr)}
          ${emailActionButton("View Completed PDR", link)}`;
        for (const to of hrEmails) {
          push(to, `${cycle} — PDR Completed (${employeeName})`, hrBody);
        }
        break;
      }

      default:
        break;
    }

    return out;
  }
}
