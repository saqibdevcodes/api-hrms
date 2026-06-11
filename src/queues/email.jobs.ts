import { PdrOverallStatus } from "@prisma/client";
import { EMAIL_EVENTS } from "../constants/email.events";
import {
  AttendanceReminderJobData,
} from "../services/attendanceReminderService";
import { EmailQueueService } from "../services/emailQueueService";
import {
  PdrEmailJobData,
  PdrEmailNotificationService,
} from "../services/pdrEmailNotificationService";

export const queuePdrStatusEmail = (data: PdrEmailJobData) => {
  if (!PdrEmailNotificationService.shouldNotify(data.targetStatus)) {
    return Promise.resolve(null);
  }
  return EmailQueueService.enqueue(EMAIL_EVENTS.PDR_STATUS_NOTIFY, data);
};

/** After HR creates a PDR (single or bulk via createPdr). */
export const queuePdrCreatedEmail = (pdrId: number | string) => {
  return queuePdrStatusEmail({
    pdrId: Number(pdrId),
    targetStatus: PdrOverallStatus.CREATED_BY_HR,
  });
};

export const queueAttendanceReminderEmail = (data: AttendanceReminderJobData) => {
  return EmailQueueService.enqueue(EMAIL_EVENTS.ATTENDANCE_REMINDER, data);
};
