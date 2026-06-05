"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const email_events_1 = require("../constants/email.events");
const redis_1 = require("../config/redis");
const attendanceReminderService_1 = require("../services/attendanceReminderService");
const pdrEmailNotificationService_1 = require("../services/pdrEmailNotificationService");
console.log("📬 Email worker listening on queue: email-queue");
new bullmq_1.Worker("email-queue", async (job) => {
    console.log(`📥 Processing job ${job.id} [${job.name}]`, job.data);
    switch (job.name) {
        case email_events_1.EMAIL_EVENTS.PDR_STATUS_NOTIFY:
            await pdrEmailNotificationService_1.PdrEmailNotificationService.processJob(job.data);
            break;
        case email_events_1.EMAIL_EVENTS.ATTENDANCE_REMINDER:
            await attendanceReminderService_1.AttendanceReminderService.processJob(job.data);
            break;
        default:
            throw new Error(`Unknown email event: ${job.name}`);
    }
}, {
    connection: redis_1.redisConnection.options,
    concurrency: 10,
});
