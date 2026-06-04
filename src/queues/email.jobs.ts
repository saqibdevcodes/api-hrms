import { emailQueue } from "./email.queue";
import { EMAIL_EVENTS } from "../constants/email.events";



export const queuePdrCreatedEmail = (pdrId: string) => {
    return emailQueue.add(EMAIL_EVENTS.PDR_CREATED, { pdrId });
  };
  
//   export const queuePdrManagerAssignedEmail = (pdrId: string) => {
//     return emailQueue.add(EMAIL_EVENTS.PDR_MANAGER_ASSIGNED, { pdrId });
//   };
  
//   export const queuePdrSubmittedEmail = (pdrId: string) => {
//     return emailQueue.add(EMAIL_EVENTS.PDR_SUBMITTED_HR, { pdrId });
//   };