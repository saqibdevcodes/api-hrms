import nodemailer from "nodemailer";
import { config } from "../config/env";

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: config.SMTP_HOST || "smtp.gmail.com",
    port: config.SMTP_PORT || 587,
    secure: config.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  static async sendEmail(to: string, subject: string, html: string) {
    try {
      const fromName = process.env.MAIL_FROM_NAME || config.COMPANY_NAME;
      const fromAddress = process.env.MAIL_FROM_ADDRESS || config.SMTP_USER;

      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to,
        subject,
        html,
      });

      console.log("Message sent: %s", info.messageId);
      return info;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  static async sendPasswordResetEmail(to: string, resetToken: string) {
    const resetLink = `${config.COMPANY_DOMAIN}/reset-password?token=${resetToken}`;
    const subject = "Password Reset Request";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your account at ${config.COMPANY_NAME}.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    return this.sendEmail(to, subject, html);
  }
}
