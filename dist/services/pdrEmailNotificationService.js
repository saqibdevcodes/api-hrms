"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdrEmailNotificationService = void 0;
const client_1 = require("@prisma/client");
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
const emailService_1 = require("../utils/emailService");
const SKIP_NOTIFY_STATUSES = [
    client_1.PdrOverallStatus.HR_REVIEWING_EMPLOYEE,
    client_1.PdrOverallStatus.HR_REVIEWING_MANAGER,
    client_1.PdrOverallStatus.EMPLOYEE_FILLING,
    client_1.PdrOverallStatus.DIRECTOR_REVIEWING,
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
};
/** Prefer officialEmail; fall back to login email when official is not set. */
function resolveNotifyEmail(user) {
    if (!user)
        return null;
    const official = user.officialEmail?.trim();
    if (official)
        return official;
    const login = user.email?.trim();
    if (login) {
        console.warn(`⚠️ No officialEmail for ${user.firstName ?? "user"} — using login email: ${login}`);
        return login;
    }
    return null;
}
function fullName(user) {
    return `${user.firstName} ${user.lastName}`.trim();
}
function pdrLink(pdrId) {
    const base = (env_1.config.COMPANY_DOMAIN || "").replace(/\/$/, "");
    return `${base}/pdr/${pdrId}`;
}
function employeeDetailsBlock(pdr) {
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
function emailLayout(title, bodyHtml) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <h2 style="color:#4F46E5;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;color:#666;font-size:12px;">
        ${env_1.config.COMPANY_NAME} — automated PDR notification
      </p>
    </div>
  `;
}
async function getHrOfficialEmails() {
    const hrUsers = await prisma_1.prisma.user.findMany({
        where: {
            role: { in: [client_1.Role.HR, client_1.Role.ADMIN] },
            isActive: true,
        },
        select: { officialEmail: true, email: true },
    });
    const emails = new Set();
    for (const u of hrUsers) {
        const addr = resolveNotifyEmail(u);
        if (addr)
            emails.add(addr);
    }
    return [...emails];
}
class PdrEmailNotificationService {
    static shouldNotify(targetStatus) {
        return !SKIP_NOTIFY_STATUSES.includes(targetStatus);
    }
    static async processJob(data) {
        if (!this.shouldNotify(data.targetStatus))
            return;
        const pdr = await prisma_1.prisma.pdr.findUnique({
            where: { id: data.pdrId },
            include: pdrInclude,
        });
        if (!pdr)
            throw new Error(`PDR ${data.pdrId} not found`);
        const notifications = await this.buildNotifications(pdr, data);
        if (notifications.length === 0) {
            console.warn(`⚠️ PDR #${data.pdrId} [${data.targetStatus}]: no recipients — employee/manager/director may be missing officialEmail`);
            return;
        }
        console.log(`📧 PDR #${data.pdrId} [${data.targetStatus}] → ${notifications.map((n) => n.to).join(", ")}`);
        for (const n of notifications) {
            await emailService_1.EmailService.sendEmail(n.to, n.subject, n.html);
        }
    }
    static async buildNotifications(pdr, data) {
        const { targetStatus, fromStatus, revertMessage } = data;
        const employeeName = fullName(pdr.user);
        const cycle = pdr.pdr_cycle || "PDR";
        const link = pdrLink(pdr.id);
        const out = [];
        const push = (to, subject, body) => {
            if (!to)
                return;
            out.push({ to, subject, html: emailLayout(subject, body) });
        };
        switch (targetStatus) {
            case client_1.PdrOverallStatus.CREATED_BY_HR:
                push(resolveNotifyEmail(pdr.user), `${cycle} — PDR created for you`, `<p>Hello ${pdr.user.firstName},</p>
           <p>HR has created your Performance Development Review for <strong>${cycle}</strong>.</p>
           <p>Please log in and complete your section when ready.</p>
          <!-- <p><a href="${link}">Open your PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.EMPLOYEE_SUBMITTED_TO_HR: {
                const hrEmails = await getHrOfficialEmails();
                const body = `<p>An employee has submitted their PDR section for HR review.</p>
          ${employeeDetailsBlock(pdr)}
          <p><a href="${link}">Review PDR</a></p>`;
                for (const to of hrEmails) {
                    push(to, `${cycle} — ${employeeName} submitted PDR (employee section)`, body);
                }
                break;
            }
            case client_1.PdrOverallStatus.HR_REVERTED_TO_EMPLOYEE:
                push(resolveNotifyEmail(pdr.user), `${cycle} — PDR returned for revision`, `<p>Hello ${pdr.user.firstName},</p>
           <p>HR has returned your PDR for revision.</p>
           ${revertMessage ? `<p><strong>Message from HR:</strong></p><blockquote>${revertMessage}</blockquote>` : ""}
           <!-- <p><a href="${link}">Update your PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE:
                push(resolveNotifyEmail(pdr.linemanager), `${cycle} — Manager section required (${employeeName})`, `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>HR has approved the employee section for <strong>${employeeName}</strong>.</p>
           ${employeeDetailsBlock(pdr)}
           <p>Please complete the line manager section.</p>
           <!-- <p><a href="${link}">Open PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.MANAGER_FILLING:
                if (fromStatus === client_1.PdrOverallStatus.HR_APPROVED_EMPLOYEE ||
                    fromStatus === client_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER) {
                    push(resolveNotifyEmail(pdr.linemanager), `${cycle} — Your turn: line manager section (${employeeName})`, `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
             <p>You may now fill the line manager section for <strong>${employeeName}</strong>.</p>
             ${employeeDetailsBlock(pdr)}
             <!-- <p><a href="${link}">Open PDR</a></p>-->`);
                }
                break;
            case client_1.PdrOverallStatus.MANAGER_SUBMITTED_TO_HR: {
                const hrEmails = await getHrOfficialEmails();
                const body = `<p>Line manager has submitted the manager section for HR review.</p>
          ${employeeDetailsBlock(pdr)}
          <p><strong>Line manager:</strong> ${pdr.linemanager ? fullName(pdr.linemanager) : "—"}</p>
          <p><a href="${link}">Review PDR</a></p>`;
                for (const to of hrEmails) {
                    push(to, `${cycle} — ${employeeName} PDR submitted (manager section)`, body);
                }
                break;
            }
            case client_1.PdrOverallStatus.HR_REVERTED_TO_MANAGER:
                push(resolveNotifyEmail(pdr.linemanager), `${cycle} — Manager section returned (${employeeName})`, `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>HR has returned the manager section for <strong>${employeeName}</strong>.</p>
           ${revertMessage ? `<p><strong>Message from HR:</strong></p><blockquote>${revertMessage}</blockquote>` : ""}
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Update PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.HR_APPROVED_MANAGER:
                push(resolveNotifyEmail(pdr.director), `${cycle} — Director review required (${employeeName})`, `<p>Hello ${pdr.director?.firstName || "Director"},</p>
           <p>HR has approved the manager section. The PDR is ready for director review.</p>
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Review PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.DIRECTOR_REVIEWED:
                push(resolveNotifyEmail(pdr.user), `${cycle} — Please acknowledge your PDR`, `<p>Hello ${pdr.user.firstName},</p>
           <p>Director review is complete. Please review and acknowledge your PDR.</p>
           <!-- <p><a href="${link}">Acknowledge PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.EMPLOYEE_ACKNOWLEDGING:
                push(resolveNotifyEmail(pdr.user), `${cycle} — Please acknowledge your PDR`, `<p>Hello ${pdr.user.firstName},</p>
           <p>Your line manager has updated the PDR. Please review and acknowledge.</p>
           <!-- <p><a href="${link}">Acknowledge PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.EMPLOYEE_DISAGREED: {
                const hrEmails = await getHrOfficialEmails();
                const body = `<p>The employee has disagreed with the PDR and requires HR attention.</p>
          ${employeeDetailsBlock(pdr)}
          <p><a href="${link}">View PDR</a></p>`;
                for (const to of hrEmails) {
                    push(to, `${cycle} — ${employeeName} disagreed with PDR`, body);
                }
                break;
            }
            case client_1.PdrOverallStatus.EMPLOYEE_REVERT_TO_MANAGER:
                push(resolveNotifyEmail(pdr.linemanager), `${cycle} — Revisions required (${employeeName})`, `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>HR has requested manager revisions for <strong>${employeeName}</strong>'s PDR.</p>
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Open PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.MANAGER_REVISING:
                push(resolveNotifyEmail(pdr.linemanager), `${cycle} — Please revise manager section (${employeeName})`, `<p>Hello ${pdr.linemanager?.firstName || "Manager"},</p>
           <p>Please revise the manager section for <strong>${employeeName}</strong>.</p>
           ${employeeDetailsBlock(pdr)}
           <!-- <p><a href="${link}">Open PDR</a></p>-->`);
                break;
            case client_1.PdrOverallStatus.COMPLETED: {
                push(resolveNotifyEmail(pdr.user), `${cycle} — Your PDR is completed`, `<p>Hello ${pdr.user.firstName},</p>
           <p>Your Performance Development Review for <strong>${cycle}</strong> is now complete.</p>
           <!-- <p><a href="${link}">View PDR</a></p>-->`);
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
exports.PdrEmailNotificationService = PdrEmailNotificationService;
