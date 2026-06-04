import "dotenv/config";
import { Worker } from "bullmq";
import { EMAIL_EVENTS } from "../constants/email.events";
import { redisConnection } from "../config/redis";
import {
  PdrEmailJobData,
  PdrEmailNotificationService,
} from "../services/pdrEmailNotificationService";

new Worker(
  "email-queue",
  async (job) => {
    switch (job.name) {
      case EMAIL_EVENTS.PDR_STATUS_NOTIFY:
        await PdrEmailNotificationService.processJob(
          job.data as PdrEmailJobData,
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
