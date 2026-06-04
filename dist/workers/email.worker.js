"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/workers/email.worker.ts
const bullmq_1 = require("bullmq");
const email_events_1 = require("../constants/email.events");
const emailService_1 = require("../utils/emailService");
const prisma_1 = require("../lib/prisma");
new bullmq_1.Worker("email-queue", async (job) => {
    switch (job.name) {
        case email_events_1.EMAIL_EVENTS.PDR_CREATED: {
            const pdr = await prisma_1.prisma.pdr.findUnique({
                where: { id: job.data.pdrId },
                include: { user: true },
            });
            if (!pdr)
                throw new Error("PDR not found");
            await emailService_1.EmailService.sendEmail(pdr.user.officialEmail || "", "PDR Created", `<p>Hello ${pdr.user.firstName}, your PDR is created.</p>`);
            break;
        }
        default:
            throw new Error(`Unknown event: ${job.name}`);
    }
}, {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
    concurrency: 10,
});
