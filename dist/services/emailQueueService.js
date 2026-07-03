"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailQueueService = void 0;
const client_1 = require("@prisma/client");
const email_events_1 = require("../constants/email.events");
const prisma_1 = require("../lib/prisma");
const attendanceReminderService_1 = require("./attendanceReminderService");
const pdrEmailNotificationService_1 = require("./pdrEmailNotificationService");
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60000;
class EmailQueueService {
    static async enqueue(event, payload, options) {
        const job = await prisma_1.prisma.emailJob.create({
            data: {
                event,
                payload: payload,
                status: client_1.EmailJobStatus.PENDING,
                scheduledAt: options?.scheduledAt ?? new Date(),
                maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            },
        });
        console.log(`📬 Email job queued [${job.id}] event=${event}`);
        return job;
    }
    static async claimNextJob() {
        const candidate = await prisma_1.prisma.emailJob.findFirst({
            where: {
                status: client_1.EmailJobStatus.PENDING,
                scheduledAt: { lte: new Date() },
            },
            orderBy: { scheduledAt: "asc" },
        });
        if (!candidate) {
            return null;
        }
        const claimed = await prisma_1.prisma.emailJob.updateMany({
            where: {
                id: candidate.id,
                status: client_1.EmailJobStatus.PENDING,
            },
            data: {
                status: client_1.EmailJobStatus.PROCESSING,
                startedAt: new Date(),
                attempts: { increment: 1 },
            },
        });
        if (claimed.count === 0) {
            return null;
        }
        return prisma_1.prisma.emailJob.findUnique({ where: { id: candidate.id } });
    }
    static async markCompleted(jobId) {
        await prisma_1.prisma.emailJob.update({
            where: { id: jobId },
            data: {
                status: client_1.EmailJobStatus.COMPLETED,
                completedAt: new Date(),
                lastError: null,
            },
        });
    }
    static async markFailed(job, error) {
        const message = error instanceof Error ? error.message : "Unknown email job error";
        const shouldRetry = job.attempts < job.maxAttempts;
        await prisma_1.prisma.emailJob.update({
            where: { id: job.id },
            data: shouldRetry
                ? {
                    status: client_1.EmailJobStatus.PENDING,
                    lastError: message,
                    scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
                    startedAt: null,
                }
                : {
                    status: client_1.EmailJobStatus.FAILED,
                    lastError: message,
                    completedAt: new Date(),
                },
        });
        if (shouldRetry) {
            console.warn(`⚠️ Email job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}), retry scheduled`);
        }
        else {
            console.error(`❌ Email job ${job.id} permanently failed: ${message}`);
        }
    }
    static async dispatch(job) {
        switch (job.event) {
            case email_events_1.EMAIL_EVENTS.PDR_STATUS_NOTIFY:
                await pdrEmailNotificationService_1.PdrEmailNotificationService.processJob(job.payload);
                break;
            case email_events_1.EMAIL_EVENTS.ATTENDANCE_REMINDER:
                await attendanceReminderService_1.AttendanceReminderService.processJob(job.payload);
                break;
            default:
                throw new Error(`Unknown email event: ${job.event}`);
        }
    }
    static async processJob(job) {
        console.log(`📥 Processing email job ${job.id} [${job.event}]`);
        try {
            await this.dispatch(job);
            await this.markCompleted(job.id);
            console.log(`✅ Email job ${job.id} completed`);
        }
        catch (error) {
            await this.markFailed(job, error);
            throw error;
        }
    }
    static async processNext() {
        const job = await this.claimNextJob();
        if (!job) {
            return false;
        }
        try {
            await this.processJob(job);
        }
        catch {
            // Failure already recorded in markFailed
        }
        return true;
    }
    static async processBatch(concurrency = 5) {
        let processed = 0;
        for (let i = 0; i < concurrency; i++) {
            const hasJob = await this.processNext();
            if (!hasJob) {
                break;
            }
            processed++;
        }
        return processed;
    }
}
exports.EmailQueueService = EmailQueueService;
