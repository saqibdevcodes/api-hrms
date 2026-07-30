import { EmailService } from "../utils/emailService";
import { EmailQueueService } from "./emailQueueService";
import { EMAIL_EVENTS } from "../constants/email.events";
import { ICalGenerator } from "../utils/iCalGenerator";
import { prisma } from "../lib/prisma";

export class EventNotificationService {
  /**
   * Enqueue event creation & host email jobs to background database queue
   */
  static async sendEventCreatedNotifications(event: any, createdBy: any, isUpdate = false) {
    const recipientsMap = new Map<string, { employee: any; responsibilityType: string }>();

    // 1. Add assigned team members
    if (event.assignees && event.assignees.length) {
      for (const a of event.assignees) {
        if (a.employee && a.employee.email) {
          recipientsMap.set(a.employee.email.toLowerCase().trim(), {
            employee: a.employee,
            responsibilityType: a.responsibilityType || "Responsible Person",
          });
        }
      }
    }

    // 2. Add Event Host if assigned and has an email
    if (event.eventHostUser && event.eventHostUser.email) {
      const hostEmail = event.eventHostUser.email.toLowerCase().trim();
      recipientsMap.set(hostEmail, {
        employee: event.eventHostUser,
        responsibilityType: "Event Host / Organizer",
      });
    }

    if (!recipientsMap.size) return;

    // Enqueue 1 notification per recipient
    for (const [recipientEmail, { employee, responsibilityType }] of recipientsMap.entries()) {
      try {
        await EmailQueueService.enqueue(EMAIL_EVENTS.EVENT_CREATED, {
          eventId: event.id,
          eventTitle: event.title,
          description: event.description,
          eventDate: event.eventDate,
          eventEndDate: event.eventEndDate,
          startTime: event.startTime,
          endTime: event.endTime,
          mode: event.mode,
          priority: event.priority,
          venueName: event.venue?.name || event.customVenueName || "To Be Specified",
          onlinePlatform: event.onlinePlatform,
          meetingLink: event.meetingLink,
          recipientEmail,
          recipientName: `${employee.firstName} ${employee.lastName}`,
          responsibilityType,
          createdByName: createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : "HR Management",
          isUpdate: Boolean(isUpdate),
        });
      } catch (queueErr) {
        console.error("Failed to enqueue event email job:", queueErr);
      }
    }
  }

  /**
   * Trigger in-process background email worker execution
   */
  static triggerQueueProcessing() {
    setImmediate(() => {
      EmailQueueService.processBatch(50).catch((err) =>
        console.error("Error processing email queue batch:", err),
      );
    });
  }

  /**
   * Enqueue aggregated requirement assignment notification jobs (1 single email per person)
   */
  static async sendRequirementNotifications(event: any, createdBy: any, isUpdate = false) {
    if (!event.requirements || !event.requirements.length) return;

    const assignedReqs = event.requirements.filter(
      (r: any) => r.assignedEmployee && r.assignedEmployee.email,
    );

    if (!assignedReqs.length) return;

    // Group requirements by assigned employee email
    const groupedByEmail = new Map<string, { employee: any; reqs: any[] }>();

    for (const r of assignedReqs) {
      const email = r.assignedEmployee.email.toLowerCase().trim();
      if (!groupedByEmail.has(email)) {
        groupedByEmail.set(email, { employee: r.assignedEmployee, reqs: [] });
      }
      groupedByEmail.get(email)!.reqs.push({
        name: r.requirement?.name || r.customRequirement || "Department Requirement",
        quantity: r.quantity,
        unit: r.unit,
        notes: r.notes,
        departmentName: r.departmentName || r.assignedEmployee.department || "Department Staff",
      });
    }

    // Enqueue exactly 1 aggregated email per recipient containing ALL assigned requirements
    for (const [recipientEmail, { employee, reqs }] of groupedByEmail.entries()) {
      try {
        await EmailQueueService.enqueue(EMAIL_EVENTS.EVENT_REQUIREMENT_NOTIFY, {
          eventId: event.id,
          eventTitle: event.title,
          description: event.description,
          eventDate: event.eventDate,
          eventEndDate: event.eventEndDate,
          startTime: event.startTime,
          endTime: event.endTime,
          mode: event.mode,
          venueName: event.venue?.name || event.customVenueName || "Virtual",
          meetingLink: event.meetingLink,
          requirementsList: reqs,
          departmentName: reqs[0]?.departmentName || employee.department || "Department Staff",
          recipientEmail,
          recipientName: `${employee.firstName} ${employee.lastName}`,
          createdByName: createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : "HR Management",
          isUpdate: Boolean(isUpdate),
        });
      } catch (queueErr) {
        console.error("Failed to enqueue requirement email job:", queueErr);
      }
    }
  }

