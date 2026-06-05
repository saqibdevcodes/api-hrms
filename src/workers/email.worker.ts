import "dotenv/config";
import { Worker } from "bullmq";
import { EMAIL_EVENTS } from "../constants/email.events";
import { redisConnection } from "../config/redis";
import {
  AttendanceReminderJobData,
  AttendanceReminderService,
} from "../services/attendanceReminderService";
import {
  PdrEmailJobData,
  PdrEmailNotificationService,
} from "../services/pdrEmailNotificationService";

console.log("📬 Email worker listening on queue: email-queue");

new Worker(
  "email-queue",
  async (job) => {
    console.log(`📥 Processing job ${job.id} [${job.name}]`, job.data);

    switch (job.name) {
      case EMAIL_EVENTS.PDR_STATUS_NOTIFY:
        await PdrEmailNotificationService.processJob(
          job.data as PdrEmailJobData,
        );
        break;

      case EMAIL_EVENTS.ATTENDANCE_REMINDER:
        await AttendanceReminderService.processJob(
          job.data as AttendanceReminderJobData,
        );
        break;

      default:
        throw new Error(`Unknown email event: ${job.name}`);
    }
  },
  {
    connection: redisConnection.options,
    concurrency: 10,
  },
);
