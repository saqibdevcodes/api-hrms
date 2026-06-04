// src/config/redis.ts
import Redis from "ioredis";

export const redisConnection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,

  //// some changes
});