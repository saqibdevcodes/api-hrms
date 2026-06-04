import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const emailQueue = new Queue("email-queue", {
  connection: {
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT),
  },
});