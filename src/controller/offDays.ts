import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { EmailService } from "../utils/emailService";

type OffDay = {
  id: string;
  date: Date;
  reason: string;
};

export class OffDayController {
  static async getAllOffDays(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;

      const pageNum = Math.max(Number(page), 1);
      const limitNum = Math.max(Number(limit), 1);
      const skip = (pageNum - 1) * limitNum;

      const searchTerm = (search as string).trim();
      const whereConditions: any[] = [];

      if (searchTerm) {
        // Reason search
        whereConditions.push({
          reason: {
            contains: searchTerm,
          },
        });

        // Exact date search (YYYY-MM-DD only)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (dateRegex.test(searchTerm)) {
          const startDate = new Date(`${searchTerm}T00:00:00.000Z`);
          const endDate = new Date(`${searchTerm}T23:59:59.999Z`);

          whereConditions.push({
            date: {
              gte: startDate,
              lte: endDate,
            },
          });
        }
      }

      const where = whereConditions.length ? { OR: whereConditions } : {};

      const [offDays, total] = await Promise.all([
        prisma.offDay.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { date: "desc" },
        }),
        prisma.offDay.count({ where }),
      ]);

      res.json({
        success: true,
        data: offDays,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching off days:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async getOffDayById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const offDay = await prisma.offDay.findUnique({
        where: { id },
      });

      if (!offDay) {
        return res.status(404).json({
          success: false,
          message: "Off day not found",
        });
      }

      res.json({
        success: true,
        data: offDay,
      });
    } catch (error) {
      console.error("Error fetching off day:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async createOffDay(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { date, reason } = req.body;

      // Check if off day already exists for the given date
      const existingOffDay = await prisma.offDay.findFirst({
        where: {
          date: new Date(date),
        },
      });

      if (existingOffDay) {
        return res.status(400).json({
          success: false,
          message: "Off day already exists for this date",
        });
      }

      const offDay = await prisma.offDay.create({
        data: {
          date: new Date(date),
          reason,
        },
      });

      res.status(201).json({
        success: true,
        message: "Off day created successfully",
        data: offDay,
      });
    } catch (error) {
      console.error("Error creating off day:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async updateOffDay(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { date, reason } = req.body;

      // Check if off day exists
      const existingOffDay = await prisma.offDay.findUnique({
        where: { id },
      });

      if (!existingOffDay) {
        return res.status(404).json({
          success: false,
          message: "Off day not found",
        });
      }

      // Check if another off day already exists for the new date (if date is being changed)
      if (date && date !== existingOffDay.date.toISOString().split("T")[0]) {
        const duplicateOffDay = await prisma.offDay.findFirst({
          where: {
            date: new Date(date),
            id: { not: id },
          },
        });

        if (duplicateOffDay) {
          return res.status(400).json({
            success: false,
            message: "Off day already exists for this date",
          });
        }
      }

      const updateData: any = {};
      if (date) updateData.date = new Date(date);
      if (reason) updateData.reason = reason;

      const offDay = await prisma.offDay.update({
        where: { id },
        data: updateData,
      });

      res.json({
        success: true,
        message: "Off day updated successfully",
        data: offDay,
      });
    } catch (error) {
      console.error("Error updating off day:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async deleteOffDay(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if off day exists
      const existingOffDay = await prisma.offDay.findUnique({
        where: { id },
      });

      if (!existingOffDay) {
        return res.status(404).json({
          success: false,
          message: "Off day not found",
        });
      }

      await prisma.offDay.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Off day deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting off day:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async getOffDaysByDateRange(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        });
      }

      const offDays = await prisma.offDay.findMany({
        where: {
          date: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        },
        orderBy: { date: "asc" },
      });

      res.json({
        success: true,
        data: offDays,
      });
    } catch (error) {
      console.error("Error fetching off days by date range:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async sendChartEmail(req: Request, res: Response) {
    try {
      const { subject, message, offDays, cc, bcc } = req.body;

      if (!subject || !message || !offDays) {
        return res.status(400).json({
          success: false,
          message: "Subject, message and offDays are required",
        });
      }

      // Validate CC/BCC emails if provided
      const ccEmails = Array.isArray(cc) ? cc.filter((e) => e) : [];
      const bccEmails = Array.isArray(bcc) ? bcc.filter((e) => e) : [];

      console.log("CC Emails:", ccEmails);
      console.log("BCC Emails:", bccEmails);

      // Get all employees to send email
      const employees = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (employees.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No active employees found",
        });
      }

      // Fetch all off days from database
      const offDaysData = await prisma.offDay.findMany({
        orderBy: { date: "asc" },
      });

      console.log("===== EMAIL GENERATION DEBUG =====");
      console.log(`Total off days in database: ${offDaysData.length}`);
      console.log(
        "Off days dates:",
        offDaysData.map((od: OffDay) => ({
          date: od.date,
          dateString: od.date.toISOString().split("T")[0],
          reason: od.reason,
        })),
      );

      // Generate calendar data grouped by month
      const calendarData = generateCalendarData(offDaysData);
      console.log("===== END DEBUG =====");

      // Generate HTML email with calendar table
      const html = generateOffDaysCalendarHTML(subject, message, calendarData);

      // Send email to all employees
      let sent = 0;
      let failed = 0;

      for (const employee of employees) {
        try {
          await EmailService.sendEmail(employee.email, subject, html);
          sent++;
        } catch (error) {
          console.error(`Failed to send email to ${employee.email}:`, error);
          failed++;
        }
      }

      return res.status(200).json({
        success: true,
        message: "Chart email sent successfully",
        data: {
          sent,
          failed,
          total: employees.length,
        },
      });
    } catch (error) {
      console.error("Error sending chart email:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
}

// Helper function to generate calendar data grouped by month
function generateCalendarData(offDays: OffDay[]) {
  const currentYear = new Date().getFullYear();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const calendarData: {
    month: string;
    offSaturdays: string[];
    onSaturdays: string[];
  }[] = [];

  // Get all Saturdays in the year
  const allSaturdays: Date[] = [];
  const startDate = new Date(currentYear, 0, 1);
  const endDate = new Date(currentYear, 11, 31);

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (currentDate.getDay() === 6) {
      // Saturday
      allSaturdays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Convert offDays to Set for quick lookup (normalize dates to local timezone)
  const offDaysSet = new Set(
    offDays.map((offDay: OffDay) => {
      const date = new Date(offDay.date);
      // Format as YYYY-MM-DD in local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }),
  );

  console.log("Off Days Set:", Array.from(offDaysSet));
  console.log("Total off days found:", offDays.length);

  // Group Saturdays by month
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthSaturdays = allSaturdays.filter(
      (saturday: Date) => saturday.getMonth() === monthIndex,
    );

    const offSaturdays: string[] = [];
    const onSaturdays: string[] = [];

    monthSaturdays.forEach((saturday: Date) => {
      // Format date as YYYY-MM-DD in local timezone
      const year = saturday.getFullYear();
      const month = String(saturday.getMonth() + 1).padStart(2, "0");
      const day = String(saturday.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const formatted = formatDateForEmail(saturday);

      if (offDaysSet.has(dateStr)) {
        offSaturdays.push(formatted);
        console.log(`✅ Found OFF Saturday: ${dateStr} -> ${formatted}`);
      } else {
        onSaturdays.push(formatted);
      }
    });

    if (monthSaturdays.length > 0) {
      calendarData.push({
        month: `${months[monthIndex]}-${currentYear.toString().slice(2)}`,
        offSaturdays,
        onSaturdays,
      });
    }
  }

  console.log(
    "Calendar data generated:",
    JSON.stringify(calendarData, null, 2),
  );
  return calendarData;
}

// Helper function to format date
function formatDateForEmail(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Helper function to generate HTML calendar email
function generateOffDaysCalendarHTML(
  subject: string,
  message: string,
  calendarData: {
    month: string;
    offSaturdays: string[];
    onSaturdays: string[];
  }[],
): string {
  const currentYear = new Date().getFullYear();

  // Generate table rows
  const tableRows = calendarData
    .map(
      (monthData: {
        month: string;
        offSaturdays: string[];
        onSaturdays: string[];
      }) => {
        const maxRows = Math.max(
          monthData.offSaturdays.length,
          monthData.onSaturdays.length,
        );

        let rows = "";
        for (let i = 0; i < maxRows; i++) {
          const isFirstRow = i === 0;
          const offSaturday = monthData.offSaturdays[i] || "";
          const onSaturday = monthData.onSaturdays[i] || "";

          rows += `
          <tr>
            ${
              isFirstRow
                ? `<td rowspan="${maxRows}" style="background-color: #d1fae5; padding: 12px; text-align: center; border: 1px solid #a7f3d0; font-weight: 600; vertical-align: middle;">${monthData.month}</td>`
                : ""
            }
            <td style="background-color: #ffffff; padding: 10px; text-align: center; border: 1px solid #e5e7eb;">${offSaturday}</td>
            <td style="background-color: #ffffff; padding: 10px; text-align: center; border: 1px solid #e5e7eb;">${onSaturday}</td>
          </tr>
        `;
        }
        return rows;
      },
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
      <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0 0 10px 0; font-size: 28px;">${subject}</h1>
          <p style="color: #6b7280; margin: 0; font-size: 16px;">${message}</p>
        </div>

        <!-- Calendar Title -->
        <div style="text-align: center; margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
          <h2 style="color: #ffffff; margin: 0; font-size: 24px;">${currentYear} Calendar (Saturday On/Off)</h2>
        </div>

        <!-- Calendar Table -->
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background-color: #10b981;">
                <th style="padding: 15px; text-align: center; border: 1px solid #059669; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase;">Months</th>
                <th style="padding: 15px; text-align: center; border: 1px solid #059669; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase;">Off Saturdays</th>
                <th style="padding: 15px; text-align: center; border: 1px solid #059669; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase;">On Saturdays</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center;">
          <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px;">
            <strong>Note:</strong> Please mark these dates in your calendar accordingly.
          </p>
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>

      <!-- Company Footer -->
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 5px 0;">© ${currentYear} HRMS Portal. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}
