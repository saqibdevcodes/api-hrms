import { PdrOverallStatus } from "@prisma/client";
import { emailQueue } from "./email.queue";
import { EMAIL_EVENTS } from "../constants/email.events";
import {
  AttendanceReminderJobData,
} from "../services/attendanceReminderService";
import {
  PdrEmailJobData,
  PdrEmailNotificationService,
} from "../services/pdrEmailNotificationService";

export const queuePdrStatusEmail = (data: PdrEmailJobData) => {
  if (!PdrEmailNotificationService.shouldNotify(data.targetStatus)) {
    return Promise.resolve(null);
  }
  return emailQueue.add(EMAIL_EVENTS.PDR_STATUS_NOTIFY, data);
};

/** After HR creates a PDR (single or bulk via createPdr). */
export const queuePdrCreatedEmail = (pdrId: number | string) => {
  return queuePdrStatusEmail({
    pdrId: Number(pdrId),
    targetStatus: PdrOverallStatus.CREATED_BY_HR,
  });
};

export const queueAttendanceReminderEmail = (data: AttendanceReminderJobData) => {
  return emailQueue.add(EMAIL_EVENTS.ATTENDANCE_REMINDER, data);
};
