// src/workers/email.worker.ts
import { Worker } from "bullmq";
import { EMAIL_EVENTS } from "../constants/email.events";
import { EmailService } from "../utils/emailService";
import { prisma } from "../lib/prisma";


new Worker(
    "email-queue",
    async (job) => {
      switch (job.name) {

        case EMAIL_EVENTS.PDR_CREATED: {
            const pdr = await prisma.pdr.findUnique({
              where: { id: job.data.pdrId },
              include: { user: true },
            });
    
            if (!pdr) throw new Error("PDR not found");
    
            await EmailService.sendEmail(
              pdr.user.officialEmail || "",
              "PDR Created",
              `<p>Hello ${pdr.user.firstName}, your PDR is created.</p>`
            );
    
            break;
          }


          default:
            throw new Error(`Unknown event: ${job.name}`);
        }
      },
      {
        connection: {
            host: process.env.REDIS_HOST!,
            port: Number(process.env.REDIS_PORT),
          },
        concurrency: 10,
      }
    );


