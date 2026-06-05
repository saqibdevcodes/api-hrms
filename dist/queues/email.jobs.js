"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queuePdrCreatedEmail = exports.queuePdrStatusEmail = void 0;
const client_1 = require("@prisma/client");
const email_queue_1 = require("./email.queue");
const email_events_1 = require("../constants/email.events");
const pdrEmailNotificationService_1 = require("../services/pdrEmailNotificationService");
const queuePdrStatusEmail = (data) => {
    if (!pdrEmailNotificationService_1.PdrEmailNotificationService.shouldNotify(data.targetStatus)) {
        return Promise.resolve(null);
    }
    return email_queue_1.emailQueue.add(email_events_1.EMAIL_EVENTS.PDR_STATUS_NOTIFY, data);
};
exports.queuePdrStatusEmail = queuePdrStatusEmail;
/** After HR creates a PDR (single or bulk via createPdr). */
const queuePdrCreatedEmail = (pdrId) => {
    return (0, exports.queuePdrStatusEmail)({
        pdrId: Number(pdrId),
        targetStatus: client_1.PdrOverallStatus.CREATED_BY_HR,
    });
};
exports.queuePdrCreatedEmail = queuePdrCreatedEmail;
