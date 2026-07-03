"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopEmailWorker = exports.startEmailWorker = void 0;
const emailQueueService_1 = require("../services/emailQueueService");
const POLL_INTERVAL_MS = Number(process.env.EMAIL_WORKER_POLL_INTERVAL_MS) || 5000;
const CONCURRENCY = Number(process.env.EMAIL_WORKER_CONCURRENCY) || 50;
let interval = null;
let running = false;
const startEmailWorker = () => {
    if (running) {
        return;
    }
    running = true;
    console.log("📬 In-process email worker started (database queue)");
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
    interval = setInterval(poll, POLL_INTERVAL_MS);
    poll();
};
exports.startEmailWorker = startEmailWorker;
const stopEmailWorker = () => {
    running = false;
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    console.log("📬 In-process email worker stopped");
};
exports.stopEmailWorker = stopEmailWorker;