  /**
   * Enqueue cancellation notification jobs (including Host)
   */
  static async sendEventCancelledNotifications(event: any, cancellationReason: string, cancelledBy: any) {
    const recipientsMap = new Map<string, any>();

    if (event.assignees && event.assignees.length) {
      for (const a of event.assignees) {
        if (a.employee && a.employee.email) {
          recipientsMap.set(a.employee.email.toLowerCase().trim(), a.employee);
        }
      }
    }

    if (event.eventHostUser && event.eventHostUser.email) {
      recipientsMap.set(event.eventHostUser.email.toLowerCase().trim(), event.eventHostUser);
    }

    if (!recipientsMap.size) return;

    for (const [recipientEmail, employee] of recipientsMap.entries()) {
      try {
        await EmailQueueService.enqueue(EMAIL_EVENTS.EVENT_CANCELLED, {
          eventId: event.id,
          eventTitle: event.title,
          cancellationReason,
          recipientEmail,
          recipientName: `${employee.firstName} ${employee.lastName}`,
          cancelledByName: cancelledBy ? `${cancelledBy.firstName} ${cancelledBy.lastName}` : "HR Management",
        });
      } catch (queueErr) {
        console.error("Failed to enqueue cancellation email job:", queueErr);
      }
    }
  }

  /**
   * Send notification to HR when a Line Manager submits a new event requiring approval
   */
  static async sendPendingApprovalNotificationToHR(event: any, createdBy: any) {
    try {
      const hrUsers = await prisma.user.findMany({
        where: {
          OR: [
            { role: "HR" },
            { email: { equals: "nadia@iriscommunications.com.pk" } },
          ],
          status: "ACTIVE",
          isActive: true,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      const recipientMap = new Map<string, { name: string }>();

      for (const hrUser of hrUsers) {
        if (hrUser.email) {
          recipientMap.set(hrUser.email.toLowerCase(), {
            name: `${hrUser.firstName} ${hrUser.lastName}`,
          });
        }
      }

      // Always ensure Nadia (HR) receives the approval alert notification
      if (!recipientMap.has("nadia@iriscommunications.com.pk")) {
        recipientMap.set("nadia@iriscommunications.com.pk", {
          name: "Nadia (HR)",
        });
      }

      const eventDateStr = new Date(event.eventDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const creatorName = createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : "Line Manager";

      for (const [recipientEmail, recipientInfo] of recipientMap.entries()) {
        const subject = `[ACTION REQUIRED] New Event Pending HR Approval: "${event.title}"`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 24px; text-align: left;">
              <h2 style="margin: 0; font-size: 20px;">⌛ Event Pending HR Approval</h2>
              <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Iris HRMS Event Management</p>
            </div>
            
            <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
              <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientInfo.name}</strong>,</p>
              <p>A new event has been created by Line Manager <strong>${creatorName}</strong> and requires HR review & approval before member assignment notifications are sent out.</p>
              
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; color: #78350f; font-size: 16px;">${event.title}</h3>
                <p style="margin: 3px 0; font-size: 14px; color: #92400e;"><strong>Submitted By:</strong> ${creatorName}</p>
                <p style="margin: 3px 0; font-size: 14px; color: #92400e;"><strong>Date:</strong> ${eventDateStr}</p>
                <p style="margin: 3px 0; font-size: 14px; color: #92400e;"><strong>Mode / Venue:</strong> ${event.mode} | ${event.venue?.name || event.customVenueName || "To Be Specified"}</p>
              </div>

              <p style="font-size: 14px; color: #475569;">
                Please log in to Iris HRMS Event Management to review and Approve or Cancel/Reject this event request.
              </p>
            </div>
          </div>
        `;

        await EmailService.sendEmail(recipientEmail, subject, html).catch((err) =>
          console.error(`Failed to send HR approval notification to ${recipientEmail}:`, err),
        );
      }
    } catch (err) {
      console.error("Error sending pending approval notifications to HR:", err);
    }
  }

  /**
   * Send notification to Line Manager when HR approves their submitted event
   */
  static async sendEventApprovedNotificationToManager(event: any, approvedBy: any) {
    try {
      if (!event.createdById) return;
      const creator = await prisma.user.findUnique({
        where: { id: event.createdById },
        select: { firstName: true, lastName: true, email: true },
      });

      if (!creator || !creator.email) return;

      const subject = `[EVENT APPROVED] Your Event "${event.title}" Has Been Approved`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: white; padding: 24px; text-align: left;">
            <h2 style="margin: 0; font-size: 20px;">✅ Event Approved</h2>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Iris HRMS Event Management</p>
          </div>
          
          <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
            <p style="font-size: 15px; margin-top: 0;">Hello <strong>${creator.firstName} ${creator.lastName}</strong>,</p>
            <p>Your submitted event <strong>"${event.title}"</strong> has been reviewed and <strong style="color: #15803d;">APPROVED</strong> by HR (${approvedBy ? `${approvedBy.firstName} ${approvedBy.lastName}` : "HR Management"}).</p>
            <p>All assignment notifications and task emails have now been dispatched to event personnel.</p>
          </div>
        </div>
      `;

      await EmailService.sendEmail(creator.email, subject, html);
    } catch (err) {
      console.error("Error sending event approved notification to manager:", err);
    }
  }

  /**
   * Worker processor: process enqueued event creation & host assignment job with Calendar Invite
   */
  static async processEventCreatedJob(data: any) {
    const isUpdate = Boolean(data.isUpdate);

    const eventDateStr = new Date(data.eventDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const eventEndDateStr = data.eventEndDate
      ? new Date(data.eventEndDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const fullDateRangeStr = eventEndDateStr
      ? `${eventDateStr} to ${eventEndDateStr}`
      : eventDateStr;

    const startTimeStr = new Date(data.startTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const endTimeStr = data.endTime
      ? new Date(data.endTime).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

    const icsContent = ICalGenerator.generateICS({
      eventId: data.eventId,
      title: isUpdate ? `[UPDATED] ${data.eventTitle}` : data.eventTitle,
      description: data.description,
      eventDate: data.eventDate,
      eventEndDate: data.eventEndDate,
      startTime: data.startTime,
      endTime: data.endTime,
      venueName: data.venueName,
      meetingLink: data.meetingLink,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
    });

    const gcalUrl = ICalGenerator.generateGoogleCalendarLink({
      title: isUpdate ? `[UPDATED] ${data.eventTitle}` : data.eventTitle,
      description: data.description,
      eventDate: data.eventDate,
      eventEndDate: data.eventEndDate,
      startTime: data.startTime,
      endTime: data.endTime,
      venueName: data.venueName,
      meetingLink: data.meetingLink,
    });

    const subject = isUpdate
      ? `[EVENT UPDATED] ${data.eventTitle} - ${fullDateRangeStr}`
      : `[Event Assignment] ${data.eventTitle} - ${fullDateRangeStr}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, ${isUpdate ? "#4338ca 0%, #6366f1" : "#1e3a8a 0%, #3b82f6"} 100%); color: white; padding: 24px; text-align: left;">
          <h2 style="margin: 0; font-size: 20px;">${isUpdate ? "📝 Event Details Updated" : "📅 New Event Assignment"}</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Iris HRMS Event Management</p>
        </div>
        
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${data.recipientName}</strong>,</p>
          <p>${isUpdate ? "The details for an upcoming company event you are assigned to as" : "You have been assigned to an upcoming company event as"} <strong>${data.responsibilityType}</strong> have been ${isUpdate ? "updated" : "assigned"}.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid ${isUpdate ? "#6366f1" : "#3b82f6"}; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #0f172a; font-size: 16px;">${data.eventTitle}</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; width: 130px;"><strong>Date:</strong></td>
                <td style="padding: 4px 0; color: #0f172a;">${fullDateRangeStr}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;"><strong>Time:</strong></td>
                <td style="padding: 4px 0; color: #0f172a;">${startTimeStr} ${data.endTime ? `- ${endTimeStr}` : ""}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;"><strong>Mode / Venue:</strong></td>
                <td style="padding: 4px 0; color: #0f172a;">${data.mode} | ${data.venueName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;"><strong>Priority:</strong></td>
                <td style="padding: 4px 0; color: #0f172a;"><span style="display: inline-block; padding: 2px 8px; background-color: #fef3c7; color: #92400e; font-weight: bold; border-radius: 4px; font-size: 12px;">${data.priority}</span></td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;"><strong>Your Role:</strong></td>
                <td style="padding: 4px 0; color: #2563eb; font-weight: bold;">${data.responsibilityType}</td>
              </tr>
            </table>
          </div>

          <!-- Add to Calendar Action Button -->
          <div style="margin: 24px 0; text-align: center;">
            <a href="${gcalUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: ${isUpdate ? "#4f46e5" : "#2563eb"}; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              📅 Update Google Calendar
            </a>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
              (An updated <strong>.ics calendar file</strong> is attached to this email for Outlook / Apple Calendar)
            </p>
          </div>

          ${
            data.description
              ? `<div style="margin-bottom: 20px;">
                  <h4 style="margin: 0 0 6px 0; font-size: 14px; color: #475569;">Description:</h4>
                  <p style="margin: 0; font-size: 14px; color: #334155; background: #f1f5f9; padding: 10px; border-radius: 6px;">${data.description}</p>
                 </div>`
              : ""
          }

          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            ${isUpdate ? "Updated by" : "Created by"}: <strong>${data.createdByName}</strong>
          </p>
        </div>
      </div>
    `;

    await EmailService.sendEmail(data.recipientEmail, subject, html, {
      icalEvent: {
        filename: `${data.eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
        method: "REQUEST",
        content: icsContent,
      },
      attachments: [
        {
          filename: `${data.eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
          content: icsContent,
          contentType: "text/calendar; charset=UTF-8; method=REQUEST",
        },
      ],
    });
  }

  /**
   * Worker processor: process aggregated requirements assignment job with Calendar Invite
   */
  static async processRequirementJob(data: any) {
    const isUpdate = Boolean(data.isUpdate);

    const eventDateStr = new Date(data.eventDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const eventEndDateStr = data.eventEndDate
      ? new Date(data.eventEndDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const fullDateRangeStr = eventEndDateStr
      ? `${eventDateStr} to ${eventEndDateStr}`
      : eventDateStr;

    const reqsList: any[] = data.requirementsList || [
      {
        name: data.requirementName,
        quantity: data.quantity,
        unit: data.unit,
        notes: data.notes,
      },
    ];

    const icsContent = ICalGenerator.generateICS({
      eventId: data.eventId,
      title: `${isUpdate ? "[UPDATED] " : ""}${data.eventTitle} (${reqsList.length} Tasks)`,
      description: `Assigned Department Requirements:\n${reqsList.map((r: any) => `- ${r.name}${r.quantity ? ` (Qty: ${r.quantity})` : ""}`).join("\n")}`,
      eventDate: data.eventDate,
      eventEndDate: data.eventEndDate,
      startTime: data.startTime,
      endTime: data.endTime,
      venueName: data.venueName,
      meetingLink: data.meetingLink,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
    });

    const gcalUrl = ICalGenerator.generateGoogleCalendarLink({
      title: `${isUpdate ? "[UPDATED] " : ""}${data.eventTitle} (${reqsList.length} Tasks)`,
      description: `Assigned Requirements:\n${reqsList.map((r: any) => `- ${r.name}`).join("\n")}`,
      eventDate: data.eventDate,
      eventEndDate: data.eventEndDate,
      startTime: data.startTime,
      endTime: data.endTime,
      venueName: data.venueName,
      meetingLink: data.meetingLink,
    });

    const subject = isUpdate
      ? `[EVENT UPDATED] ${reqsList.length} Requirement Task(s) Updated for Event "${data.eventTitle}"`
      : `[ACTION REQUIRED] ${reqsList.length} Requirement(s) Assigned for Event "${data.eventTitle}"`;

    const reqRowsHtml = reqsList
      .map(
        (r: any, idx: number) => `
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px 12px; font-weight: bold; color: #0f172a;">${idx + 1}. ${r.name}</td>
            <td style="padding: 10px 12px; color: #166534; font-weight: bold;">${r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td>
            <td style="padding: 10px 12px; color: #475569; font-size: 13px;">${r.notes || "None"}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, ${isUpdate ? "#0d9488 0%, #14b8a6" : "#0f766e 0%, #0d9488"} 100%); color: white; padding: 24px; text-align: left;">
          <h2 style="margin: 0; font-size: 20px;">${isUpdate ? "🛠️ Department Requirements Updated" : "🛠️ Department Requirement Tasks Assigned"} (${reqsList.length})</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Iris HRMS Event Management</p>
        </div>
        
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${data.recipientName}</strong> (${data.departmentName}),</p>
          <p>${isUpdate ? "The requirement tasks assigned to your department for an upcoming company event have been updated:" : `You have been assigned to manage the following <strong>${reqsList.length} requirement task(s)</strong> for an upcoming company event:`}</p>
          
          <div style="margin: 20px 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
              <thead style="background-color: #0f766e; color: #ffffff;">
                <tr>
                  <th style="padding: 10px 12px; font-size: 13px;">Requirement Item</th>
                  <th style="padding: 10px 12px; font-size: 13px;">Quantity</th>
                  <th style="padding: 10px 12px; font-size: 13px;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${reqRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Add to Calendar Action Button -->
          <div style="margin: 24px 0; text-align: center;">
            <a href="${gcalUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #0d9488; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              📅 Update Tasks in Google Calendar
            </a>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #334155;">Event Details:</h4>
            <p style="margin: 3px 0; font-size: 13px;"><strong>Event:</strong> ${data.eventTitle}</p>
            <p style="margin: 3px 0; font-size: 13px;"><strong>Date:</strong> ${fullDateRangeStr}</p>
            <p style="margin: 3px 0; font-size: 13px;"><strong>Mode/Venue:</strong> ${data.mode} | ${data.venueName}</p>
          </div>

          <p style="font-size: 13px; color: #64748b;">
            ${isUpdate ? "Updated by" : "Assigned by"}: <strong>${data.createdByName}</strong>
          </p>
        </div>
      </div>
    `;

    await EmailService.sendEmail(data.recipientEmail, subject, html, {
      icalEvent: {
        filename: `Event_Tasks.ics`,
        method: "REQUEST",
        content: icsContent,
      },
      attachments: [
        {
          filename: `Event_Tasks.ics`,
          content: icsContent,
          contentType: "text/calendar; charset=UTF-8; method=REQUEST",
        },
      ],
    });
  }

  /**
   * Worker processor: process event cancellation job
   */
  static async processEventCancelledJob(data: any) {
    const subject = `[EVENT CANCELLED] ${data.eventTitle}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background: #dc2626; color: white; padding: 24px; text-align: left;">
          <h2 style="margin: 0; font-size: 20px;">🚫 Event Cancelled</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Iris HRMS Event Management</p>
        </div>
        
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${data.recipientName}</strong>,</p>
          <p>Please be informed that the following event has been <strong>CANCELLED</strong>:</p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #991b1b; font-size: 16px;">${data.eventTitle}</h3>
            <p style="margin: 0; font-size: 14px; color: #7f1d1d;">Reason: <strong>${data.cancellationReason || "No specific reason provided."}</strong></p>
          </div>
        </div>
      </div>
    `;

    await EmailService.sendEmail(data.recipientEmail, subject, html);
  }
}
