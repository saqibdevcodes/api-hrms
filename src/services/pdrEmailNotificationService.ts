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
  PdrOverallStatus.EMPLOYEE_FILLING,
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
    <ul style="margin:12px 0;padding-left:20px;">
      <li><strong>Employee:</strong> ${fullName(u)}</li>
      <li><strong>Employee ID:</strong> ${u.employeeId || "—"}</li>
      <li><strong>Cycle:</strong> ${pdr.pdr_cycle || "—"}</li>
      <li><strong>Department:</strong> ${u.departmentEntity?.name || u.department || "—"}</li>
      <li><strong>Designation:</strong> ${u.designation?.title || "—"}</li>
      <li><strong>PDR #:</strong> ${pdr.id}</li>
    </ul>
  `;
}

function emailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <h2 style="color:#4F46E5;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;color:#666;font-size:12px;">
        ${config.COMPANY_NAME} — automated PDR notification
      </p>
    </div>
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
    const cycle = pdr.pdr_cycle || "PDR";
    const link = pdrLink(pdr.id);
    const out: { to: string; subject: string; html: string }[] = [];

    const push = (
      to: string | null,
      subject: string,
      body: string,
    ) => {
      if (!to) return;
      out.push({ to, subject, html: emailLayout(subject, body) });
    };

    switch (targetStatus) {
      case PdrOverallStatus.CREATED_BY_HR:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — PDR created for you`,
          `<p>Hello ${pdr.user.firstName},</p>
           <p>HR has created your Performance Development Review for <strong>${cycle}</strong>.</p>
           <p>Please log in and complete your section when ready.</p>
          <!-- <p><a href="${link}">Open your PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR: {
        const hrEmails = await getHrOfficialEmails();
        const body = `<p>An employee has submitted their PDR section for HR review.</p>
          ${employeeDetailsBlock(pdr)}
          <p><a href="${link}">Review PDR</a></p>`;
        for (const to of hrEmails) {
          push(to, `${cycle} — ${employeeName} submitted PDR (employee section)`, body);
        }
        break;
      }

      case PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — PDR returned for revision`,
          `<p>Hello ${pdr.user.firstName},</p>
           <p>HR has returned your PDR for revision.</p>
           ${revertMessage ? `<p><strong>Message from HR:</strong></p><blockquote>${revertMessage}</blockquote>` : ""}
           <!-- <p><a href="${link}">Update your PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.HR_APPROVED_EMPLOYEE:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Manager section required (${employeeName})`,
          `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>HR has approved the employee section for <strong>${employeeName}</strong>.</p>
           ${employeeDetailsBlock(pdr)}
           <p>Please complete the line manager section.</p>
           <!-- <p><a href="${link}">Open PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.MANAGER_FILLING:
        if (
          fromStatus === PdrOverallStatus.HR_APPROVED_EMPLOYEE ||
          fromStatus === PdrOverallStatus.HR_REVERTED_TO_MANAGER
        ) {
          push(
            resolveNotifyEmail(pdr.linemanager),
            `${cycle} — Your turn: line manager section (${employeeName})`,
            `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
             <p>You may now fill the line manager section for <strong>${employeeName}</strong>.</p>
             ${employeeDetailsBlock(pdr)}
             <!-- <p><a href="${link}">Open PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
          );
        }
        break;

      case PdrOverallStatus.MANAGER_SUBMITTED_TO_HR: {
        const hrEmails = await getHrOfficialEmails();
        const body = `<p>Line manager has submitted the manager section for HR review.</p>
          ${employeeDetailsBlock(pdr)}
          <p><strong>Line manager:</strong> ${
            pdr.linemanager ? fullName(pdr.linemanager) : "—"
          }</p>
          <p><a href="${link}">Review PDR</a></p>`;
        for (const to of hrEmails) {
          push(
            to,
            `${cycle} — ${employeeName} PDR submitted (manager section)`,
            body,
          );
        }
        break;
      }

      case PdrOverallStatus.HR_REVERTED_TO_MANAGER:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Manager section returned (${employeeName})`,
          `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>HR has returned the manager section for <strong>${employeeName}</strong>.</p>
           ${revertMessage ? `<p><strong>Message from HR:</strong></p><blockquote>${revertMessage}</blockquote>` : ""}
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Update PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.HR_APPROVED_MANAGER:
        push(
          resolveNotifyEmail(pdr.director),
          `${cycle} — Director review required (${employeeName})`,
          `<p>Hello ${pdr.director?.firstName || "Director"},</p>
           <p>HR has approved the manager section. The PDR is ready for director review.</p>
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Review PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.DIRECTOR_REVIEWED:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — Please acknowledge your PDR`,
          `<p>Hello ${pdr.user.firstName},</p>
           <p>Director review is complete. Please review and acknowledge your PDR.</p>
           <!-- <p><a href="${link}">Acknowledge PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING:
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — Please acknowledge your PDR`,
          `<p>Hello ${pdr.user.firstName},</p>
           <p>Your line manager has updated the PDR. Please review and acknowledge.</p>
           <!-- <p><a href="${link}">Acknowledge PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.EMPLOYEE_DISAGREED: {
        const hrEmails = await getHrOfficialEmails();
        const body = `<p>The employee has disagreed with the PDR and requires HR attention.</p>
          ${employeeDetailsBlock(pdr)}
          <p><a href="${link}">View PDR</a></p>`;
        for (const to of hrEmails) {
          push(to, `${cycle} — ${employeeName} disagreed with PDR`, body);
        }
        break;
      }

      case PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Revisions required (${employeeName})`,
          `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>HR has requested manager revisions for <strong>${employeeName}</strong>'s PDR.</p>
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Open PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.MANAGER_REVISING:
        push(
          resolveNotifyEmail(pdr.linemanager),
          `${cycle} — Please revise manager section (${employeeName})`,
          `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>Please revise the manager section for <strong>${employeeName}</strong>.</p>
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Open PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        break;

      case PdrOverallStatus.COMPLETED: {
        push(
          resolveNotifyEmail(pdr.user),
          `${cycle} — Your PDR is completed`,
          `<p>Hello ${pdr.user.firstName},</p>
           <p>Your Performance Development Review for <strong>${cycle}</strong> is now complete.</p>
           <!-- <p><a href="${link}">View PDR</a></p>-->`, // TODO: Uncomment this when the link is ready
        );
        const hrEmails = await getHrOfficialEmails();
        const hrBody = `<p>PDR workflow is complete.</p>${employeeDetailsBlock(pdr)}`;
        for (const to of hrEmails) {
          push(to, `${cycle} — PDR completed (${employeeName})`, hrBody);
        }
        break;
      }

      default:
        break;
    }

    return out;
  }
}
