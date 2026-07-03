"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const emailQueueService_1 = require("../services/emailQueueService");
const POLL_INTERVAL_MS = Number(process.env.EMAIL_WORKER_POLL_INTERVAL_MS) || 5000;
const CONCURRENCY = Number(process.env.EMAIL_WORKER_CONCURRENCY) || 5;
let running = true;
console.log("📬 Database email worker started");
console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);
console.log(`   Concurrency: ${CONCURRENCY}`);
const poll = async () => {
    if (!running)
        return;
    try {
        const processed = await emailQueueService_1.EmailQueueService.processBatch(CONCURRENCY);
        if (processed > 0) {
            console.log(`📤 Processed ${processed} email job(s)`);
        }
    }
    catch (error) {
        console.error("❌ Email worker poll error:", error);
    }
};
const interval = setInterval(poll, POLL_INTERVAL_MS);
poll();
const shutdown = () => {
    running = false;
    clearInterval(interval);
    console.log("📬 Database email worker stopped");
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
