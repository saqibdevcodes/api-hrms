"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
class EmailService {
    static async sendEmail(to, subject, html, options) {
        try {
            const fromName = process.env.MAIL_FROM_NAME || env_1.config.COMPANY_NAME;
            const fromAddress = process.env.MAIL_FROM_ADDRESS || env_1.config.SMTP_USER;
            const mailOptions = {
                from: `"${fromName}" <${fromAddress}>`,
                to,
                subject,
                html,
            };
            // Add CC if provided
            if (options?.cc && options.cc.length > 0) {
                mailOptions.cc = options.cc.join(", ");
            }
            // Add BCC if provided
            if (options?.bcc && options.bcc.length > 0) {
                mailOptions.bcc = options.bcc.join(", ");
            }
            const info = await this.transporter.sendMail(mailOptions);
            console.log("Message sent: %s", info.messageId);
            if (options?.cc?.length) {
                console.log("CC: %s", options.cc.join(", "));
            }
            if (options?.bcc?.length) {
                console.log("BCC: %s", options.bcc.join(", "));
            }
            return info;
        }
        catch (error) {
            console.error("Error sending email:", error);
            throw error;
        }
    }
    static async sendPasswordResetEmail(to, resetToken) {
        const resetLink = `${env_1.config.COMPANY_DOMAIN}/reset-password?token=${resetToken}`;
        const subject = "Password Reset Request";
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your account at ${env_1.config.COMPANY_NAME}.</p>
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
    static async sendEmailOTP(to, otp, emailType) {
        const subject = `Email Verification - ${env_1.config.COMPANY_NAME}`;
        const emailTypeText = emailType === 'personal' ? 'Personal Email' : 'Official Email';
        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
            .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .info-box { background: #e8f4f8; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
            .warning { color: #d32f2f; font-size: 14px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">📧 Email Verification</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Verify your ${emailTypeText}</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
              
              <p>You requested to update your ${emailTypeText}. To complete this action, please use the One-Time Password (OTP) below:</p>
              
              <div class="otp-box">
                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">Your OTP Code</div>
                <div class="otp-code">${otp}</div>
                <div style="color: #666; font-size: 12px; margin-top: 10px;">Valid for 10 minutes</div>
              </div>
              
              <div class="info-box">
                <strong>📌 Important Notes:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This OTP is valid for <strong>10 minutes</strong></li>
                  <li>Do not share this code with anyone</li>
                  <li>Enter this code in the verification form to proceed</li>
                </ul>
              </div>
              
              <p class="warning">
                ⚠️ <strong>Security Notice:</strong> If you didn't request this email change, please ignore this email and ensure your account is secure.
              </p>
              
              <p style="margin-top: 30px; color: #666;">
                Best regards,<br>
                <strong>${env_1.config.COMPANY_NAME}</strong> Team
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 5px 0;">This is an automated message, please do not reply.</p>
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} ${env_1.config.COMPANY_NAME}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
        return this.sendEmail(to, subject, html);
    }
}
exports.EmailService = EmailService;
EmailService.transporter = nodemailer_1.default.createTransport({
    host: env_1.config.SMTP_HOST || "smtp.gmail.com",
    port: env_1.config.SMTP_PORT || 587,
    secure: env_1.config.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
        user: env_1.config.SMTP_USER,
        pass: env_1.config.SMTP_PASS,
    },
});
