"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
// src/queues/email.queue.ts
const bullmq_1 = require("bullmq");
exports.emailQueue = new bullmq_1.Queue("email-queue", {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
});
