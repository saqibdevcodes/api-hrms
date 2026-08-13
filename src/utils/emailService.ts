import nodemailer from "nodemailer";
import { config } from "../config/env";

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || config.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT || config.SMTP_PORT || 587),
    secure: Number(process.env.MAIL_PORT || config.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.MAIL_USERNAME || config.SMTP_USER,
      pass: process.env.MAIL_PASSWORD || config.SMTP_PASS,
    },
  });

  static async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: { cc?: string[]; bcc?: string[]; attachments?: any[]; icalEvent?: any },
  ) {
    try {
      const fromName = process.env.MAIL_FROM_NAME || config.COMPANY_NAME;
      const fromAddress =
        process.env.MAIL_FROM_ADDRESS ||
        process.env.MAIL_USERNAME ||
        config.SMTP_USER;

      const mailOptions: any = {
        from: `"${fromName}" <${fromAddress}>`,
        to,
        subject,
        html,
      };

      if (options?.cc?.length) {
        mailOptions.cc = options.cc.join(", ");
      }

      if (options?.bcc?.length) {
        mailOptions.bcc = options.bcc.join(", ");
      }

      if (options?.attachments?.length) {
        mailOptions.attachments = options.attachments;
      }

      if (options?.icalEvent) {
        mailOptions.icalEvent = options.icalEvent;
      }

      const info = await this.transporter.sendMail(mailOptions);

      console.log(
        "✅ Email sent → %s | %s | messageId: %s",
        to,
        subject,
        info.messageId,
      );

      return info;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  static async sendPasswordResetEmail(to: string, resetToken: string) {
    const resetLink = `${config.COMPANY_DOMAIN}reset-password?token=${resetToken}`;
    const subject = "Reset Your Password";
  
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Password Reset</title>
        </head>
  
        <body
          style="
            margin: 0;
            padding: 0;
            background-color: #f4f6f8;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="background-color: #f4f6f8; padding: 40px 16px;"
          >
            <tr>
              <td align="center">
  
                <!-- Main Container -->
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    max-width: 600px;
                    background-color: #ffffff;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
                  "
                >
  
                  <!-- Header -->
                  <tr>
                    <td
                      align="center"
                      style="
                        padding: 36px 30px 28px;
                        background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
                      "
                    >
                      <div
                        style="
                          width: 56px;
                          height: 56px;
                          line-height: 56px;
                          text-align: center;
                          background-color: rgba(255, 255, 255, 0.16);
                          border-radius: 14px;
                          font-size: 26px;
                          margin-bottom: 16px;
                        "
                      >
                        🔐
                      </div>
  
                      <h1
                        style="
                          margin: 0;
                          color: #ffffff;
                          font-size: 26px;
                          font-weight: 700;
                          line-height: 1.3;
                        "
                      >
                        Reset Your Password
                      </h1>
  
                      <p
                        style="
                          margin: 10px 0 0;
                          color: #e0e7ff;
                          font-size: 14px;
                          line-height: 1.6;
                        "
                      >
                        ${config.COMPANY_NAME}
                      </p>
                    </td>
                  </tr>
  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 36px 40px 20px;">
  
                      <p
                        style="
                          margin: 0 0 18px;
                          font-size: 16px;
                          line-height: 1.7;
                          color: #374151;
                        "
                      >
                        Hello,
                      </p>
  
                      <p
                        style="
                          margin: 0 0 18px;
                          font-size: 15px;
                          line-height: 1.7;
                          color: #4b5563;
                        "
                      >
                        We received a request to reset the password for your
                        <strong style="color: #111827;">
                          ${config.COMPANY_NAME}
                        </strong>
                        account.
                      </p>
  
                      <p
                        style="
                          margin: 0 0 28px;
                          font-size: 15px;
                          line-height: 1.7;
                          color: #4b5563;
                        "
                      >
                        Click the button below to choose a new password.
                      </p>
  
                      <!-- Button -->
                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        align="center"
                        style="margin: 0 auto 30px;"
                      >
                        <tr>
                          <td
                            align="center"
                            bgcolor="#4f46e5"
                            style="
                              border-radius: 10px;
                              box-shadow: 0 6px 15px rgba(79, 70, 229, 0.22);
                            "
                          >
                            <a
                              href="${resetLink}"
                              target="_blank"
                              style="
                                display: inline-block;
                                padding: 15px 32px;
                                font-size: 15px;
                                font-weight: 700;
                                color: #ffffff;
                                text-decoration: none;
                                border-radius: 10px;
                                letter-spacing: 0.2px;
                              "
                            >
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
  
                      <!-- Expiry Notice -->
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          background-color: #eef2ff;
                          border-radius: 10px;
                          margin-bottom: 28px;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding: 16px 18px;
                              font-size: 14px;
                              line-height: 1.6;
                              color: #4338ca;
                            "
                          >
                            ⏱️ For your security, this password reset link will
                            expire in <strong>1 hour</strong>.
                          </td>
                        </tr>
                      </table>
  
                      <p
                        style="
                          margin: 0 0 10px;
                          font-size: 13px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        If the button above doesn't work, copy and paste this URL
                        into your browser:
                      </p>
  
                      <!-- Fallback Link -->
                      <div
                        style="
                          padding: 13px 15px;
                          background-color: #f8fafc;
                          border: 1px solid #e5e7eb;
                          border-radius: 8px;
                          margin-bottom: 28px;
                          word-break: break-all;
                        "
                      >
                        <a
                          href="${resetLink}"
                          target="_blank"
                          style="
                            color: #4f46e5;
                            font-size: 12px;
                            line-height: 1.6;
                            text-decoration: none;
                          "
                        >
                          ${resetLink}
                        </a>
                      </div>
  
                      <!-- Security Message -->
                      <div
                        style="
                          border-top: 1px solid #e5e7eb;
                          padding-top: 22px;
                        "
                      >
                        <p
                          style="
                            margin: 0;
                            font-size: 13px;
                            line-height: 1.7;
                            color: #6b7280;
                          "
                        >
                          If you didn't request a password reset, you can safely
                          ignore this email. Your password will remain unchanged.
                        </p>
                      </div>
  
                    </td>
                  </tr>
  
                  <!-- Footer -->
                  <tr>
                    <td
                      align="center"
                      style="
                        padding: 24px 30px 30px;
                        background-color: #f8fafc;
                        border-top: 1px solid #eef2f7;
                      "
                    >
                      <p
                        style="
                          margin: 0 0 6px;
                          font-size: 13px;
                          font-weight: 600;
                          color: #374151;
                        "
                      >
                        ${config.COMPANY_NAME}
                      </p>
  
                      <p
                        style="
                          margin: 0;
                          font-size: 11px;
                          line-height: 1.6;
                          color: #9ca3af;
                        "
                      >
                        This is an automated security email. Please do not reply.
                      </p>
                    </td>
                  </tr>
  
                </table>
  
                <!-- Outside Footer -->
                <p
                  style="
                    max-width: 600px;
                    margin: 18px auto 0;
                    font-size: 11px;
                    line-height: 1.6;
                    color: #9ca3af;
                    text-align: center;
                  "
                >
                  © ${new Date().getFullYear()} ${config.COMPANY_NAME}. All rights reserved.
                </p>
  
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  
    return this.sendEmail(to, subject, html);
  }

  static async sendEmailOTP(to: string, otp: string, emailType: string) {
    const subject = `Email Verification - ${config.COMPANY_NAME}`;
    const emailTypeText =
      emailType === "personal" ? "Personal Email" : "Official Email";

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
                <strong>${config.COMPANY_NAME}</strong> Team
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 5px 0;">This is an automated message, please do not reply.</p>
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} ${config.COMPANY_NAME}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }
}
