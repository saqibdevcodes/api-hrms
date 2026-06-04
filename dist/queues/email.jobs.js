"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queuePdrCreatedEmail = void 0;
const email_queue_1 = require("./email.queue");
const email_events_1 = require("../constants/email.events");
const queuePdrCreatedEmail = (pdrId) => {
    return email_queue_1.emailQueue.add(email_events_1.EMAIL_EVENTS.PDR_CREATED, { pdrId });
};
exports.queuePdrCreatedEmail = queuePdrCreatedEmail;
//   export const queuePdrManagerAssignedEmail = (pdrId: string) => {
//     return emailQueue.add(EMAIL_EVENTS.PDR_MANAGER_ASSIGNED, { pdrId });
//   };
//   export const queuePdrSubmittedEmail = (pdrId: string) => {
//     return emailQueue.add(EMAIL_EVENTS.PDR_SUBMITTED_HR, { pdrId });
//   };
