import { EmailJob, EmailJobStatus, Prisma } from "@prisma/client";
import { EMAIL_EVENTS } from "../constants/email.events";
import { prisma } from "../lib/prisma";
import {
  AttendanceReminderJobData,
  AttendanceReminderService,
} from "./attendanceReminderService";
import {
  PdrEmailJobData,
  PdrEmailNotificationService,
  PdrPortalClosureEmailJobData,
} from "./pdrEmailNotificationService";
import { EventNotificationService } from "./eventNotificationService";
import { EmailService } from "../utils/emailService";

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60_000;

export class EmailQueueService {
  static async enqueue<T extends object>(
    event: string,
    payload: T,
    options?: { scheduledAt?: Date; maxAttempts?: number },
  ): Promise<EmailJob> {
    const job = await prisma.emailJob.create({
      data: {
        event,
        payload: payload as Prisma.InputJsonValue,
        status: EmailJobStatus.PENDING,
        scheduledAt: options?.scheduledAt ?? new Date(),
        maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      },
    });

    console.log(`📬 Email job queued [${job.id}] event=${event}`);
    return job;
  }

  static async claimNextJob(): Promise<EmailJob | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = await prisma.emailJob.findFirst({
        where: {
          status: EmailJobStatus.PENDING,
          scheduledAt: { lte: new Date(Date.now() + 60000) },
        },
        orderBy: { scheduledAt: "asc" },
      });

      if (!candidate) {
        return null;
      }

      const claimed = await prisma.emailJob.updateMany({
        where: {
          id: candidate.id,
          status: EmailJobStatus.PENDING,
        },
        data: {
          status: EmailJobStatus.PROCESSING,
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      if (claimed.count > 0) {
        return prisma.emailJob.findUnique({ where: { id: candidate.id } });
      }
    }

    return null;
  }

  static async markCompleted(jobId: string): Promise<void> {
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: EmailJobStatus.COMPLETED,
        completedAt: new Date(),
        lastError: null,
      },
    });
  }

  static async markFailed(job: EmailJob, error: unknown): Promise<void> {
    const message =
      error instanceof Error ? error.message : "Unknown email job error";
    const shouldRetry = job.attempts < job.maxAttempts;

    await prisma.emailJob.update({
      where: { id: job.id },
      data: shouldRetry
        ? {
            status: EmailJobStatus.PENDING,
            lastError: message,
            scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
            startedAt: null,
          }
        : {
            status: EmailJobStatus.FAILED,
            lastError: message,
            completedAt: new Date(),
          },
    });

    if (shouldRetry) {
      console.warn(
        `⚠️ Email job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}), retry scheduled`,
      );
    } else {
      console.error(`❌ Email job ${job.id} permanently failed: ${message}`);
    }
  }

  static async dispatch(job: EmailJob): Promise<void> {
    switch (job.event) {
      case EMAIL_EVENTS.PDR_STATUS_NOTIFY:
        await PdrEmailNotificationService.processJob(
          job.payload as unknown as PdrEmailJobData,
        );
        break;

      case EMAIL_EVENTS.PDR_EMPLOYEE_PORTAL_CLOSE:
        await PdrEmailNotificationService.processPortalClosureJob(
          job.payload as unknown as PdrPortalClosureEmailJobData,
        );
        break;

      case EMAIL_EVENTS.ATTENDANCE_REMINDER:
        await AttendanceReminderService.processJob(
          job.payload as unknown as AttendanceReminderJobData,
        );
        break;

      case EMAIL_EVENTS.PASSWORD_RESET: {
        const payload = job.payload as unknown as {
          to?: string;
          resetToken?: string;
        };

        if (!payload?.to || !payload?.resetToken) {
          throw new Error("Invalid password reset email payload");
        }

        await EmailService.sendPasswordResetEmail(payload.to, payload.resetToken);
        break;
      }

      case EMAIL_EVENTS.EVENT_CREATED:
        await EventNotificationService.processEventCreatedJob(job.payload);
        break;

      case EMAIL_EVENTS.EVENT_REQUIREMENT_NOTIFY:
        await EventNotificationService.processRequirementJob(job.payload);
        break;

      case EMAIL_EVENTS.EVENT_CANCELLED:
        await EventNotificationService.processEventCancelledJob(job.payload);
        break;

      case "UNMARKED_ATTENDANCE_REMINDER": {
        const payload = job.payload as any;
        if (payload?.to && payload?.subject && payload?.html) {
          await EmailService.sendEmail(payload.to, payload.subject, payload.html);
        }
        break;
      }

      default:
        throw new Error(`Unknown email event: ${job.event}`);
    }
  }

  static async processJob(job: EmailJob): Promise<void> {
    console.log(`📥 Processing email job ${job.id} [${job.event}]`);

    try {
      await this.dispatch(job);
      await this.markCompleted(job.id);
      console.log(`✅ Email job ${job.id} completed`);
    } catch (error) {
      await this.markFailed(job, error);
      throw error;
    }
  }

  static async processNext(): Promise<boolean> {
    const job = await this.claimNextJob();
    if (!job) {
      return false;
    }

    try {
      await this.processJob(job);
    } catch {
      // Failure already recorded in markFailed
    }

    return true;
  }

  static async processBatch(concurrency = 50): Promise<number> {
    let processed = 0;

    while (processed < concurrency) {
      const hasJob = await this.processNext();
      if (!hasJob) {
        break;
      }
      processed++;
    }

    if (processed > 0) {
      console.log(`📤 Batch completed: Successfully processed ${processed} email job(s)`);
    }

    return processed;
  }
}
