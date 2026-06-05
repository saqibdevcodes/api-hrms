"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const email_events_1 = require("../constants/email.events");
const redis_1 = require("../config/redis");
const pdrEmailNotificationService_1 = require("../services/pdrEmailNotificationService");
new bullmq_1.Worker("email-queue", async (job) => {
    switch (job.name) {
        case email_events_1.EMAIL_EVENTS.PDR_STATUS_NOTIFY:
            await pdrEmailNotificationService_1.PdrEmailNotificationService.processJob(job.data);
            break;
        default:
            throw new Error(`Unknown email event: ${job.name}`);
    }
}, {
    connection: redis_1.redisConnection.options,
    concurrency: 10,
});
