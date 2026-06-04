// src/queues/email.queue.ts
import { Queue } from "bullmq";

export const emailQueue = new Queue("email-queue", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});