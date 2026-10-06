import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  zktecoService,
  ZKTecoDevice,
  EmployeeData,
} from "../services/zktecoService";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../types/auth";
import { EmailService } from "../utils/emailService";
import { AttendanceReminderService } from "../services/attendanceReminderService";
import { queueAttendanceReminderEmail } from "../queues/email.jobs";
import { EmailQueueService } from "../services/emailQueueService";
import {
  shiftTimeOnAttendanceDate,
  secondsAfter,
  formatAttendanceDuration,
} from "../utils/attendanceTiming";
import ExcelJS from 'exceljs';
import { AttendancePolicyService } from "../services/attendancePolicyService";

const zktecoDebug = (...args: unknown[]): void => {
  if (process.env.ZKTECO_VERBOSE_LOGS === "true") {
    console.log(...args);
  }
};

const getDesignationName = (target: any) => {
  const emp = target?.employee || target;
  if (!emp) return "N/A";

  const rawDesig = emp.designation || emp.designationEntity || emp.userRank;
  if (!rawDesig) return emp.userRank || "N/A";

  if (typeof rawDesig === "object" && rawDesig !== null) {
    return rawDesig.title || rawDesig.name || rawDesig.description || emp.userRank || "N/A";
  }

  if (typeof rawDesig === "string") {
    const trimmed = rawDesig.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.title || parsed.name || parsed.description || emp.userRank || "N/A";
      } catch (e) {
        // Not valid JSON string
      }
    }
    return trimmed || emp.userRank || "N/A";
  }

  return emp.userRank || "N/A";
};

export class ZKTecoController {
  static async getDevices(req: Request, res: Response) {
    try {
      const devices = zktecoService.getDevices();

      // Get device status for each device
      const devicesWithStatus = await Promise.all(
        devices.map(async (device) => {
          try {
            const status = await zktecoService.getDeviceStatus(device.id);
            return {
              ...device,
              status: status.online ? "online" : "offline",
              lastSeen: status.lastSeen,
              info: status.info,
            };
          } catch (error) {
            return {
              ...device,
              status: "offline",
              lastSeen: null,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      res.json({
        success: true,
        message: "Devices retrieved successfully",
        data: {
          devices: devicesWithStatus,
          total: devicesWithStatus.length,
        },
      });
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch devices",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getDeviceStatus(req: Request, res: Response) {
    try {
      const { deviceId } = req.params;

      const status = await zktecoService.getDeviceStatus(deviceId);

      res.json({
        success: true,
        message: "Device status retrieved successfully",
        data: status,
      });
    } catch (error) {
      console.error("Error fetching device status:", error);
      res.status(404).json({
        success: false,
        message: "Device not found or unreachable",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async syncAttendanceData(req: Request, res: Response) {
    try {
      const { startDate, endDate, deviceId } = req.body;

      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate);
      }
      if (endDate) {
        end = new Date(endDate);
      }

      if (deviceId) {
        // Sync specific device
        const attendanceData = await zktecoService.fetchAttendanceFromDevice(
          deviceId,
          start,
          end,
        );

        res.json({
          success: true,
          message: `Attendance data synced from device ${deviceId}`,
          data: {
            deviceId,
            recordsCount: attendanceData.length,
            syncedAt: new Date(),
          },
        });
      } else {
        // Sync all devices
        await zktecoService.syncAttendanceData(start, end);

        res.json({
          success: true,
          message: "Attendance data synced from all devices",
          data: {
            syncedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error("Error syncing attendance data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync attendance data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getAttendanceData(req: Request, res: Response) {
    try {
      const {
        deviceId,
        startDate,
        endDate,
        employeeId,
        companyId,
        departmentId,
        search,
        arrivalStatus,
        scope,
        page = 1,
        limit = 50,
      } = req.query;

      const pageNumber = Number(page);
      const limitNumber = Number(limit);
      const skip = (pageNumber - 1) * limitNumber;
      const take = limitNumber;

      // 🔐 SECURITY: Get authenticated user from request
      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;

      // 🏗️ BUILD FILTER: Create database query conditions
      let where: any = {};

      // 👥 ROLE-BASED ACCESS CONTROL: Filter data based on user role
      // Define roles that can view ALL records
      const canViewAllRecords = ["ADMIN", "HR", "SUPERADMIN"].includes(
        currentUser.role,
      );

      let targetUserId: string | null = null;
      if (employeeId) {
        const empStr = String(employeeId).trim();
        if (empStr.toLowerCase() === "me" || empStr.toLowerCase() === "self") {
          targetUserId = currentUser.id;
        } else {
          const userMatch = await prisma.user.findFirst({
            where: {
              OR: [
                { id: empStr },
                { employeeId: empStr },
                { email: empStr },
              ],
            },
            select: { id: true },
          });
          targetUserId = userMatch ? userMatch.id : empStr;
        }
      }

      const isLineManager =
        currentUser.role === "MANAGER" ||
        currentUser.userRank === "LINE_MANAGER" ||
        currentUser.userRank === "MANAGER";

      // Helper to fetch direct subordinates for a manager by exact email / ID
      const mgrEmail = (currentUser.email || "").toLowerCase().trim();
      const mgrId = currentUser.id;

      // 1. Personal view explicitly requested OR target is self
      if (scope === "personal" || targetUserId === currentUser.id) {
        where.employeeId = currentUser.id;
        zktecoDebug(`👤 User ${currentUser.email} viewing their own personal attendance`);
      }
      // 2. Team view: Line Managers or Managers viewing their direct subordinates
      else if (scope === "team") {
        const subordinates = await prisma.user.findMany({
          where: {
            isActive: true,
            id: { not: mgrId },
            OR: [
              { manager: { equals: mgrEmail } },
              { manager: { contains: mgrEmail } },
              { manager: { equals: mgrId } },
            ],
          },
          select: { id: true },
        });

        const subordinateIds = subordinates.map((s) => s.id);

        if (subordinateIds.length === 0) {
          where.employeeId = "__NO_SUBORDINATES__";
        } else if (targetUserId && subordinateIds.includes(targetUserId)) {
          where.employeeId = targetUserId;
        } else {
          where.employeeId = { in: subordinateIds };
        }

        if (search) {
          const searchValue = String(search).trim();
          where.employee = {
            OR: [
              { firstName: { contains: searchValue } },
              { lastName: { contains: searchValue } },
              { email: { contains: searchValue } },
              { employeeId: { contains: searchValue } },
            ],
          };
        }

        zktecoDebug(
          `👔 Manager ${currentUser.email} viewing direct team (${subordinateIds.length} members) attendance`,
        );
      }
      // 3. Whole-company operations view (Only for Admin / HR / SuperAdmin in company scope)
      else if (canViewAllRecords && (scope === "company" || !scope)) {
        where.employee = {
          employeeId: {
            not: null,
          },
          isActive: true,
        };

        if (targetUserId) {
          where.employeeId = targetUserId;
        }

        if (companyId) {
          where.employee.companyMemberships = {
            some: { companyId: companyId as string },
          };
        }

        if (departmentId) {
          where.employee.departmentId = departmentId as string;
        }

        if (search) {
          const searchValue = String(search).trim();

          where.employee.OR = [
            { firstName: { contains: searchValue } },
            { lastName: { contains: searchValue } },
            { email: { contains: searchValue } },
            { employeeId: { contains: searchValue } },
            { position: { contains: searchValue } },
            { department: { contains: searchValue } },
          ];
        }

        zktecoDebug(
          `👥 Privileged User ${currentUser.email} (${currentUser.role}) viewing company attendance records`,
        );
      }
      // 4. Default for Line Managers and Employees: ALWAYS THEIR OWN PERSONAL ATTENDANCE
      else {
        where.employeeId = currentUser.id;

        if (companyId) {
          where.employee = {
            companyMemberships: {
              some: { companyId: companyId as string },
            },
          };
        }

        zktecoDebug(
          `👤 User ${currentUser.email} (${currentUser.role}) viewing their own attendance`,
        );
      }

      // 📅 DATE FILTERING: If no dates are sent, show only today's attendance
      // 📅 DATE FILTERING
      const getPakistanToday = () => {
        return new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Karachi",
        });
      };

      const getDateRange = (date: string) => {
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);

        return { start, end };
      };

      let selectedDate: string | null = null;

      // If user sends date filters, use them normally
      if (startDate || endDate) {
        const filterStartDate = (startDate as string) || (endDate as string);
        const filterEndDate = (endDate as string) || filterStartDate;

        const start = new Date(`${filterStartDate}T00:00:00.000Z`);
        const end = new Date(`${filterEndDate}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);

        where.date = {
          gte: start,
          lt: end,
        };

        selectedDate = filterStartDate;
      } else {
        // If no date is sent, first check today's attendance
        const today = getPakistanToday();
        const todayRange = getDateRange(today);

        const todayCount = await prisma.attendance.count({
          where: {
            ...where,
            date: {
              gte: todayRange.start,
              lt: todayRange.end,
            },
          },
        });

        if (todayCount > 0) {
          // Today attendance exists
          where.date = {
            gte: todayRange.start,
            lt: todayRange.end,
          };

          selectedDate = today;
        } else {
          // No today attendance, find latest previous attendance date
          const latestAttendance = await prisma.attendance.findFirst({
            where: {
              ...where,
              date: {
                lt: todayRange.start,
              },
            },
            select: {
              date: true,
            },
            orderBy: {
              date: "desc",
            },
          });

          if (latestAttendance) {
            const latestDate = latestAttendance.date
              .toISOString()
              .split("T")[0];
            const latestRange = getDateRange(latestDate);

            where.date = {
              gte: latestRange.start,
              lt: latestRange.end,
            };

            selectedDate = latestDate;
          } else {
            // No attendance data found at all
            where.date = {
              gte: todayRange.start,
              lt: todayRange.end,
            };

            selectedDate = today;
          }
        }
      }

      zktecoDebug("📊 Fetching attendance records (all finalized data)");
      zktecoDebug(`   User: ${currentUser.email} (${currentUser.role})`);
      zktecoDebug(`   Department Filter: ${departmentId || "none"}`);
      zktecoDebug(`   Company Filter: ${companyId || "none"}`);
      zktecoDebug(`   Employee Filter: ${employeeId || "none"}`);
      zktecoDebug(`   Where Clause:`, JSON.stringify(where, null, 2));

      const attendanceRecords = await prisma.attendance.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          date: true,
          checkIn: true,
          checkOut: true,
          status: true,
          notes: true,
          reason: true,
          createdAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              companyMemberships: {
                select: {
                  companyId: true,
                  company: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              shift: {
                select: {
                  id: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                  breakTime: true,
                  halfDayStart: true,
                  fullDayStart: true,
                  earlyOut: true,
                },
              },
              departmentEntity: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          zktecoRecords: {
            select: {
              id: true,
              timestamp: true,
              checkType: true,
              overallStatus: true,
            },
            orderBy: {
              timestamp: "asc",
            },
          },
        },
        orderBy: {
          date: "desc",
        },
      });

      // Load active attendance policy settings (grace period, missing punch actions, allowances)
      const policy = await AttendancePolicyService.getActivePolicy();

      // Helper function to calculate attendance status based on shift timing
      const calculateAttendanceStatus = (
        record: any,
        shift: any,
      ): {
        status: string;
        lateMinutes?: number;
        lateSeconds?: number;
        earlyOutMinutes?: number;
        workingHours?: string;
        checkInStatus?: string;
        checkOutStatus?: string;
      } => {
        zktecoDebug("record", record);

        // Handle case where there's no check-in
        if (!record.checkIn) {
          // If there's a check-out but no check-in, still calculate check-out status
          if (record.checkOut && shift) {
            const checkOutTime = new Date(record.checkOut);
            const attendanceDate = new Date(record.date);
            const shiftEnd = new Date(shift.endTime);

            const todayShiftEnd = shiftTimeOnAttendanceDate(attendanceDate, shiftEnd);

            const earlyOutMinutes =
              checkOutTime < todayShiftEnd
                ? Math.floor(
                  (todayShiftEnd.getTime() - checkOutTime.getTime()) /
                  (1000 * 60),
                )
                : 0;

            // Determine check-out status
            let checkOutStatus = "ON_TIME_LEAVE";
            if (earlyOutMinutes > 15) {
              checkOutStatus = "EARLY_OUT";
            }

            // Per Policy: Missing only one punch is treated as Late IN or Early OUT if configured
            const isLateOrEarly = (policy?.missingOnePunchAction || "LATE_OR_EARLY") === "LATE_OR_EARLY";

            return {
              status: isLateOrEarly ? "LATE" : (policy?.missingOnePunchAction || "ABSENT"),
              checkInStatus: isLateOrEarly ? "LATE" : "MISSING_PUNCH",
              checkOutStatus: checkOutStatus,
              earlyOutMinutes: earlyOutMinutes,
            };
          }
          return { status: policy?.missingBothPunchesAction || "ABSENT" };
        }
        zktecoDebug("shift", shift);

        if (!shift) {
          return { status: "PRESENT" }; // Default status if no shift assigned
        }

        const checkInTime = new Date(record.checkIn);
        const checkOutTime = record.checkOut ? new Date(record.checkOut) : null;

        // Create shift times for the same date as attendance
        const attendanceDate = new Date(record.date);
        const shiftStart = new Date(shift.startTime);
        const shiftEnd = new Date(shift.endTime);
        const halfDayStart = shift.halfDayStart
          ? new Date(shift.halfDayStart)
          : null;
        const earlyOutTime = shift.earlyOut ? new Date(shift.earlyOut) : null;

        // Set the shift times to the attendance date
        const todayShiftStart = shiftTimeOnAttendanceDate(attendanceDate, shiftStart);
        zktecoDebug("todayShiftStart", todayShiftStart);

        const todayShiftEnd = shiftTimeOnAttendanceDate(attendanceDate, shiftEnd);
        zktecoDebug("todayShiftEnd", todayShiftEnd);

        // Calculate late arrival
        const lateSeconds = secondsAfter(checkInTime, todayShiftStart);
        const lateMinutes = Math.floor(lateSeconds / 60);
        zktecoDebug("checkInTime", new Date(checkInTime).toLocaleTimeString());
        zktecoDebug("checkOutTime", checkOutTime);

        zktecoDebug("lateMinutes", lateMinutes);
        // Calculate early departure
        let earlyOutMinutes = 0;
        let workingHours = "";
        if (checkOutTime) {
          earlyOutMinutes =
            checkOutTime < todayShiftEnd
              ? Math.floor(
                (todayShiftEnd.getTime() - checkOutTime.getTime()) /
                (1000 * 60),
              )
              : 0;
          zktecoDebug("earlyOutMinutes", earlyOutMinutes);

          let workingSeconds =
            (checkOutTime.getTime() - checkInTime.getTime()) / 1000;
          if (workingSeconds < 0) workingSeconds = 0;

          const hours = Math.floor(workingSeconds / 3600);
          const minutes = Math.floor((workingSeconds % 3600) / 60);
          const seconds = Math.floor(workingSeconds % 60);

          workingHours = `${hours}h ${minutes}m ${seconds}s`;
          zktecoDebug("workingHours", workingHours);
        }

        // Determine status based on timing
        let status = "PRESENT";

        // Check for half day (if left before half day threshold)
        if (halfDayStart && checkOutTime) {
          const todayHalfDayStart = shiftTimeOnAttendanceDate(attendanceDate, halfDayStart);

          if (checkOutTime < todayHalfDayStart) {
            status = "HALF_DAY";
          }
        }

        // Check for late arrival using configured grace period (default: 15 minutes)
        const graceMinutes = policy?.gracePeriodMinutes ?? 15;
        if (lateMinutes > graceMinutes) {
          status = status === "HALF_DAY" ? "HALF_DAY" : "LATE";
        }

        // Check for early departure (more than 15 minutes early)
        if (earlyOutMinutes > 15 && status !== "HALF_DAY") {
          status = "EARLY_OUT";
        }

        // Determine check-in status
        let checkInStatus = "ON_TIME_ARRIVAL";
        if (lateMinutes > graceMinutes) {
          checkInStatus = "LATE";
        }

        // Determine check-out status
        let checkOutStatus = checkOutTime
          ? earlyOutMinutes > 15
            ? "EARLY_OUT"
            : "ON_TIME_LEAVE"
          : (policy?.missingOnePunchAction || "LATE_OR_EARLY") === "LATE_OR_EARLY"
            ? "EARLY_OUT"
            : undefined;

        return {
          status,
          lateMinutes: lateMinutes,
          lateSeconds,
          earlyOutMinutes: earlyOutMinutes,
          workingHours: workingHours,
          checkInStatus: checkInStatus,
          checkOutStatus: checkOutStatus,
        };
      };

      // Transform data to include employee details and precise status from ZKTeco records
      const transformedRecords = attendanceRecords.map((record: any) => {
        const calculatedStatus = calculateAttendanceStatus(
          record,
          record.employee.shift,
        );
        zktecoDebug("record", record);
        zktecoDebug("record.zktecoRecords", record.zktecoRecords);

        // Get the most relevant precise status from ZKTeco records
        const checkInRecord = record.zktecoRecords.find(
          (r: any) => r.checkType === "check_in",
        );
        const checkOutRecord = record.zktecoRecords.find((r: any) => {
          zktecoDebug("rur", r);
          return r.checkType === "check_out";
        });
        zktecoDebug("checkInRecord", checkInRecord);
        zktecoDebug("checkOutRecord", checkOutRecord);

        // Use the most significant status (prioritize leave types, then late, then normal)
        let preciseStatus = null;
        const statusPriority = [
          "FULL_DAY_LEAVE",
          "HALF_DAY_LEAVE",
          "LATE",
          "EARLY_OUT",
          "ON_TIME_ARRIVAL",
          "ON_TIME_LEAVE",
        ];

        for (const status of statusPriority) {
          if (
            checkInRecord?.overallStatus === status ||
            checkOutRecord?.overallStatus === status
          ) {
            preciseStatus = status;
            break;
          }
        }
        zktecoDebug("preciseStatus", preciseStatus);

        return {
          id: record.id,
          date: record.date,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          status: preciseStatus || calculatedStatus.status, // Use precise status first, fallback to calculated
          originalStatus: record.status, // Keep original status for reference

          notes: record.notes,
          reason: record.reason,

          // Shift-based calculations
          lateMinutes: calculatedStatus.lateMinutes,
          lateSeconds: calculatedStatus.lateSeconds,
          earlyOutMinutes: calculatedStatus.earlyOutMinutes,
          workingHours: calculatedStatus.workingHours,

          // ZKTeco precise status details (use ZKTeco status if available, otherwise use calculated)
          checkInStatus:
            checkInRecord?.overallStatus ||
            calculatedStatus.checkInStatus ||
            null,
          checkOutStatus:
            checkOutRecord?.overallStatus ||
            calculatedStatus.checkOutStatus ||
            null,
          zktecoRecords: record.zktecoRecords.map((zkr: any) => ({
            id: zkr.id,
            timestamp: zkr.timestamp,
            checkType: zkr.checkType,
            status: zkr.overallStatus,
          })),

          employee: {
            id: record.employee.id,
            employeeId: record.employee.employeeId,
            name: `${record.employee.firstName} ${record.employee.lastName}`,
            email: record.employee.email,
            department: record.employee.department,
            departmentEntity: record.employee.departmentEntity,
            companies: record.employee.companyMemberships.map(
              (membership: any) => membership.company,
            ),
            shift: record.employee.shift
              ? {
                id: record.employee.shift.id,
                name: record.employee.shift.name,
                startTime: record.employee.shift.startTime,
                endTime: record.employee.shift.endTime,
                breakTime: record.employee.shift.breakTime,
              }
              : null,
          },
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
      });

      const normalizeArrivalStatus = (value: any): string[] => {
        if (!value) return [];

        switch (String(value)) {
          case "ON_TIME":
            return ["ON_TIME_ARRIVAL", "PRESENT"];

          case "LATE_ARRIVAL":
            return ["LATE"];

          case "HALF_DAY_ARRIVAL":
            return ["HALF_DAY", "HALF_DAY_LEAVE"];

          case "EARLY_OUT":
            return ["EARLY_OUT"];

          default:
            return [String(value)];
        }
      };

      const allowedStatuses = normalizeArrivalStatus(arrivalStatus);

      const filteredRecords =
        allowedStatuses.length > 0
          ? transformedRecords.filter((record: any) => {
            return (
              allowedStatuses.includes(record.status) ||
              allowedStatuses.includes(record.checkInStatus) ||
              allowedStatuses.includes(record.checkOutStatus)
            );
          })
          : transformedRecords;

      const total = filteredRecords.length;

      const paginatedRecords = filteredRecords.slice(skip, skip + take);

      const departments = await prisma.department.findMany({
        where: {
          isActive: true,
          ...(companyId
            ? {
                companyAssignments: {
                  some: { companyId: companyId as string },
                },
              }
            : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

      res.json({
        success: true,
        message: "Attendance data retrieved successfully",
        data: {
          records: paginatedRecords,
          departments,
          pagination: {
            page: pageNumber,
            currentPage: pageNumber,
            limit: limitNumber,
            total,
            totalRecords: total,
            pages: Math.ceil(total / limitNumber),
            totalPages: Math.ceil(total / limitNumber),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch attendance data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getEmpStatsData(req: Request, res: Response) {
    try {
      const { date: selectedDateQuery } = req.query;
      const authenticatedRequest = req as AuthenticatedRequest;
      const currentUser = authenticatedRequest.user;

      if (!currentUser?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const targetEmployeeId = currentUser.id;

      const attendanceSelect = {
        id: true,
        employeeId: true,
        date: true,
        checkIn: true,
        checkOut: true,
        status: true,
        notes: true,
        reason: true,
        employee: {
          select: {
            shift: {
              select: {
                id: true,
                name: true,
                startTime: true,
                endTime: true,
                breakTime: true,
                halfDayStart: true,
                fullDayStart: true,
                earlyOut: true,
              },
            },
          },
        },
        zktecoRecords: {
          select: {
            id: true,
            timestamp: true,
            checkType: true,
            overallStatus: true,
          },
          orderBy: { timestamp: "asc" as const },
        },
      };

      const calculateAttendanceStatus = (
        record: {
          checkIn: Date | null;
          checkOut: Date | null;
          date: Date;
        },
        shift: {
          startTime: Date;
          endTime: Date;
          halfDayStart: Date | null;
        } | null,
      ) => {
        if (!record.checkIn) {
          if (record.checkOut && shift) {
            const checkOutTime = new Date(record.checkOut);
            const attendanceDate = new Date(record.date);
            const shiftEnd = new Date(shift.endTime);
            const todayShiftEnd = shiftTimeOnAttendanceDate(attendanceDate, shiftEnd);
            const earlyOutMinutes =
              checkOutTime < todayShiftEnd
                ? Math.floor(
                  (todayShiftEnd.getTime() - checkOutTime.getTime()) /
                  (1000 * 60),
                )
                : 0;
            return {
              status: "ABSENT",
              checkOutStatus:
                earlyOutMinutes > 30 ? "EARLY_OUT" : "ON_TIME_LEAVE",
              earlyOutMinutes,
            };
          }
          return { status: "ABSENT" };
        }

        if (!shift) {
          return { status: "PRESENT" };
        }

        const checkInTime = new Date(record.checkIn);
        const checkOutTime = record.checkOut ? new Date(record.checkOut) : null;
        const attendanceDate = new Date(record.date);
        const shiftStart = new Date(shift.startTime);
        const shiftEnd = new Date(shift.endTime);
        const halfDayStart = shift.halfDayStart
          ? new Date(shift.halfDayStart)
          : null;

        const todayShiftStart = shiftTimeOnAttendanceDate(attendanceDate, shiftStart);

        const todayShiftEnd = shiftTimeOnAttendanceDate(attendanceDate, shiftEnd);

        const lateSeconds = secondsAfter(checkInTime, todayShiftStart);
        const lateMinutes = Math.floor(lateSeconds / 60);

        let earlyOutMinutes = 0;
        let workingHours = "";
        if (checkOutTime) {
          earlyOutMinutes =
            checkOutTime < todayShiftEnd
              ? Math.floor(
                (todayShiftEnd.getTime() - checkOutTime.getTime()) /
                (1000 * 60),
              )
              : 0;

          let workingSeconds =
            (checkOutTime.getTime() - checkInTime.getTime()) / 1000;
          if (workingSeconds < 0) workingSeconds = 0;

          const hours = Math.floor(workingSeconds / 3600);
          const minutes = Math.floor((workingSeconds % 3600) / 60);
          const seconds = Math.floor(workingSeconds % 60);
          workingHours = `${hours}h ${minutes}m ${seconds}s`;
        }

        let status = "PRESENT";

        if (halfDayStart && checkOutTime) {
          const todayHalfDayStart = shiftTimeOnAttendanceDate(attendanceDate, halfDayStart);
          if (checkOutTime < todayHalfDayStart) {
            status = "HALF_DAY";
          }
        }

        if (lateMinutes > 15) {
          status = status === "HALF_DAY" ? "HALF_DAY" : "LATE";
        }

        if (earlyOutMinutes > 30 && status !== "HALF_DAY") {
          status = "EARLY_OUT";
        }

        let checkInStatus = "ON_TIME_ARRIVAL";
        if (lateMinutes > 15) {
          checkInStatus = "LATE";
        }

        let checkOutStatus = checkOutTime ? "ON_TIME_LEAVE" : undefined;
        if (checkOutTime && earlyOutMinutes > 30) {
          checkOutStatus = "EARLY_OUT";
        }

        return {
          status,
          lateMinutes,
          lateSeconds,
          earlyOutMinutes,
          workingHours,
          checkInStatus,
          checkOutStatus,
        };
      };

      const transformRecord = (record: any) => {
        const shift = record.employee?.shift ?? null;
        const calculatedStatus = calculateAttendanceStatus(record, shift);

        const checkInRecord = record.zktecoRecords.find(
          (r: { checkType: string }) => r.checkType === "check_in",
        );
        const checkOutRecord = record.zktecoRecords.find(
          (r: { checkType: string }) => r.checkType === "check_out",
        );

        const statusPriority = [
          "FULL_DAY_LEAVE",
          "HALF_DAY_LEAVE",
          "LATE",
          "EARLY_OUT",
          "ON_TIME_ARRIVAL",
          "ON_TIME_LEAVE",
        ];

        let preciseStatus: string | null = null;
        for (const status of statusPriority) {
          if (
            checkInRecord?.overallStatus === status ||
            checkOutRecord?.overallStatus === status
          ) {
            preciseStatus = status;
            break;
          }
        }

        const finalStatus = preciseStatus || calculatedStatus.status;
        const checkInStatus =
          checkInRecord?.overallStatus ||
          calculatedStatus.checkInStatus ||
          null;
        const checkOutStatus =
          checkOutRecord?.overallStatus ||
          calculatedStatus.checkOutStatus ||
          null;

        const needsReason =
          (!record.reason || !record.reason.trim()) &&
          AttendanceReminderService.recordNeedsReason({
            checkIn: record.checkIn,
            checkOut: record.checkOut,
          });

        return {
          id: record.id,
          date: record.date,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          status: finalStatus,
          originalStatus: record.status,
          notes: record.notes,
          reason: record.reason,
          lateMinutes: calculatedStatus.lateMinutes ?? 0,
          lateSeconds: calculatedStatus.lateSeconds ?? 0,
          earlyOutMinutes: calculatedStatus.earlyOutMinutes ?? 0,
          workingHours: calculatedStatus.workingHours || null,
          checkInStatus,
          checkOutStatus,
          needsReason,
          hasRecord: true,
        };
      };

      const toDateOnly = (value: Date) =>
        new Date(value.getFullYear(), value.getMonth(), value.getDate());

      const parseDateQuery = (value: string) => {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day);
      };

      const now = new Date();
      const today = toDateOnly(now);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const selectedDate =
        typeof selectedDateQuery === "string" && selectedDateQuery
          ? parseDateQuery(selectedDateQuery)
          : null;

      const [
        monthRecords,
        todayRecord,
        selectedDateRecord,
        pendingLeaveRequests,
        employeeProfile,
      ] = await Promise.all([
        prisma.attendance.findMany({
          where: {
            employeeId: targetEmployeeId,
            date: { gte: monthStart, lte: monthEnd },
          },
          select: attendanceSelect,
          orderBy: { date: "desc" },
        }),
        prisma.attendance.findFirst({
          where: { employeeId: targetEmployeeId, date: today },
          select: attendanceSelect,
        }),
        selectedDate
          ? prisma.attendance.findFirst({
            where: { employeeId: targetEmployeeId, date: selectedDate },
            select: attendanceSelect,
          })
          : Promise.resolve(null),
        prisma.leaveRequest.count({
          where: {
            employeeId: targetEmployeeId,
            status: "PENDING",
          },
        }),
        prisma.user.findUnique({
          where: { id: targetEmployeeId },
          select: {
            shift: {
              select: {
                id: true,
                name: true,
                startTime: true,
                endTime: true,
                breakTime: true,
              },
            },
          },
        }),
      ]);

      const transformedMonthRecords = monthRecords.map(transformRecord);

      const isLate = (record: ReturnType<typeof transformRecord>) =>
        record.status === "LATE" ||
        record.checkInStatus === "LATE" ||
        record.lateMinutes > 15;

      const isAbsent = (record: ReturnType<typeof transformRecord>) =>
        record.status === "ABSENT" || !record.checkIn;

      const isEarlyOut = (record: ReturnType<typeof transformRecord>) =>
        record.status === "EARLY_OUT" ||
        record.checkOutStatus === "EARLY_OUT" ||
        record.earlyOutMinutes > 30;

      const isPresent = (record: ReturnType<typeof transformRecord>) =>
        !!record.checkIn &&
        !isAbsent(record) &&
        !["FULL_DAY_LEAVE", "HALF_DAY_LEAVE"].includes(record.status);

      const getWorkedHours = (
        checkIn: Date | string | null,
        checkOut: Date | string | null,
      ) => {
        if (!checkIn || !checkOut) return 0;
        const diffMs =
          new Date(checkOut).getTime() - new Date(checkIn).getTime();
        return diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
      };

      const monthStats = {
        label: now.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        present: transformedMonthRecords.filter(isPresent).length,
        late: transformedMonthRecords.filter(isLate).length,
        absent: transformedMonthRecords.filter(isAbsent).length,
        earlyOut: transformedMonthRecords.filter(isEarlyOut).length,
        halfDay: transformedMonthRecords.filter(
          (r) => r.status === "HALF_DAY" || r.status === "HALF_DAY_LEAVE",
        ).length,
        missingReasons: transformedMonthRecords.filter((r) => r.needsReason)
          .length,
        hoursLogged: Number(
          transformedMonthRecords
            .reduce(
              (sum, record) =>
                sum + getWorkedHours(record.checkIn, record.checkOut),
              0,
            )
            .toFixed(1),
        ),
        totalRecords: transformedMonthRecords.length,
      };

      const buildDayDetail = (
        dateValue: Date,
        record: (typeof monthRecords)[number] | null,
      ) => {
        if (!record) {
          return {
            date: dateValue,
            checkIn: null,
            checkOut: null,
            status: "NO_RECORD",
            workingHours: null,
            lateMinutes: 0,
            earlyOutMinutes: 0,
            checkInStatus: null,
            checkOutStatus: null,
            reason: null,
            needsReason: false,
            hasRecord: false,
          };
        }
        return transformRecord(record);
      };

      const shift = employeeProfile?.shift
        ? {
          id: employeeProfile.shift.id,
          name: employeeProfile.shift.name,
          startTime: employeeProfile.shift.startTime,
          endTime: employeeProfile.shift.endTime,
          breakTime: employeeProfile.shift.breakTime,
        }
        : null;

      res.json({
        success: true,
        message: "Employee dashboard stats retrieved successfully",
        data: {
          today: buildDayDetail(today, todayRecord),
          selectedDate: selectedDate
            ? buildDayDetail(selectedDate, selectedDateRecord)
            : null,
          month: monthStats,
          leaves: {
            pendingRequests: pendingLeaveRequests,
          },
          shift,
        },
      });
    } catch (error) {
      console.error("Error fetching employee dashboard stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employee dashboard stats",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getManagerTeamOverview(req: Request, res: Response) {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const currentUser = authenticatedRequest.user;

      if (!currentUser?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Check user details
      const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          department: true,
          userRank: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Find subordinates: strictly match direct manager email or ID
      const userMgrEmail = (user.email || "").toLowerCase().trim();
      const userMgrId = user.id;

      const managerConditions: any[] = [
        { manager: { equals: userMgrEmail } },
        { manager: { contains: userMgrEmail } },
        { manager: { equals: userMgrId } },
      ];

      const subordinates = await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: user.id },
          OR: managerConditions,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
          department: true,
          position: true,
          officialMobile: true,
          userRank: true,
        },
        orderBy: { firstName: "asc" },
      });

      const subordinateIds = subordinates.map((s) => s.id);

      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

      // Fetch today's attendance for subordinates
      const todayAttendances =
        subordinateIds.length > 0
          ? await prisma.attendance.findMany({
              where: {
                employeeId: { in: subordinateIds },
                date: { gte: todayStart, lte: todayEnd },
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeId: true,
                  },
                },
              },
            })
          : [];

      // Fetch pending leave requests for subordinates
      const pendingLeaves =
        subordinateIds.length > 0
          ? await prisma.leaveRequest.findMany({
              where: {
                employeeId: { in: subordinateIds },
                status: "PENDING",
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeId: true,
                    department: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            })
          : [];

      // Fetch pending regularisations for subordinates
      const pendingRegularisations =
        subordinateIds.length > 0
          ? await prisma.attendanceReason.findMany({
              where: {
                employeeId: { in: subordinateIds },
                status: "PENDING",
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeId: true,
                    department: true,
                  },
                },
              },
              orderBy: { datetime: "desc" },
            })
          : [];

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let onLeaveCount = 0;

      const teamList = subordinates.map((sub) => {
        const att = todayAttendances.find((a) => a.employeeId === sub.id);
        const onLeave = pendingLeaves.some(
          (l) => l.employeeId === sub.id && (l.status as string) === "APPROVED"
        );

        let status = "ABSENT";
        let checkInTime: string | null = null;
        let checkOutTime: string | null = null;

        if (onLeave) {
          status = "ON_LEAVE";
          onLeaveCount++;
        } else if (att?.checkIn) {
          checkInTime = att.checkIn.toISOString();
          checkOutTime = att.checkOut ? att.checkOut.toISOString() : null;
          if (att.status === "LATE" || String(att.notes || "").includes("Late")) {
            status = "LATE";
            lateCount++;
            presentCount++;
          } else {
            status = "PRESENT";
            presentCount++;
          }
        } else {
          status = "ABSENT";
          absentCount++;
        }

        return {
          id: sub.id,
          name: `${sub.firstName} ${sub.lastName}`.trim(),
          employeeId: sub.employeeId || "—",
          email: sub.email,
          department: sub.department || "General",
          position: sub.position || "Employee",
          status,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          reason: att?.reason || null,
        };
      });

      res.json({
        success: true,
        message: "Manager team overview retrieved successfully",
        data: {
          teamStats: {
            totalMembers: subordinates.length,
            present: presentCount,
            late: lateCount,
            absent: absentCount,
            onLeave: onLeaveCount,
            pendingApprovals:
              pendingLeaves.length + pendingRegularisations.length,
          },
          subordinates: teamList,
          pendingLeaves,
          pendingRegularisations,
        },
      });
    } catch (error) {
      console.error("Error fetching manager team overview:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch manager team overview",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async uploadEmployeeToDevice(
    req: AuthenticatedRequest,
    res: Response,
  ) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { deviceId, employeeId, cardNumber } = req.body;

      // Find employee in database
      const employee = await prisma.user.findFirst({
        where: {
          OR: [{ id: employeeId }, { employeeId: employeeId }],
        },
      });

      if (!employee || !employee.employeeId) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      const employeeData: EmployeeData = {
        employeeId: employee.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        cardNumber: cardNumber || undefined,
      };

      const success = await zktecoService.uploadEmployeeToDevice(
        deviceId,
        employeeData,
      );

      if (success) {
        res.json({
          success: true,
          message: "Employee uploaded to device successfully",
          data: {
            deviceId,
            employee: employeeData,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to upload employee to device",
        });
      }
    } catch (error) {
      console.error("Error uploading employee to device:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload employee to device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async uploadAllEmployeesToDevice(
    req: AuthenticatedRequest,
    res: Response,
  ) {
    try {
      const { deviceId } = req.body;

      // Get all active employees
      const employees = await prisma.user.findMany({
        where: {
          employeeId: { not: null },
          isActive: true,
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
        },
      });

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const employee of employees) {
        try {
          const employeeData: EmployeeData = {
            employeeId: employee.employeeId!,
            name: `${employee.firstName} ${employee.lastName}`,
          };

          const success = await zktecoService.uploadEmployeeToDevice(
            deviceId,
            employeeData,
          );
          if (success) {
            successCount++;
          } else {
            failCount++;
            errors.push(
              `Failed to upload ${employee.firstName} ${employee.lastName}`,
            );
          }
        } catch (error) {
          failCount++;
          errors.push(
            `Error uploading ${employee.firstName} ${employee.lastName}: ${error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      }

      res.json({
        success: true,
        message: "Employee upload completed",
        data: {
          deviceId,
          totalEmployees: employees.length,
          successCount,
          failCount,
          errors: errors.slice(0, 10), // Limit errors to first 10
        },
      });
    } catch (error) {
      console.error("Error uploading all employees to device:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload employees to device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async addDevice(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { id, name, ip, port = 4370, serialNumber, model } = req.body;

      const device: ZKTecoDevice = {
        id,
        name,
        ip,
        port: Number(port),
        serialNumber,
        model,
        isActive: true,
      };

      zktecoService.addDevice(device);

      res.status(201).json({
        success: true,
        message: "Device added successfully",
        data: device,
      });
    } catch (error) {
      console.error("Error adding device:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async removeDevice(req: AuthenticatedRequest, res: Response) {
    try {
      const { deviceId } = req.params;

      const removed = zktecoService.removeDevice(deviceId);

      if (removed) {
        res.json({
          success: true,
          message: "Device removed successfully",
          data: { deviceId },
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Device not found",
        });
      }
    } catch (error) {
      console.error("Error removing device:", error);
      res.status(500).json({
        success: false,
        message: "Failed to remove device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async clearDeviceAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const { deviceId } = req.body;

      const success = await zktecoService.clearDeviceAttendance(deviceId);

      if (success) {
        res.json({
          success: true,
          message: "Device attendance data cleared successfully",
          data: { deviceId },
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to clear device attendance data",
        });
      }
    } catch (error) {
      console.error("Error clearing device attendance:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear device attendance data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async fetchAllAttendanceFromMachine(req: Request, res: Response) {
    try {
      const { deviceId, startDate, endDate, filter } = req.query;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID is required",
        });
      }

      zktecoDebug(
        `🔄 Fetching attendance records for device: ${deviceId} with filter: ${filter}`,
      );

      // Build where clause with date filtering
      const where: any = {
        deviceId: deviceId as string,
      };

      // Handle date filtering
      let start: Date | undefined;
      let end: Date | undefined;

      // First priority: custom date range
      if (startDate && endDate) {
        start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0); // Start of day
        end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999); // End of day
        zktecoDebug(
          `📅 Custom date range: ${start.toISOString()} to ${end.toISOString()}`,
        );
      }
      // Second priority: predefined filters
      else if (filter && filter !== "all-data") {
        const now = new Date();

        switch (filter) {
          case "current-month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              0,
              23,
              59,
              59,
            );
            break;
          case "last-month":
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
          case "current-year":
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
          case "last-year":
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            break;
        }
        zktecoDebug(
          `📅 Filter applied: ${filter} - ${start?.toISOString()} to ${end?.toISOString()}`,
        );
      }

      // Apply date filter if start and end are defined
      if (start && end) {
        where.timestamp = {
          gte: start,
          lte: end,
        };
      }

      // Fetch ZKTeco records for this device from database
      // (Machine doesn't support HTTP attendance retrieval - data comes via iClock push)
      const zktecoRecords = await prisma.zKTecoAttendanceRecord.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      // Transform the data
      const transformedRecords = zktecoRecords.map((record: any) => ({
        employeeId: record.employeeId,
        timestamp: record.timestamp,
        checkType: record.checkType,
        deviceId: record.deviceId,
        verifyType: record.verifyType,
        processed: record.processed,
        processingError: record.processingError,
        employee: record.User
          ? {
            id: record.User.id,
            employeeId: record.User.employeeId,
            name: `${record.User.firstName} ${record.User.lastName}`,
            email: record.User.email,
          }
          : null,
      }));

      zktecoDebug(
        `📊 Found ${transformedRecords.length} attendance records for device ${deviceId}`,
      );

      res.json({
        success: true,
        message: `All attendance records for device ${deviceId} (received via iClock protocol)`,
        data: {
          deviceId,
          totalRecords: transformedRecords.length,
          records: transformedRecords,
          fetchedAt: new Date(),
          note: "ZKTeco device pushes data automatically via iClock protocol. This shows all received data for this device.",
        },
      });
    } catch (error) {
      console.error("Error fetching attendance records for device:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch attendance records for device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getAllZKTecoRecords(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 100,
        employeeId,
        deviceId,
        checkType,
        startDate,
        endDate,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Build where clause
      const where: any = {};

      if (employeeId) {
        where.employeeId = employeeId as string;
      }

      if (deviceId) {
        where.deviceId = deviceId as string;
      }

      if (checkType) {
        where.checkType = checkType as string;
      }

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.timestamp.lte = new Date(endDate as string);
        }
      }

      const [zktecoRecords, total] = await Promise.all([
        prisma.zKTecoAttendanceRecord.findMany({
          where,
          include: {
            User: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            timestamp: "desc",
          },
          skip,
          take,
        }),
        prisma.zKTecoAttendanceRecord.count({ where }),
      ]);

      // Transform data
      const transformedRecords = zktecoRecords.map((record: any) => ({
        id: record.id,
        employeeId: record.employeeId,
        deviceId: record.deviceId,
        timestamp: record.timestamp,
        checkType: record.checkType,
        verifyType: record.verifyType,
        workCode: record.workCode,
        processed: record.processed,
        processingError: record.processingError,
        employee: record.User
          ? {
            id: record.User.id,
            employeeId: record.User.employeeId,
            name: `${record.User.firstName} ${record.User.lastName}`,
            email: record.User.email,
          }
          : null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));

      res.json({
        success: true,
        message: "ZKTeco attendance records retrieved successfully",
        data: {
          records: transformedRecords,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching ZKTeco records:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch ZKTeco attendance records",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getEmployeeDeductionHistory(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;
      const deductionHistory =
        await zktecoService.getEmployeeDeductionHistory(employeeId);

      res.json({
        success: true,
        message: "Employee deduction history retrieved successfully",
        data: {
          employeeId,
          deductions: deductionHistory,
          totalDeductions: deductionHistory.length,
        },
      });
    } catch (error) {
      console.error("Error fetching deduction history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch deduction history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async debugAttendanceRecords(req: Request, res: Response) {
    try {
      const { employeeId, date } = req.params;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "Date parameter is required (YYYY-MM-DD)",
        });
      }

      const debugInfo = await zktecoService.debugAttendanceRecords(
        employeeId,
        date,
      );

      if (!debugInfo) {
        return res.status(404).json({
          success: false,
          message: "Debug information not found",
        });
      }

      res.json({
        success: true,
        message: "Attendance debug information retrieved successfully",
        data: debugInfo,
      });
    } catch (error) {
      console.error("Error debugging attendance records:", error);
      res.status(500).json({
        success: false,
        message: "Failed to debug attendance records",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async fixAttendanceRecords(req: Request, res: Response) {
    try {
      const { employeeId, date } = req.params;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "Date parameter is required (YYYY-MM-DD)",
        });
      }

      const fixResult = await zktecoService.fixAttendanceRecords(
        employeeId,
        date,
      );

      if (!fixResult) {
        return res.status(404).json({
          success: false,
          message: "Fix operation failed",
        });
      }

      res.json({
        success: true,
        message: "Attendance records fixed successfully",
        data: fixResult,
      });
    } catch (error) {
      console.error("Error fixing attendance records:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fix attendance records",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getEmployeeLeaveBalance(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;
      const leaveBalance =
        await zktecoService.getEmployeeLeaveBalance(employeeId);

      zktecoDebug("leaveBalance", leaveBalance);

      if (!leaveBalance) {
        return res.status(404).json({
          success: false,
          message: "Employee leave balance not found",
        });
      }

      res.json({
        success: true,
        message: "Employee leave balance retrieved successfully",
        data: leaveBalance,
      });
    } catch (error) {
      console.error("Error fetching leave balance:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch leave balance",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async validateRecordsForDeduction(req: Request, res: Response) {
    try {
      const { recordIds } = req.body;
      zktecoDebug("recordIds", recordIds);

      if (!recordIds || !Array.isArray(recordIds)) {
        return res.status(400).json({
          success: false,
          message: "recordIds array is required",
        });
      }

      const validation =
        await zktecoService.validateRecordsForDeduction(recordIds);

      res.json({
        success: true,
        message: "Record validation completed",
        data: validation,
      });
    } catch (error) {
      console.error("Error validating records:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate records",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async exportAttendanceData(req: Request, res: Response) {
    try {
      const { deviceId, startDate, endDate, format = "csv" } = req.query;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Device ID is required",
        });
      }

      zktecoDebug(
        `🔄 Exporting attendance data for device: ${deviceId} in ${format} format`,
      );

      // Build where clause with date filtering
      const where: any = {
        deviceId: deviceId as string,
      };

      if (startDate && endDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);

        where.timestamp = {
          gte: start,
          lte: end,
        };
      }

      // Fetch all records for export (no pagination)
      const zktecoRecords = await prisma.zKTecoAttendanceRecord.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      // Transform data for export
      const exportData = zktecoRecords.map((record: any) => ({
        "Employee ID": record.employeeId,
        "Employee Name": record.User
          ? `${record.User.firstName} ${record.User.lastName}`
          : `Employee ${record.employeeId}`,
        Email: record.User?.email || "N/A",
        Timestamp: record.timestamp.toISOString(),
        Date: record.timestamp.toLocaleDateString(),
        Time: record.timestamp.toLocaleTimeString(),
        Action: record.checkType === "check_in" ? "Check In" : "Check Out",
        "Device ID": record.deviceId,
        "Verify Type":
          record.verifyType === 1
            ? "Fingerprint"
            : record.verifyType === 2
              ? "Password"
              : "Card",
        Processed: record.processed ? "Yes" : "No",
        "Processing Error": record.processingError || "None",
        "Created At": record.createdAt.toISOString(),
      }));

      const filename = `attendance_${deviceId}_${startDate}_to_${endDate}`;

      if (format === "csv") {
        // Generate CSV
        const headers = Object.keys(exportData[0] || {});
        const csvContent = [
          headers.join(","),
          ...exportData.map((row: any) =>
            headers
              .map((header) => {
                const value = row[header as keyof typeof row];
                // Escape quotes and wrap in quotes if contains comma
                return typeof value === "string" && value.includes(",")
                  ? `"${value.replace(/"/g, '""')}"`
                  : value;
              })
              .join(","),
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.csv"`,
        );
        res.send(csvContent);
      } else if (format === "xlsx") {
        // For XLSX, we'll return JSON and let frontend handle Excel generation
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.json"`,
        );
        res.json({
          success: true,
          data: exportData,
          filename: `${filename}.xlsx`,
          message: `Exported ${exportData.length} attendance records`,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid format. Supported formats: csv, xlsx",
        });
      }

      zktecoDebug(
        `📊 Exported ${exportData.length} attendance records in ${format} format`,
      );
    } catch (error) {
      console.error("Error exporting attendance data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export attendance data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async createEmployeeFromZKTeco(req: Request, res: Response) {
    try {
      const { employeeId, firstName, lastName, email } = req.body;

      if (!employeeId || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: "Employee ID, first name, and last name are required",
        });
      }

      // Check if employee already exists
      const existingEmployee = await prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: employeeId },
            { email: email || `${employeeId}@company.com` },
          ],
        },
      });

      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: "Employee with this ID or email already exists",
          data: {
            existingEmployee: {
              id: existingEmployee.id,
              employeeId: existingEmployee.employeeId,
              name: `${existingEmployee.firstName} ${existingEmployee.lastName}`,
              email: existingEmployee.email,
            },
          },
        });
      }

      // Create new employee
      const employee = await prisma.user.create({
        data: {
          employeeId: employeeId,
          firstName: firstName,
          lastName: lastName,
          email: email || `${employeeId}@company.com`,
          password: "$2b$10$defaulthashedpassword", // Default password hash
          role: "EMPLOYEE",
          status: "ACTIVE",
          dateOfJoining: new Date(),
        },
      });

      zktecoDebug(
        `✅ Employee created: ${employee.employeeId} - ${employee.firstName} ${employee.lastName}`,
      );

      res.json({
        success: true,
        message: "Employee created successfully",
        data: {
          employee: {
            id: employee.id,
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            email: employee.email,
            role: employee.role,
          },
        },
      });
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create employee",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getAttendanceStats(req: Request, res: Response) {
    try {
      const { startDate, endDate, departmentId, companyId } = req.query;

      // Pakistan today in YYYY-MM-DD format
      const getPakistanToday = () => {
        return new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Karachi",
        });
      };

      // For MySQL DATE column, use pure UTC date range
      const getDateRange = (date: string) => {
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);

        return { start, end };
      };

      const formatDateOnly = (date: Date) => {
        return date.toISOString().split("T")[0];
      };

      const employeeWhere: any = {
        employeeId: { not: null },
        isActive: true,
      };

      if (departmentId) {
        employeeWhere.departmentId = departmentId as string;
      }

      if (companyId) {
        employeeWhere.companyMemberships = {
          some: { companyId: companyId as string },
        };
      }

      const baseAttendanceWhere: any = {
        employee: {
          employeeId: { not: null },
          isActive: true,
          ...(departmentId ? { departmentId: departmentId as string } : {}),
          ...(companyId
            ? {
                companyMemberships: {
                  some: { companyId: companyId as string },
                },
              }
            : {}),
        },
      };

      let selectedStartDate: string;
      let selectedEndDate: string;
      let isFallbackDate = false;

      // CASE 1: User selected date/range manually
      if (startDate || endDate) {
        selectedStartDate = (startDate as string) || (endDate as string);
        selectedEndDate = (endDate as string) || selectedStartDate;
      } else {
        // CASE 2: No date selected, first check today's attendance
        const today = getPakistanToday();
        const todayRange = getDateRange(today);

        const todayAttendanceCount = await prisma.attendance.count({
          where: {
            ...baseAttendanceWhere,
            date: {
              gte: todayRange.start,
              lt: todayRange.end,
            },
          },
        });

        if (todayAttendanceCount > 0) {
          selectedStartDate = today;
          selectedEndDate = today;
        } else {
          // CASE 3: Today has no attendance, get latest previous attendance date
          const latestAttendance = await prisma.attendance.findFirst({
            where: {
              ...baseAttendanceWhere,
              date: {
                lt: todayRange.start,
              },
            },
            select: {
              date: true,
            },
            orderBy: {
              date: "desc",
            },
          });

          if (latestAttendance) {
            const latestDate = formatDateOnly(latestAttendance.date);

            selectedStartDate = latestDate;
            selectedEndDate = latestDate;
            isFallbackDate = true;
          } else {
            // CASE 4: No attendance found at all
            selectedStartDate = today;
            selectedEndDate = today;
          }
        }
      }

      const startRange = getDateRange(selectedStartDate);
      const endRange = getDateRange(selectedEndDate);

      const attendanceWhere: any = {
        ...baseAttendanceWhere,
        date: {
          gte: startRange.start,
          lt: endRange.end,
        },
      };

      const totalEmployees = await prisma.user.count({
        where: employeeWhere,
      });

      const attendanceRecords = await prisma.attendance.findMany({
        where: attendanceWhere,
        select: {
          id: true,
          employeeId: true,
          status: true,
          checkIn: true,
          checkOut: true,
          zktecoRecords: {
            select: {
              overallStatus: true,
            },
          },
        },
      });

      const attendedEmployeeIds = new Set<string>();
      const absentEmployeeIds = new Set<string>();
      const lateEmployeeIds = new Set<string>();
      const halfDayEmployeeIds = new Set<string>();
      const wfhEmployeeIds = new Set<string>();

      for (const record of attendanceRecords) {
        attendedEmployeeIds.add(record.employeeId);

        const zkStatuses = record.zktecoRecords.map((zkr) => zkr.overallStatus);

        const isLate = zkStatuses.includes("LATE");

        const isHalfDay = zkStatuses.includes("HALF_DAY_LEAVE");

        const isAbsent =
          zkStatuses.includes("ABSENT") ||
          zkStatuses.includes("FULL_DAY_LEAVE") ||
          (!record.checkIn && !record.checkOut);

        const isWorkFromHome = record.status === "WORK_FROM_HOME";

        if (isAbsent) {
          absentEmployeeIds.add(record.employeeId);
        }

        if (isLate) {
          lateEmployeeIds.add(record.employeeId);
        }

        if (isHalfDay) {
          halfDayEmployeeIds.add(record.employeeId);
        }

        if (isWorkFromHome) {
          wfhEmployeeIds.add(record.employeeId);
        }
      }

      const employeesWithoutAttendance =
        totalEmployees - attendedEmployeeIds.size;

      const absentCount = employeesWithoutAttendance + absentEmployeeIds.size;

      const presentCount = attendedEmployeeIds.size - absentEmployeeIds.size;

      const stats = {
        dateFrom: selectedStartDate,
        dateTo: selectedEndDate,
        isFallbackDate,

        totalEmployees,

        totalAttendanceRecords: attendanceRecords.length,
        todaysAttendance: attendedEmployeeIds.size,

        present: Math.max(presentCount, 0),
        absent: Math.max(absentCount, 0),
        late: lateEmployeeIds.size,
        halfDay: halfDayEmployeeIds.size,
        workFromHome: wfhEmployeeIds.size,
      };
      const rawTodayCount = await prisma.attendance.count({
        where: {
          date: {
            gte: startRange.start,
            lt: startRange.end,
          },
        },
      });

      const filteredTodayCount = await prisma.attendance.count({
        where: attendanceWhere,
      });

      zktecoDebug("Raw today attendance:", rawTodayCount);
      zktecoDebug("Filtered today attendance:", filteredTodayCount);
      zktecoDebug("attendanceWhere:", JSON.stringify(attendanceWhere, null, 2));

      res.json({
        success: true,
        message: "Attendance statistics retrieved successfully",
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching attendance statistics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch attendance statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getDeviceInfo(req: Request, res: Response) {
    try {
      const { deviceId } = req.params;

      const device = zktecoService.getDevices().find((d) => d.id === deviceId);
      if (!device) {
        return res.status(404).json({
          success: false,
          message: "Device not found",
        });
      }

      const status = await zktecoService.getDeviceStatus(deviceId);

      res.json({
        success: true,
        message: "Device information retrieved successfully",
        data: {
          device,
          status: status.online ? "online" : "offline",
          lastSeen: status.lastSeen,
          info: status.info,
          admsEnabled: true,
          pushDataEnabled: true,
        },
      });
    } catch (error) {
      console.error("Error fetching device info:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch device information",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async simulateAttendance(req: Request, res: Response): Promise<void> {
    try {
      const {
        employeeId,
        checkType,
        deviceIp = "192.168.2.202",
        verifyType = 1,
      } = req.body;

      if (!employeeId || !checkType) {
        res.status(400).json({
          success: false,
          message: "Employee ID and check type are required",
        });
        return;
      }

      // Create simulated attendance data
      const attendanceData = {
        employeeId: employeeId.toString(),
        timestamp: new Date(),
        checkType: checkType as "check_in" | "check_out",
        deviceId: "uface800_001",
        verifyType: verifyType,
      };

      // Process the attendance data (this will trigger live updates)
      await (zktecoService as any).processAttendanceData(
        attendanceData,
        deviceIp,
      );

      res.status(200).json({
        success: true,
        message: `Simulated ${checkType} for employee ${employeeId}`,
        data: attendanceData,
      });
    } catch (error) {
      console.error("Error simulating attendance:", error);
      res.status(500).json({
        success: false,
        message: "Failed to simulate attendance",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async handleIClockGetRequest(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      // 🔍 EXTRACT DEVICE ID: Get serial number from query parameters
      const sn = req.query.SN as string;

      // 📝 LOG DEVICE CONNECTION: Track when devices connect
      // 🔄 AUTO-SYNC: Service will automatically register/update device status
      const result = await zktecoService.handleIClockGetRequest(sn);

      // ✅ ACKNOWLEDGE: Send "OK" to confirm device connection
      res.status(200).send(result);
    } catch (error) {
      console.error("Error handling iClock GET request:", error);
      res.status(500).send("Internal Server Error");
    }
  }
  static async handleIClockPing(req: Request, res: Response): Promise<void> {
    try {
      const sn = req.query.SN as string;

      const result = await zktecoService.handleIClockPing(sn);

      res.status(200).send(result);
    } catch (error) {
      console.error("Error handling iClock ping:", error);
      res.status(500).send("Internal Server Error");
    }
  }
  static async handleIClockFData(req: Request, res: Response): Promise<void> {
    try {
      // For now, just acknowledge receipt
      res.status(200).send("OK");
    } catch (error) {
      console.error("Error handling iClock fdata:", error);
      res.status(400).send("Face data processing error");
    }
  }
  static async handleIClockCData(req: Request, res: Response): Promise<void> {
    try {
      const sn = req.query.SN as string;
      const table = req.query.table as string;
      const options = String(req.query.options || "").toLowerCase();
      const requestType = String(req.query.type || "").toLowerCase();

      // The terminal combines this GMT header with TimeZone from the PUSH
      // initialization response when setting its physical clock.
      res.setHeader("Date", new Date().toUTCString());
      res.setHeader("Cache-Control", "no-store");
      res.type("text/plain");

      if (req.method === "GET" && options === "all") {
        const result = await zktecoService.handleIClockOptionsRequest(sn);
        res.status(200).send(result);
        return;
      }

      if (req.method === "GET" && requestType === "time") {
        res.status(200).send(zktecoService.handleIClockTimeRequest());
        return;
      }

      // Get raw body data
      const postData = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body || "", "utf-8");

      const result = await zktecoService.handleIClockCData(sn, table, postData);

      res.status(200).send(result);
    } catch (error) {
      console.error("Error handling iClock cdata:", error);
      res.status(400).send("Data processing error");
    }
  }
  static async forceFinalizeAll(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;

      // Security check: Only SuperAdmin can force finalize
      if (currentUser.role !== "SUPERADMIN") {
        res.status(403).json({
          success: false,
          message: "Only SuperAdmin can force finalize staging records",
        });
        return;
      }

      zktecoDebug(
        `🔐 SuperAdmin ${currentUser.email} forcing finalization of all staging records`,
      );

      const { finalizationService } =
        await import("../services/finalizationService");
      const result = await finalizationService.forceFinalizeAllStagingRecords(
        currentUser.id,
      );

      res.json({
        success: result.success,
        message: `Finalized ${result.finalized} records with ${result.errors} errors`,
        data: {
          finalized: result.finalized,
          errors: result.errors,
        },
      });
    } catch (error) {
      console.error("Error force finalizing records:", error);
      res.status(500).json({
        success: false,
        message: "Failed to force finalize records",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async runFinalizationCron(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;

      // Security check: Only SuperAdmin can run cron manually
      if (currentUser.role !== "SUPERADMIN") {
        res.status(403).json({
          success: false,
          message: "Only SuperAdmin can run finalization cron",
        });
        return;
      }

      zktecoDebug(
        `🔐 SuperAdmin ${currentUser.email} running finalization cron manually`,
      );

      const { finalizationService } =
        await import("../services/finalizationService");
      const result = await finalizationService.finalizeStagingRecords();

      res.json({
        success: result.success,
        message: `Retried ${result.finalized} pending records with ${result.errors} errors`,
        data: {
          finalized: result.finalized,
          errors: result.errors,
        },
      });
    } catch (error) {
      console.error("Error running finalization cron:", error);
      res.status(500).json({
        success: false,
        message: "Failed to run finalization cron",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async addLateReason(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const currentUser = authenticatedRequest.user;
      const { recordId, reason } = req.body;

      // Validate input
      if (!recordId || !reason) {
        res.status(400).json({
          success: false,
          message: "Record ID and reason are required",
        });
        return;
      }

      if (reason.trim().length < 10) {
        res.status(400).json({
          success: false,
          message: "Reason must be at least 10 characters long",
        });
        return;
      }

      // Find the attendance record or handles unmarked record ID
      let record = await prisma.attendance.findUnique({
        where: { id: recordId },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!record && String(recordId).startsWith("unmarked-")) {
        const raw = String(recordId).substring("unmarked-".length);
        const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);

        if (dateMatch) {
          const dateStr = dateMatch[1];
          let userIdentifier = raw.split(/[-_]\d{4}-\d{2}-\d{2}/)[0];
          if (!userIdentifier) {
            userIdentifier = raw.split("_")[0];
          }

          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { id: userIdentifier.trim() },
                { employeeId: userIdentifier.trim() },
              ],
            },
          });

          if (user) {
            const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

            record = await prisma.attendance.upsert({
              where: {
                employeeId_date: {
                  employeeId: user.id,
                  date: dateObj,
                },
              },
              create: {
                employeeId: user.id,
                date: dateObj,
                status: "ABSENT",
                reason: reason.trim(),
              },
              update: {
                reason: reason.trim(),
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            });

            res.json({
              success: true,
              message: "Reason submitted successfully",
              data: record,
            });
            return;
          }
        }
      }

      if (!record) {
        res.status(404).json({
          success: false,
          message: "Attendance record not found",
        });
        return;
      }

      // Security check: Only the employee themselves can add/update their reason
      // Unless they are HR or Admin
      const isOwnRecord = record.employeeId === currentUser?.id;
      const isHROrAdmin =
        currentUser?.role === "HR" ||
        currentUser?.role === "ADMIN" ||
        currentUser?.role === "SUPERADMIN";

      if (!isOwnRecord && !isHROrAdmin) {
        res.status(403).json({
          success: false,
          message: "You can only add reasons for your own attendance records",
        });
        return;
      }

      // Update the record with the reason
      const updatedRecord = await prisma.attendance.update({
        where: { id: recordId },
        data: {
          reason: reason.trim(),
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Reason submitted successfully",
        data: updatedRecord,
      });
    } catch (error) {
      console.error("Error adding late reason:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit reason",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async updateLateReason(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const currentUser = authenticatedRequest.user;
      const { id } = req.params;
      const { reason } = req.body;

      // Validate input
      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Reason is required",
        });
        return;
      }

      if (reason.trim().length < 10) {
        res.status(400).json({
          success: false,
          message: "Reason must be at least 10 characters long",
        });
        return;
      }

      // Find the attendance record or handles unmarked record ID
      let record = await prisma.attendance.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!record && String(id).startsWith("unmarked-")) {
        const raw = String(id).substring("unmarked-".length);
        const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);

        if (dateMatch) {
          const dateStr = dateMatch[1];
          let userIdentifier = raw.split(/[-_]\d{4}-\d{2}-\d{2}/)[0];
          if (!userIdentifier) {
            userIdentifier = raw.split("_")[0];
          }

          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { id: userIdentifier.trim() },
                { employeeId: userIdentifier.trim() },
              ],
            },
          });

          if (user) {
            const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

            record = await prisma.attendance.upsert({
              where: {
                employeeId_date: {
                  employeeId: user.id,
                  date: dateObj,
                },
              },
              create: {
                employeeId: user.id,
                date: dateObj,
                status: "ABSENT",
                reason: reason.trim(),
              },
              update: {
                reason: reason.trim(),
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            });

            res.json({
              success: true,
              message: "Reason updated successfully",
              data: record,
            });
            return;
          }
        }
      }

      if (!record) {
        res.status(404).json({
          success: false,
          message: "Attendance record not found",
        });
        return;
      }

      // Security check
      const isOwnRecord = record.employeeId === currentUser?.id;
      const isHROrAdmin =
        currentUser?.role === "HR" ||
        currentUser?.role === "ADMIN" ||
        currentUser?.role === "SUPERADMIN";

      if (!isOwnRecord && !isHROrAdmin) {
        res.status(403).json({
          success: false,
          message:
            "You can only update reasons for your own attendance records",
        });
        return;
      }

      // Update the record
      const updatedRecord = await prisma.attendance.update({
        where: { id },
        data: {
          reason: reason.trim(),
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Reason updated successfully",
        data: updatedRecord,
      });
    } catch (error) {
      console.error("Error updating late reason:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update reason",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async sendLateReasonReminders(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const currentUser = authenticatedRequest.user;

      const isHROrAdmin =
        currentUser?.role === "HR" ||
        currentUser?.role === "ADMIN" ||
        currentUser?.role === "SUPERADMIN";

      if (!isHROrAdmin) {
        res.status(403).json({
          success: false,
          message: "Only HR and Admin can send reminders",
        });
        return;
      }

      const {
        sendAll = false,
        fromDate,
        toDate,
        companyId,
      } = req.body as {
        sendAll?: boolean;
        fromDate?: string;
        toDate?: string;
        companyId?: string;
      };

      if (!sendAll && (!fromDate || !toDate)) {
        res.status(400).json({
          success: false,
          message: "fromDate and toDate are required unless sendAll is true",
        });
        return;
      }

      if (!sendAll && fromDate! > toDate!) {
        res.status(400).json({
          success: false,
          message: "fromDate must be on or before toDate",
        });
        return;
      }

      const recordsNeedingReasons =
        await AttendanceReminderService.fetchRecordsWithoutReasons({
          sendAll: Boolean(sendAll),
          fromDate,
          toDate,
          companyId,
        });

      if (recordsNeedingReasons.length === 0) {
        res.json({
          success: true,
          message: "No employees need to provide reasons",
          data: {
            remindersQueued: 0,
            employeesQueued: 0,
            records: [],
          },
        });
        return;
      }

      const recordsByEmployee = AttendanceReminderService.groupByEmployee(
        recordsNeedingReasons,
      );

      const jobs = await Promise.all(
        Array.from(recordsByEmployee.entries()).map(([employeeId, records]) =>
          queueAttendanceReminderEmail({
            employeeId,
            recordIds: records.map((r) => r.id),
          }),
        ),
      );

      res.status(202).json({
        success: true,
        message: `Queued reminder emails for ${recordsByEmployee.size} employee${recordsByEmployee.size !== 1 ? "s" : ""}. They will be sent by the database email worker.`,
        data: {
          remindersQueued: recordsNeedingReasons.length,
          employeesQueued: recordsByEmployee.size,
          jobIds: jobs.map((j) => j?.id).filter(Boolean),
          sendAll: Boolean(sendAll),
          fromDate: sendAll ? null : fromDate,
          toDate: sendAll ? null : toDate,
          records: Array.from(recordsByEmployee.entries()).map(
            ([userId, records]) => ({
              userId,
              employeeName: `${records[0].employee?.firstName} ${records[0].employee?.lastName}`,
              email:
                records[0].employee?.officialEmail ||
                records[0].employee?.email,
              recordCount: records.length,
              dates: records.map((r) => new Date(r.date).toLocaleDateString()),
            }),
          ),
        },
      });
    } catch (error) {
      console.error("Error sending late reason reminders:", error);
      res.status(500).json({
        success: false,
        message: "Failed to queue reminders",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async requestReason(req: Request, res: Response): Promise<void> {
    try {
      const { record } = req.body;

      // Validate required fields
      if (!record) {
        res.status(400).json({
          success: false,
          message: "Record is required",
        });
        return;
      }

      // Validate employee email
      const employeeEmail =
        record.employee?.email ||
        record.employee?.officialEmail ||
        record.rawUnmarked?.email ||
        record.email;

      if (!employeeEmail) {
        res.status(400).json({
          success: false,
          message: "Employee email not found in record",
        });
        return;
      }

      // Recalculate from stored timestamps so stale table values cannot inflate the email.
      let lateSeconds = record.lateSeconds ?? (record.lateMinutes || 0) * 60;
      let earlyOutSeconds = (record.earlyOutMinutes || 0) * 60;
      if (record.id && (record.checkIn || record.checkOut)) {
        const stored = await prisma.attendance.findUnique({
          where: { id: record.id },
          include: { employee: { select: { shift: true } } },
        });
        if (stored?.employee.shift) {
          if (stored.checkIn) {
            lateSeconds = secondsAfter(
              stored.checkIn,
              shiftTimeOnAttendanceDate(stored.date, stored.employee.shift.startTime),
            );
          }
          if (stored.checkOut) {
            earlyOutSeconds = secondsAfter(
              shiftTimeOnAttendanceDate(stored.date, stored.employee.shift.endTime),
              stored.checkOut,
            );
          }
        }
      }

      // Build attendance issue description (HTML)
      const issues = [];

      if (!record.checkIn) {
        issues.push(
          "<li><strong style='color: #dc2626;'>⚠️ No check-in recorded</strong></li>",
        );
      } else if (record.checkInStatus === "LATE" && lateSeconds > 0) {
        issues.push(
          `<li><span style='color: #ea580c;'>Check-in was <strong>late by ${formatAttendanceDuration(lateSeconds)}</strong></span></li>`,
        );
      }

      if (!record.checkOut) {
        issues.push(
          "<li><strong style='color: #dc2626;'>⚠️ No check-out recorded</strong></li>",
        );
      } else if (
        ["EARLY", "EARLY_OUT"].includes(record.checkOutStatus) &&
        earlyOutSeconds > 0
      ) {
        issues.push(
          `<li><span style='color: #ea580c;'>Check-out was <strong>early by ${formatAttendanceDuration(earlyOutSeconds)}</strong></span></li>`,
        );
      }

      if (record.status === "ABSENT") {
        issues.push(
          "<li><strong style='color: #dc2626;'>You were marked as ABSENT</strong></li>",
        );
      }

      const issuesHtml =
        issues.length > 0
          ? `<ul style='list-style-type: none; padding-left: 0;'>${issues.join("")}</ul>`
          : "<p>There was an irregularity in your attendance.</p>";

      // Send email notification to employee
      const emailSubject = "Attendance Reason Required";
      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f97316; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; }
    .alert-box { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .details-box { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .details-box ul { margin: 10px 0; padding-left: 20px; }
    .details-box li { margin: 5px 0; }
    ul li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">⚠️ Attendance Reason Required</h2>
    </div>
    
    <div class="content">
      <p>Dear <strong>${record.employeeName || record.employee?.name}</strong>,</p>
      
      <p>We noticed attendance irregularities for your record on <strong>${record.date}</strong>.</p>
      
      <div class="alert-box">
        <h3 style="margin-top: 0; color: #92400e;">📋 Issues Found:</h3>
        ${issuesHtml}
      </div>
      
      <div class="details-box">
        <h3 style="margin-top: 0; color: #374151;">📊 Attendance Details:</h3>
        <ul>
          <li><strong>Date:</strong> ${record.date}</li>
          ${record.checkIn ? `<li><strong>Check-In:</strong> ${record.checkIn} <span style='color: ${record.checkInStatus === "LATE" ? "#ea580c" : "#059669"};'>(${record.checkInStatus || "N/A"})</span></li>` : '<li><strong>Check-In:</strong> <span style="color: #dc2626;">Not recorded</span></li>'}
          ${record.checkOut ? `<li><strong>Check-Out:</strong> ${record.checkOut} <span style='color: ${record.checkOutStatus === "EARLY_OUT" ? "#ea580c" : "#059669"};'>(${record.checkOutStatus || "N/A"})</span></li>` : '<li><strong>Check-Out:</strong> <span style="color: #dc2626;">Not recorded</span></li>'}
          ${record.workingHours ? `<li><strong>Working Hours:</strong> ${record.workingHours}</li>` : ""}
        </ul>
      </div>
      
      <p><strong>Please provide a reason for your attendance record by logging into the HRMS portal.</strong></p>
      
      <p>Thank you for your cooperation.</p>
    </div>
    
    <div class="footer">
      <p style="margin: 0;"><strong>Best regards,</strong><br/>HR Department</p>
      <p style="margin: 10px 0 0 0; font-size: 12px;">This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>`;

      await EmailService.sendEmail(employeeEmail, emailSubject, emailBody);

      res.json({
        success: true,
        message: "Reason request sent successfully",
        data: {
          record,
          sentAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error requesting attendance reason:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send reason request",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async exportAttendanceExcel(req: Request, res: Response) {
    try {
      const {
        startDate,
        endDate,
        companyId,
        departmentIds,
        arrivalStatuses,
        search,
        includeSummary = "true",
        includeReasons = "true",
        includeZktecoLogs = "false",
        includeWfh = "true",
        includeUnmarked = "true",
      } = req.query;

      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;
      const selectedCompanyId = String(companyId || "").trim();

      const selectedCompany = selectedCompanyId
        ? await prisma.company.findUnique({
            where: { id: selectedCompanyId },
            select: { id: true, name: true },
          })
        : null;

      if (selectedCompanyId && !selectedCompany) {
        return res.status(400).json({
          success: false,
          message: "Selected company was not found",
        });
      }

      const companyLabel = selectedCompany?.name || "All Companies";

      const departmentIdList = departmentIds
        ? String(departmentIds).split(",").filter(Boolean)
        : [];

      const arrivalStatusList = arrivalStatuses
        ? String(arrivalStatuses).split(",").filter(Boolean)
        : [];

      const fromDate = String(startDate);
      const toDate = String(endDate || startDate);

      const start = new Date(`${fromDate}T00:00:00.000Z`);
      const end = new Date(`${toDate}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);

      const canViewAllRecords = ["ADMIN", "HR", "SUPERADMIN"].includes(
        currentUser.role,
      );

      const where: any = {
        date: {
          gte: start,
          lt: end,
        },
      };

      if (canViewAllRecords) {
        where.employee = {
          employeeId: {
            not: null,
          },
          isActive: true,
        };

        if (departmentIdList.length) {
          where.employee.departmentId = {
            in: departmentIdList,
          };
        }

        if (selectedCompanyId) {
          where.employee.companyMemberships = {
            some: { companyId: selectedCompanyId },
          };
        }

        if (search) {
          const searchValue = String(search).trim();

          where.employee.OR = [
            { firstName: { contains: searchValue } },
            { lastName: { contains: searchValue } },
            { email: { contains: searchValue } },
            { employeeId: { contains: searchValue } },
          ];
        }
      } else {
        where.employeeId = currentUser.id;

        if (selectedCompanyId) {
          where.employee = {
            companyMemberships: {
              some: { companyId: selectedCompanyId },
            },
          };
        }
      }

      const workbook = new ExcelJS.Workbook();

      workbook.creator = "HRMS Portal";
      workbook.created = new Date();
      workbook.modified = new Date();

      const formatStatus = (value: any) => {
        if (!value) return "N/A";

        const valStr = String(value).toUpperCase();

        switch (valStr) {
          case "FULL_DAY_LEAVE":
            return "Leave";
          case "HALF_DAY_LEAVE":
          case "HALF_DAY":
            return "Half Day Leave";
          case "LATE":
            return "Late";
          case "EARLY_OUT":
            return "Early Out";
          case "ON_TIME_ARRIVAL":
          case "ON_TIME_LEAVE":
          case "PRESENT":
            return "On Time";
          case "ABSENT":
            return "Absent";
          case "WORK_FROM_HOME":
          case "WFH":
            return "Work From Home";
          default:
            return String(value)
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (char) => char.toUpperCase());
        }
      };

      const formatDate = (value: Date | string | null | undefined) => {
        if (!value) return "N/A";

        const date = value instanceof Date ? value : new Date(value);

        if (Number.isNaN(date.getTime())) {
          return "N/A";
        }

        return date.toLocaleDateString("en-GB", {
          timeZone: "UTC",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      };

      const formatTime = (value: Date | string | null | undefined) => {
        if (!value) return "N/A";

        const date = value instanceof Date ? value : new Date(value);

        if (Number.isNaN(date.getTime())) {
          return "N/A";
        }

        /*
         * The attendance DATETIME values are already stored as Pakistan
         * local wall-clock times, but Prisma interprets them as UTC.
         *
         * Formatting with UTC prevents another +5-hour conversion and
         * preserves the exact time shown in the database.
         */
        return date.toLocaleString("en-GB", {
          timeZone: "UTC",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
      };

      const getDepartmentName = (record: any) => {
        return (
          record.employee?.departmentEntity?.name ||
          record.employee?.department?.name ||
          record.employee?.department ||
          "N/A"
        );
      };

      const getCompanyNames = (record: any) => {
        if (selectedCompany) return selectedCompany.name;

        const names = (record.employee?.companyMemberships || [])
          .map((membership: any) => membership.company?.name)
          .filter(Boolean);

        return names.length ? names.join(", ") : "N/A";
      };


      const normalizeStatusGroup = (record: any) => {
        const status = String(record.status || "").toUpperCase();
        const checkInStatus = String(record.checkInStatus || "").toUpperCase();
        const checkOutStatus = String(
          record.checkOutStatus || "",
        ).toUpperCase();

        if (
          status.includes("WORK_FROM_HOME") ||
          status.includes("WFH") ||
          checkInStatus.includes("WORK_FROM_HOME") ||
          checkInStatus.includes("WFH") ||
          checkOutStatus.includes("WORK_FROM_HOME") ||
          checkOutStatus.includes("WFH")
        ) {
          return "WORK_FROM_HOME";
        }

        if (
          status.includes("HALF_DAY") ||
          checkInStatus.includes("HALF_DAY") ||
          checkOutStatus.includes("HALF_DAY")
        ) {
          return "HALF_DAY_ARRIVAL";
        }

        if (status.includes("LATE") || checkInStatus.includes("LATE")) {
          return "LATE_ARRIVAL";
        }

        if (
          status.includes("EARLY_OUT") ||
          checkOutStatus.includes("EARLY_OUT")
        ) {
          return "EARLY_OUT";
        }

        if (
          status.includes("PRESENT") ||
          status.includes("ON_TIME") ||
          checkInStatus.includes("ON_TIME")
        ) {
          return "ON_TIME";
        }

        return status || "UNKNOWN";
      };

      const applyTitleRow = (
        worksheet: ExcelJS.Worksheet,
        title: string,
        subtitle: string,
        totalColumns: number,
      ) => {
        worksheet.spliceRows(1, 0, [title]);
        worksheet.spliceRows(2, 0, [subtitle]);
        worksheet.spliceRows(3, 0, []);

        worksheet.mergeCells(1, 1, 1, totalColumns);
        worksheet.mergeCells(2, 1, 2, totalColumns);

        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 23;
        worksheet.getRow(3).height = 6;

        const titleCell = worksheet.getCell(1, 1);
        titleCell.font = {
          bold: true,
          size: 16,
          color: { argb: "FFFFFFFF" },
        };
        titleCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F172A" },
        };
        titleCell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };

        const subtitleCell = worksheet.getCell(2, 1);
        subtitleCell.font = {
          bold: true,
          size: 10,
          color: { argb: "FF1E3A8A" },
        };
        subtitleCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDBEAFE" },
        };
        subtitleCell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      };

      const applyHeaderStyle = (
        worksheet: ExcelJS.Worksheet,
        headerRowNumber = 1,
      ) => {
        const headerRow = worksheet.getRow(headerRowNumber);

        headerRow.height = 26;

        headerRow.eachCell((cell) => {
          cell.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
            size: 10,
          };

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1E40AF" },
          };

          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };

          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
      };

      const applyBodyStyle = (
        worksheet: ExcelJS.Worksheet,
        startRowNumber = 2,
      ) => {
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber < startRowNumber) return;

          row.height = 23;

          row.eachCell((cell) => {
            cell.font = {
              size: 10,
              color: { argb: "FF0F172A" },
            };

            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              wrapText: true,
            };

            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };

            if (rowNumber % 2 === 0) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8FAFC" },
              };
            }
          });
        });
      };

      const applySheetSettings = (
        worksheet: ExcelJS.Worksheet,
        headerRowNumber = 1,
      ) => {
        worksheet.views = [
          {
            state: "frozen",
            ySplit: headerRowNumber,
          },
        ];

        worksheet.autoFilter = {
          from: {
            row: headerRowNumber,
            column: 1,
          },
          to: {
            row: headerRowNumber,
            column: worksheet.columnCount,
          },
        };
      };

      const styleStatusCell = (cell: ExcelJS.Cell, value: any) => {
        const status = String(value || "").toUpperCase();

        let bgColor = "FFE5E7EB";
        let textColor = "FF374151";

        if (status.includes("ON TIME") || status.includes("PRESENT")) {
          bgColor = "FFD1FAE5";
          textColor = "FF065F46";
        }

        if (status.includes("LATE") || status.includes("HALF DAY")) {
          bgColor = "FFFEF3C7";
          textColor = "FF92400E";
        }

        if (status === "LEAVE" || status.includes("FULL DAY")) {
          bgColor = "FFFEF3C7";
          textColor = "FF92400E";
        }

        if (status.includes("EARLY OUT")) {
          bgColor = "FFFFEDD5";
          textColor = "FFC2410C";
        }

        if (status.includes("WORK FROM HOME") || status.includes("WFH")) {
          bgColor = "FFDBEAFE";
          textColor = "FF1E40AF";
        }

        if (status.includes("ABSENT")) {
          bgColor = "FFFEE2E2";
          textColor = "FF991B1B";
        }

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };

        cell.font = {
          bold: true,
          color: { argb: textColor },
          size: 10,
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
      };

      const styleNumberAlertCell = (
        cell: ExcelJS.Cell,
        value: number,
        type: "late" | "early",
      ) => {
        if (!value || value <= 0) return;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: type === "late" ? "FFFEE2E2" : "FFFFEDD5",
          },
        };

        cell.font = {
          bold: true,
          color: {
            argb: type === "late" ? "FFDC2626" : "FFC2410C",
          },
          size: 10,
        };
      };

      const styleMetricSheet = (
        worksheet: ExcelJS.Worksheet,
        startRowNumber = 5,
      ) => {
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber < startRowNumber) return;

          const metricCell = row.getCell(1);
          const valueCell = row.getCell(2);

          metricCell.font = {
            bold: true,
            color: { argb: "FF334155" },
            size: 10,
          };

          valueCell.font = {
            bold: true,
            color: { argb: "FF0F172A" },
            size: 10,
          };

          metricCell.alignment = { vertical: "middle", horizontal: "left" };
          valueCell.alignment = { vertical: "middle", horizontal: "left" };
        });
      };

      const attendanceSheet = workbook.addWorksheet("Attendance Records");

      attendanceSheet.columns = [
        { header: "Employee ID", key: "employeeId", width: 15 },
        { header: "Employee Name", key: "employeeName", width: 25 },
        { header: "Company", key: "company", width: 24 },
        { header: "Email", key: "email", width: 30 },
        { header: "Department", key: "department", width: 22 },
        { header: "Date", key: "date", width: 15 },
        { header: "Check In", key: "checkIn", width: 22 },
        { header: "Check In Status", key: "checkInStatus", width: 20 },
        { header: "Check Out", key: "checkOut", width: 22 },
        { header: "Check Out Status", key: "checkOutStatus", width: 20 },
        { header: "Status", key: "status", width: 18 },
        { header: "Late Minutes", key: "lateMinutes", width: 15 },
        { header: "Early Out Minutes", key: "earlyOutMinutes", width: 18 },
        { header: "Working Hours", key: "workingHours", width: 18 },
        { header: "Shift", key: "shift", width: 18 },
        ...(includeReasons === "true"
          ? [{ header: "Reason", key: "reason", width: 45 }]
          : []),
      ];

      let totalRecords = 0;
      let skip = 0;
      const take = 1000;

      const summary = {
        onTime: 0,
        lateArrival: 0,
        halfDayArrival: 0,
        earlyOut: 0,
        workFromHome: 0,
        absent: 0,
      };

      const zktecoLogRows: any[] = [];

      while (true) {
        const records = await prisma.attendance.findMany({
          where,
          select: {
            id: true,
            date: true,
            checkIn: true,
            checkOut: true,
            status: true,
            reason: true,
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
                companyMemberships: {
                  select: {
                    company: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                departmentEntity: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                shift: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            zktecoRecords: {
              select: {
                timestamp: true,
                checkType: true,
                overallStatus: true,
              },
              orderBy: {
                timestamp: "asc",
              },
            },
          },
          orderBy: {
            date: "asc",
          },
          skip,
          take,
        });

        if (!records.length) break;

        for (const record of records) {
          const checkInRecord = record.zktecoRecords.find(
            (item: any) => item.checkType === "check_in",
          );

          const checkOutRecord = record.zktecoRecords.find(
            (item: any) => item.checkType === "check_out",
          );

          const transformedRecord: any = {
            ...record,
            checkInStatus: checkInRecord?.overallStatus || null,
            checkOutStatus: checkOutRecord?.overallStatus || null,
          };

          const statusGroup = normalizeStatusGroup(transformedRecord);

          if (
            arrivalStatusList.length &&
            !arrivalStatusList.includes(statusGroup)
          ) {
            continue;
          }

          if (includeWfh !== "true" && statusGroup === "WORK_FROM_HOME") {
            continue;
          }

          if (statusGroup === "ON_TIME") summary.onTime++;
          else if (statusGroup === "LATE_ARRIVAL") summary.lateArrival++;
          else if (statusGroup === "HALF_DAY_ARRIVAL") summary.halfDayArrival++;
          else if (statusGroup === "EARLY_OUT") summary.earlyOut++;
          else if (statusGroup === "WORK_FROM_HOME") summary.workFromHome++;
          else if (
            String(record.status || "")
              .toUpperCase()
              .includes("ABSENT")
          ) {
            summary.absent++;
          }

          totalRecords++;

          attendanceSheet.addRow({
            employeeId: record.employee?.employeeId || "N/A",
            employeeName:
              `${record.employee?.firstName || ""} ${record.employee?.lastName || ""}`.trim() ||
              "N/A",
            company: getCompanyNames(record),
            email: record.employee?.email || "N/A",
            department: getDepartmentName(record),
            date: formatDate(record.date),
            checkIn: formatTime(record.checkIn),
            checkInStatus: formatStatus(transformedRecord.checkInStatus),
            checkOut: formatTime(record.checkOut),
            checkOutStatus: formatStatus(transformedRecord.checkOutStatus),
            status: formatStatus(record.status),
            lateMinutes: 0,
            earlyOutMinutes: 0,
            workingHours: "N/A",
            shift: record.employee?.shift?.name || "No Shift",
            ...(includeReasons === "true"
              ? { reason: record.reason || "N/A" }
              : {}),
          });

          if (includeZktecoLogs === "true") {
            record.zktecoRecords.forEach((log: any) => {
              zktecoLogRows.push({
                employeeId: record.employee?.employeeId || "N/A",
                employeeName:
                  `${record.employee?.firstName || ""} ${record.employee?.lastName || ""}`.trim() ||
                  "N/A",
                company: getCompanyNames(record),
                department: getDepartmentName(record),
                date: formatDate(record.date),
                timestamp: formatTime(log.timestamp),
                checkType: formatStatus(log.checkType),
                status: formatStatus(log.overallStatus),
              });
            });
          }
        }

        skip += take;
      }

      applyTitleRow(
        attendanceSheet,
        "Attendance Report",
        `${companyLabel} | From ${fromDate} to ${toDate} | Generated At: ${new Date().toLocaleString()}`,
        attendanceSheet.columnCount,
      );

      applyHeaderStyle(attendanceSheet, 4);
      applyBodyStyle(attendanceSheet, 5);
      applySheetSettings(attendanceSheet, 4);

      ["checkInStatus", "checkOutStatus", "status"].forEach((columnKey) => {
        attendanceSheet.getColumn(columnKey).eachCell((cell, rowNumber) => {
          if (rowNumber <= 4) return;
          styleStatusCell(cell, cell.value);
        });
      });

      attendanceSheet.getColumn("lateMinutes").eachCell((cell, rowNumber) => {
        if (rowNumber <= 4) return;
        styleNumberAlertCell(cell, Number(cell.value || 0), "late");
      });

      attendanceSheet
        .getColumn("earlyOutMinutes")
        .eachCell((cell, rowNumber) => {
          if (rowNumber <= 4) return;
          styleNumberAlertCell(cell, Number(cell.value || 0), "early");
        });

      if (includeSummary === "true") {
        const summarySheet = workbook.addWorksheet("Summary");

        summarySheet.columns = [
          { header: "Metric", key: "metric", width: 28 },
          { header: "Value", key: "value", width: 45 },
        ];

        summarySheet.addRows([
          { metric: "Start Date", value: fromDate },
          { metric: "End Date", value: toDate },
          { metric: "Company", value: companyLabel },
          { metric: "Total Records", value: totalRecords },
          { metric: "On Time", value: summary.onTime },
          { metric: "Late Arrival", value: summary.lateArrival },
          { metric: "Half Day Arrival", value: summary.halfDayArrival },
          { metric: "Early Out", value: summary.earlyOut },
          { metric: "Work From Home", value: summary.workFromHome },
          { metric: "Absent", value: summary.absent },
          {
            metric: "Department Filter",
            value: departmentIdList.length
              ? `${departmentIdList.length} department(s) selected`
              : "All Departments",
          },
          {
            metric: "Status Filter",
            value: arrivalStatusList.length
              ? arrivalStatusList.map(formatStatus).join(", ")
              : "All Statuses",
          },
          { metric: "Search Filter", value: search || "None" },
          { metric: "Generated By", value: currentUser.email || "System" },
          { metric: "Generated At", value: new Date().toLocaleString() },
        ]);

        applyTitleRow(
          summarySheet,
          "Attendance Summary",
          `${companyLabel} | From ${fromDate} to ${toDate}`,
          summarySheet.columnCount,
        );

        applyHeaderStyle(summarySheet, 4);
        applyBodyStyle(summarySheet, 5);
        applySheetSettings(summarySheet, 4);
        styleMetricSheet(summarySheet, 5);
      }

      if (includeZktecoLogs === "true" && zktecoLogRows.length) {
        const logsSheet = workbook.addWorksheet("ZKTeco Logs");

        logsSheet.columns = [
          { header: "Employee ID", key: "employeeId", width: 15 },
          { header: "Employee Name", key: "employeeName", width: 25 },
          { header: "Company", key: "company", width: 24 },
          { header: "Department", key: "department", width: 22 },
          { header: "Date", key: "date", width: 15 },
          { header: "Timestamp", key: "timestamp", width: 24 },
          { header: "Check Type", key: "checkType", width: 18 },
          { header: "Status", key: "status", width: 22 },
        ];

        logsSheet.addRows(zktecoLogRows);

        applyTitleRow(
          logsSheet,
          "ZKTeco Attendance Logs",
          `${companyLabel} | From ${fromDate} to ${toDate}`,
          logsSheet.columnCount,
        );

        applyHeaderStyle(logsSheet, 4);
        applyBodyStyle(logsSheet, 5);
        applySheetSettings(logsSheet, 4);

        logsSheet.getColumn("status").eachCell((cell, rowNumber) => {
          if (rowNumber <= 4) return;
          styleStatusCell(cell, cell.value);
        });
      }

      if (includeUnmarked === "true") {
        const unmarkedSheet = workbook.addWorksheet("Missing Attendance");

        // Calculate off days and dates list
        const dbOffDays = await prisma.offDay.findMany({
          where: {
            date: {
              gte: new Date(`${fromDate}T00:00:00.000Z`),
              lte: new Date(`${toDate}T23:59:59.999Z`),
            },
          },
        });

        const offDaysMap = new Map<string, string>();
        dbOffDays.forEach((od) => {
          if (od.date) {
            const dStr = new Date(od.date).toISOString().split("T")[0];
            offDaysMap.set(dStr, od.reason || "Official Off Day");
          }
        });

        const dayNamesMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const datesList: string[] = [];
        const curDate = new Date(`${fromDate}T00:00:00.000Z`);
        const endDateObj = new Date(`${toDate}T00:00:00.000Z`);

        const diffTime = Math.abs(endDateObj.getTime() - curDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const maxDays = Math.min(diffDays, 31);

        for (let i = 0; i < maxDays; i++) {
          const dStr = curDate.toISOString().split("T")[0];
          const dayOfWeek = curDate.getUTCDay();

          if (dayOfWeek !== 0 && !offDaysMap.has(dStr)) {
            datesList.push(dStr);
          }
          curDate.setUTCDate(curDate.getUTCDate() + 1);
        }

        if (datesList.length > 0) {
          const overallStart = new Date(`${datesList[0]}T00:00:00.000Z`);
          const overallEnd = new Date(`${datesList[datesList.length - 1]}T00:00:00.000Z`);
          overallEnd.setUTCDate(overallEnd.getUTCDate() + 1);

          const userWhere: any = {
            isActive: true,
            employeeId: { not: null },
          };

          if (departmentIdList.length) {
            userWhere.departmentId = { in: departmentIdList };
          }

          if (selectedCompanyId) {
            userWhere.companyMemberships = {
              some: { companyId: selectedCompanyId },
            };
          }

          if (search) {
            const searchValue = String(search).trim();
            userWhere.OR = [
              { firstName: { contains: searchValue } },
              { lastName: { contains: searchValue } },
              { email: { contains: searchValue } },
              { employeeId: { contains: searchValue } },
            ];
          }

          const activeEmpList = await prisma.user.findMany({
            where: userWhere,
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              departmentEntity: {
                select: {
                  id: true,
                  name: true,
                },
              },
              companyMemberships: {
                select: {
                  company: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              designation: true,
              role: true,
              userRank: true,
              status: true,
            },
            orderBy: { firstName: "asc" },
          });


          const filteredActiveEmpList = activeEmpList.filter((emp) => {
            if ((emp as any).role === "SUPER_ADMIN" || (emp as any).userRank === "SUPER_ADMIN") return false;
            if ((emp as any).status === "INACTIVE" || (emp as any).isActive === false) return false;
            const empId = String(emp.employeeId || "").trim();
            if (!empId || empId === "—" || empId === "null" || empId === "undefined" || empId.startsWith("-")) return false;
            return true;
          });

          const markedAtt = await prisma.attendance.findMany({
            where: {
              date: { gte: overallStart, lt: overallEnd },
            },
            select: { employeeId: true, date: true },
          });

          const stagingAtt = await prisma.zKTecoAttendanceStaging.findMany({
            where: {
              timestamp: { gte: overallStart, lt: overallEnd },
              userId: { not: null },
            },
            select: { userId: true, timestamp: true },
          });

          const appLeaves = await prisma.leaveRequest.findMany({
            where: {
              status: "APPROVED",
              startDate: { lte: overallEnd },
              endDate: { gte: overallStart },
            },
            select: { employeeId: true, startDate: true, endDate: true },
          });

          const markedSet = new Set<string>();
          markedAtt.forEach((a) => {
            if (a.employeeId && a.date) {
              const dStr = new Date(a.date).toISOString().split("T")[0];
              markedSet.add(`${a.employeeId}_${dStr}`);
            }
          });
          stagingAtt.forEach((s) => {
            if (s.userId && s.timestamp) {
              const dStr = new Date(s.timestamp).toISOString().split("T")[0];
              markedSet.add(`${s.userId}_${dStr}`);
            }
          });

          const unmarkedExportRows: any[] = [];
          const sortedDates = [...datesList].reverse();

          for (const dStr of sortedDates) {
            const dStart = new Date(`${dStr}T00:00:00.000Z`);
            const dEnd = new Date(`${dStr}T00:00:00.000Z`);
            dEnd.setUTCDate(dEnd.getUTCDate() + 1);

            const dayName = dayNamesMap[dStart.getUTCDay()];

            for (const emp of filteredActiveEmpList) {
              const key = `${emp.id}_${dStr}`;
              if (!markedSet.has(key)) {
                const leave = appLeaves.find(
                  (l) =>
                    l.employeeId === emp.id &&
                    new Date(l.startDate) <= dEnd &&
                    new Date(l.endDate) >= dStart,
                );

                unmarkedExportRows.push({
                  dayName,
                  date: dStr,
                  employeeId: emp.employeeId || "—",
                  employeeName: `${emp.firstName} ${emp.lastName}`,
                  company: selectedCompany?.name ||
                    emp.companyMemberships
                      .map((membership: any) => membership.company.name)
                      .join(", ") ||
                    "—",
                  email: emp.email || "—",
                  department: (emp as any).departmentEntity?.name || (typeof emp.department === "string" ? emp.department : (emp.department as any)?.name) || "—",
                  designation: getDesignationName(emp),
                  status: leave ? "On Approved Leave" : "Unmarked / Missing",
                });
              }
            }
          }

          unmarkedSheet.columns = [
            { header: "Day", key: "dayName", width: 15 },
            { header: "Date", key: "date", width: 15 },
            { header: "Employee ID", key: "employeeId", width: 15 },
            { header: "Employee Name", key: "employeeName", width: 25 },
            { header: "Company", key: "company", width: 24 },
            { header: "Email", key: "email", width: 28 },
            { header: "Department", key: "department", width: 22 },
            { header: "Designation", key: "designation", width: 22 },
            { header: "Status", key: "status", width: 24 },
          ];

          unmarkedSheet.addRows(unmarkedExportRows);

          applyTitleRow(
            unmarkedSheet,
            "Missing / Unmarked Attendance Report",
            `${companyLabel} | From ${fromDate} to ${toDate}`,
            unmarkedSheet.columnCount,
          );

          applyHeaderStyle(unmarkedSheet, 4);
          applyBodyStyle(unmarkedSheet, 5);
          applySheetSettings(unmarkedSheet, 4);
        }
      }

      const companyFilenamePart = companyLabel
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const filename = `Attendance_Report_${companyFilenamePart}_${fromDate}_to_${toDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error exporting attendance report:", error);

      res.status(500).json({
        success: false,
        message: "Failed to export attendance report",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getUnmarkedAttendance(req: Request, res: Response) {
    try {
      const { startDate, endDate, date, companyId, departmentId, search } = req.query;

      const pageNumber = Number(req.query.page) || 1;
      const limitNumber = req.query.limit ? Number(req.query.limit) : 5000;
      const skip = (pageNumber - 1) * limitNumber;
      const take = limitNumber;

      const getPakistanToday = () => {
        return new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Karachi",
        });
      };

      const todayStr = getPakistanToday();
      let startStr = (startDate as string) || (date as string) || todayStr;
      let endStr = (endDate as string) || (date as string) || startStr;

      if (startStr > endStr) {
        const temp = startStr;
        startStr = endStr;
        endStr = temp;
      }

      // Fetch registered off days from database
      const dbOffDays = await prisma.offDay.findMany({
        where: {
          date: {
            gte: new Date(`${startStr}T00:00:00.000Z`),
            lte: new Date(`${endStr}T23:59:59.999Z`),
          },
        },
      });

      const offDaysMap = new Map<string, string>();
      dbOffDays.forEach((od) => {
        if (od.date) {
          const dStr = new Date(od.date).toISOString().split("T")[0];
          offDaysMap.set(dStr, od.reason || "Official Off Day");
        }
      });

      const dayNamesMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const datesList: string[] = [];
      const cur = new Date(`${startStr}T00:00:00.000Z`);
      const end = new Date(`${endStr}T00:00:00.000Z`);

      const diffTime = Math.abs(end.getTime() - cur.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const maxDays = Math.min(diffDays, 31);

      let totalOffDaysCount = 0;

      for (let i = 0; i < maxDays; i++) {
        const dStr = cur.toISOString().split("T")[0];
        const dayOfWeek = cur.getUTCDay();

        if (dayOfWeek === 0) {
          // Sunday is an off day by default
          totalOffDaysCount++;
        } else if (offDaysMap.has(dStr)) {
          // Off day explicitly registered in database (Saturdays off, Holidays, etc.)
          totalOffDaysCount++;
        } else {
          // Valid working day (Working Saturday or Weekday)
          datesList.push(dStr);
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      if (datesList.length === 0) {
        return res.status(200).json({
          success: true,
          summary: {
            startDate: startStr,
            endDate: endStr,
            daysCount: 0,
            totalActiveEmployees: 0,
            uniqueUnmarkedEmployees: 0,
            markedCount: 0,
            unmarkedCount: 0,
            onLeaveCount: 0,
            unmarkedPercentage: 0,
          },
          pagination: { total: 0, page: 1, limit: limitNumber, totalPages: 1 },
          data: [],
        });
      }

      const overallStart = new Date(`${datesList[0]}T00:00:00.000Z`);
      const overallEnd = new Date(`${datesList[datesList.length - 1]}T00:00:00.000Z`);
      overallEnd.setUTCDate(overallEnd.getUTCDate() + 1);

      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;
      const { scope } = req.query;

      const isPrivileged = ["ADMIN", "HR", "SUPERADMIN"].includes(currentUser?.role);
      const isLineManager =
        currentUser?.role === "MANAGER" ||
        currentUser?.userRank === "LINE_MANAGER" ||
        currentUser?.userRank === "MANAGER";

      const userWhere: any = {
        isActive: true,
        employeeId: { not: null },
      };

      if (scope === "personal") {
        userWhere.id = currentUser?.id;
      } else if (scope === "team") {
        const unmarkMgrEmail = (currentUser?.email || "").toLowerCase().trim();
        const unmarkMgrId = currentUser?.id;
        const subordinates = await prisma.user.findMany({
          where: {
            isActive: true,
            id: { not: unmarkMgrId },
            OR: [
              { manager: { equals: unmarkMgrEmail } },
              { manager: { contains: unmarkMgrEmail } },
              { manager: { equals: unmarkMgrId } },
            ],
          },
          select: { id: true },
        });
        const subIds = subordinates.map((s) => s.id);
        if (subIds.length === 0) {
          userWhere.id = "__NO_SUBORDINATES__";
        } else {
          userWhere.id = { in: subIds };
        }
      } else if (isPrivileged && (scope === "company" || !scope)) {
        // Company-wide for HR/Admin
      } else {
        userWhere.id = currentUser?.id;
      }

      if (departmentId) {
        userWhere.departmentId = departmentId as string;
      }

      if (companyId) {
        userWhere.companyMemberships = {
          some: { companyId: companyId as string },
        };
      }

      if (search) {
        const searchValue = String(search).trim();
        userWhere.OR = [
          { firstName: { contains: searchValue } },
          { lastName: { contains: searchValue } },
          { email: { contains: searchValue } },
          { employeeId: { contains: searchValue } },
          { position: { contains: searchValue } },
          { department: { contains: searchValue } },
        ];
      }


      const rawActiveEmployees = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          departmentEntity: {
            select: {
              id: true,
              name: true,
            },
          },
          companyMemberships: {
            select: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          designation: true,
          position: true,
          userRank: true,
          role: true,
          phone: true,
          profilePicture: true,
          departmentId: true,
          status: true,
        },
        orderBy: { firstName: "asc" },
      });

      const allActiveEmployees = rawActiveEmployees.filter((emp) => {
        if ((emp as any).role === "SUPER_ADMIN" || (emp as any).userRank === "SUPER_ADMIN") return false;
        if ((emp as any).status === "INACTIVE" || (emp as any).isActive === false) return false;
        const empId = String(emp.employeeId || "").trim();
        if (!empId || empId === "—" || empId === "null" || empId === "undefined" || empId.startsWith("-")) return false;
        return true;
      });

      const markedAttendances = await prisma.attendance.findMany({
        where: {
          date: {
            gte: overallStart,
            lt: overallEnd,
          },
        },
        select: { employeeId: true, date: true },
      });

      const stagingPunches = await prisma.zKTecoAttendanceStaging.findMany({
        where: {
          timestamp: {
            gte: overallStart,
            lt: overallEnd,
          },
          userId: { not: null },
        },
        select: { userId: true, timestamp: true },
      });

      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: overallEnd },
          endDate: { gte: overallStart },
        },
        select: {
          employeeId: true,
          leaveType: true,
          reason: true,
          startDate: true,
          endDate: true,
        },
      });

      const markedSet = new Set<string>();
      markedAttendances.forEach((a) => {
        if (a.employeeId && a.date) {
          const dStr = new Date(a.date).toISOString().split("T")[0];
          markedSet.add(`${a.employeeId}_${dStr}`);
        }
      });
      stagingPunches.forEach((s) => {
        if (s.userId && s.timestamp) {
          const dStr = new Date(s.timestamp).toISOString().split("T")[0];
          markedSet.add(`${s.userId}_${dStr}`);
        }
      });

      const unmarkedRecordsList: any[] = [];
      let totalMarkedCount = 0;
      let totalUnmarkedCount = 0;
      let totalOnLeaveCount = 0;
      const uniqueUnmarkedUserIds = new Set<string>();

      const sortedDates = [...datesList].reverse();

      for (const dStr of sortedDates) {
        const dStart = new Date(`${dStr}T00:00:00.000Z`);
        const dEnd = new Date(`${dStr}T00:00:00.000Z`);
        dEnd.setUTCDate(dEnd.getUTCDate() + 1);

        const dayOfWeekName = dayNamesMap[dStart.getUTCDay()];

        for (const emp of allActiveEmployees) {
          const key = `${emp.id}_${dStr}`;
          if (markedSet.has(key)) {
            totalMarkedCount++;
          } else {
            const leave = approvedLeaves.find(
              (l) =>
                l.employeeId === emp.id &&
                new Date(l.startDate) <= dEnd &&
                new Date(l.endDate) >= dStart,
            );

            if (leave) {
              totalOnLeaveCount++;
            } else {
              totalUnmarkedCount++;
            }

            uniqueUnmarkedUserIds.add(emp.id);

            unmarkedRecordsList.push({
              id: key,
              userId: emp.id,
              employeeId: emp.employeeId,
              firstName: emp.firstName,
              lastName: emp.lastName,
              fullName: `${emp.firstName} ${emp.lastName}`,
              email: emp.email,
              department: emp.departmentEntity?.name || emp.department,
              companies: emp.companyMemberships.map(
                (membership) => membership.company,
              ),
              designation: getDesignationName(emp),
              position: emp.position,
              userRank: emp.userRank,
              phone: emp.phone,
              profilePicture: emp.profilePicture,
              date: dStr,
              dayName: dayOfWeekName,
              status: leave ? "ON_LEAVE" : "UNMARKED",
              leaveInfo: leave ? { leaveType: leave.leaveType, reason: leave.reason } : null,
            });
          }
        }
      }

      const totalActiveEmployees = allActiveEmployees.length;
      const totalPossibleEmployeeDays = totalActiveEmployees * datesList.length;
      const unmarkedPercentage = totalPossibleEmployeeDays > 0
        ? Math.round((totalUnmarkedCount / totalPossibleEmployeeDays) * 100)
        : 0;

      const paginatedUnmarkedRecords = unmarkedRecordsList.slice(skip, skip + take);

      return res.status(200).json({
        success: true,
        summary: {
          startDate: startStr,
          endDate: endStr,
          daysCount: datesList.length,
          offDaysCount: totalOffDaysCount,
          totalActiveEmployees,
          uniqueUnmarkedEmployees: uniqueUnmarkedUserIds.size,
          markedCount: totalMarkedCount,
          unmarkedCount: totalUnmarkedCount,
          onLeaveCount: totalOnLeaveCount,
          unmarkedPercentage,
        },
        pagination: {
          total: unmarkedRecordsList.length,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(unmarkedRecordsList.length / limitNumber) || 1,
        },
        data: paginatedUnmarkedRecords,
      });
    } catch (error: any) {
      console.error("Error fetching unmarked attendance report:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch unmarked attendance report",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async sendUnmarkedAttendanceReminders(req: Request, res: Response) {
    try {
      const { date, employeeIds, companyId } = req.body;

      const getPakistanToday = () => {
        return new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Karachi",
        });
      };

      const targetDateStr = date || getPakistanToday();
      const targetDateStart = new Date(`${targetDateStr}T00:00:00.000Z`);
      const targetDateEnd = new Date(`${targetDateStr}T00:00:00.000Z`);
      targetDateEnd.setUTCDate(targetDateEnd.getUTCDate() + 1);

      let targets: any[] = [];
      if (Array.isArray(employeeIds) && employeeIds.length > 0) {
        const extractedIds = employeeIds.map((item: string) => {
          let str = String(item).trim();
          if (str.startsWith("unmarked-")) {
            const parts = str.split("-");
            if (parts.length >= 2) str = parts[1];
          }
          return str.split("_")[0];
        });

        targets = await prisma.user.findMany({
          where: {
            OR: [
              { id: { in: extractedIds } },
              { employeeId: { in: extractedIds } },
            ],
            isActive: true,
            ...(companyId
              ? {
                  companyMemberships: {
                    some: { companyId: String(companyId) },
                  },
                }
              : {}),
          },
          select: { id: true, firstName: true, lastName: true, email: true, employeeId: true, role: true, userRank: true, status: true },
        });
      } else {
        const markedAttendances = await prisma.attendance.findMany({
          where: { date: { gte: targetDateStart, lt: targetDateEnd } },
          select: { employeeId: true },
        });
        const markedIds = new Set(markedAttendances.map((a) => a.employeeId));

        const stagingPunches = await prisma.zKTecoAttendanceStaging.findMany({
          where: {
            timestamp: { gte: targetDateStart, lt: targetDateEnd },
            userId: { not: null },
          },
          select: { userId: true },
        });
        stagingPunches.forEach((s) => {
          if (s.userId) markedIds.add(s.userId);
        });

        const appLeaves = await prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            startDate: { lte: targetDateEnd },
            endDate: { gte: targetDateStart },
          },
          select: { employeeId: true },
        });
        appLeaves.forEach((l) => {
          if (l.employeeId) markedIds.add(l.employeeId);
        });

        targets = await prisma.user.findMany({
          where: {
            isActive: true,
            employeeId: { not: null },
            id: { notIn: Array.from(markedIds) },
            ...(companyId
              ? {
                  companyMemberships: {
                    some: { companyId: String(companyId) },
                  },
                }
              : {}),
          },
          select: { id: true, firstName: true, lastName: true, email: true, employeeId: true, role: true, userRank: true, status: true },
        });
      }

      targets = targets.filter((emp: any) => {
        if ((emp as any).role === "SUPER_ADMIN" || (emp as any).userRank === "SUPER_ADMIN") return false;
        if ((emp as any).status === "INACTIVE" || (emp as any).isActive === false) return false;
        const empId = String(emp.employeeId || "").trim();
        if (!empId || empId === "—" || empId === "null" || empId === "undefined" || empId.startsWith("-")) return false;
        return true;
      });

      const eligibleEmployees = targets.filter((emp: any) => Boolean(emp.email));

      if (eligibleEmployees.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No unmarked employees with valid email addresses found to send reminders.",
          sentCount: 0,
        });
      }

      // ⚡ Respond immediately to prevent Axios 10000ms timeout in frontend
      res.status(200).json({
        success: true,
        message: `Attendance reminder dispatch initiated for ${eligibleEmployees.length} employee(s). Emails are being queued in the background.`,
        sentCount: eligibleEmployees.length,
      });

      // Execute email queueing / direct sending in background non-blocking task
      setImmediate(async () => {
        let sentCount = 0;
        for (const emp of eligibleEmployees) {
          const subject = `[REMINDER] Attendance Not Marked for ${targetDateStr}`;
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
              <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 20px; text-align: left;">
                <h2 style="margin: 0; font-size: 18px;">⚠️ Attendance Reminder</h2>
                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Iris HRMS Automated Notification</p>
              </div>
              <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                <p style="font-size: 14px; margin-top: 0;">Dear <strong>${emp.firstName} ${emp.lastName}</strong>,</p>
                <p>According to HR system records, you have not marked your attendance for today (<strong>${targetDateStr}</strong>).</p>
                <p>If you are present at work, please check in using the biometric machine or submit your check-in reason in Iris HRMS.</p>
                <p>If you are on leave or working remotely, please ensure your leave request is submitted.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #64748b;">Iris HRMS Management System</p>
              </div>
            </div>
          `;

          try {
            await EmailQueueService.enqueue("UNMARKED_ATTENDANCE_REMINDER", {
              to: emp.email,
              subject,
              html,
            });
            sentCount++;
          } catch (err: any) {
            console.error(`Failed to queue unmarked reminder to ${emp.email}, fallback to direct email:`, err);
            try {
              await EmailService.sendEmail(emp.email, subject, html);
              sentCount++;
            } catch (directErr: any) {
              console.error(`Failed to send direct email to ${emp.email}:`, directErr);
            }
          }
        }
        zktecoDebug(`✅ Background email reminders completed: ${sentCount}/${eligibleEmployees.length} queued/sent.`);
      });
    } catch (error: any) {
      console.error("Error sending unmarked attendance reminders:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send unmarked attendance reminders",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // SuperAdmin only: Edit attendance record (checkIn, checkOut, status, notes, reason)
  static async superAdminEditAttendance(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedReq = req as any;
      const currentUser = authenticatedReq.user;

      if (!currentUser || String(currentUser.role).toUpperCase() !== "SUPERADMIN") {
        res.status(403).json({
          success: false,
          message: "Access denied. Only Super Admin can edit attendance records directly.",
        });
        return;
      }

      const {
        id,
        employeeId,
        date,
        checkInTime,
        checkOutTime,
        status,
        notes,
        reason,
        totalHours,
      } = req.body;

      if (!employeeId && !id) {
        res.status(400).json({
          success: false,
          message: "Either employeeId or attendance record id is required.",
        });
        return;
      }

      // Find target user
      let targetUser: any = null;
      if (employeeId) {
        const empStr = String(employeeId).trim();
        targetUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: empStr },
              { employeeId: empStr },
              { email: empStr },
            ],
          },
        });
      }

      // If id is provided and not unmarked, try finding existing record
      let existingRecord: any = null;
      if (id && !String(id).startsWith("unmarked-")) {
        existingRecord = await prisma.attendance.findUnique({
          where: { id: String(id) },
          include: { employee: true },
        });
        if (existingRecord && !targetUser) {
          targetUser = existingRecord.employee;
        }
      }

      if (!targetUser) {
        res.status(404).json({
          success: false,
          message: "Target employee not found.",
        });
        return;
      }

      // Determine date
      const targetDateStr = date
        ? String(date).split("T")[0]
        : existingRecord
        ? existingRecord.date.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const dateOnly = new Date(`${targetDateStr}T00:00:00.000Z`);

      // If existingRecord wasn't found by id, look for it by (employeeId, date)
      if (!existingRecord) {
        existingRecord = await prisma.attendance.findFirst({
          where: {
            employeeId: targetUser.id,
            date: dateOnly,
          },
        });
      }

      // Parse checkIn and checkOut
      let parsedCheckIn: Date | null = null;
      if (checkInTime) {
        const checkInStr = String(checkInTime).trim();
        if (checkInStr.includes("T")) {
          parsedCheckIn = new Date(checkInStr);
        } else {
          const parts = checkInStr.split(":");
          const hh = (parts[0] || "00").padStart(2, "0");
          const mm = (parts[1] || "00").padStart(2, "0");
          const ss = (parts[2] || "00").padStart(2, "0");
          parsedCheckIn = new Date(`${targetDateStr}T${hh}:${mm}:${ss}.000Z`);
        }
      }

      let parsedCheckOut: Date | null = null;
      if (checkOutTime) {
        const checkOutStr = String(checkOutTime).trim();
        if (checkOutStr.includes("T")) {
          parsedCheckOut = new Date(checkOutStr);
        } else {
          const parts = checkOutStr.split(":");
          const hh = (parts[0] || "00").padStart(2, "0");
          const mm = (parts[1] || "00").padStart(2, "0");
          const ss = (parts[2] || "00").padStart(2, "0");
          parsedCheckOut = new Date(`${targetDateStr}T${hh}:${mm}:${ss}.000Z`);
        }
      }

      // Calculate working hours
      let calculatedHours: number | null = null;
      if (totalHours !== undefined && totalHours !== null && totalHours !== "") {
        calculatedHours = parseFloat(String(totalHours));
      } else if (parsedCheckIn && parsedCheckOut) {
        const diffMs = parsedCheckOut.getTime() - parsedCheckIn.getTime();
        calculatedHours = diffMs > 0 ? parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0;
      }

      // Determine status
      const validStatuses = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "WORK_FROM_HOME"];
      let finalStatus: any = "PRESENT";
      if (status && validStatuses.includes(String(status).toUpperCase())) {
        finalStatus = String(status).toUpperCase();
      } else if (parsedCheckIn) {
        finalStatus = "PRESENT";
      } else {
        finalStatus = "ABSENT";
      }

      const adminNote = notes !== undefined
        ? String(notes)
        : existingRecord?.notes || `Updated by SuperAdmin (${currentUser.email})`;

      const adminReason = reason !== undefined
        ? String(reason)
        : existingRecord?.reason || null;

      let resultRecord: any = null;

      if (existingRecord) {
        resultRecord = await prisma.attendance.update({
          where: { id: existingRecord.id },
          data: {
            checkIn: parsedCheckIn,
            checkOut: parsedCheckOut,
            status: finalStatus,
            notes: adminNote,
            reason: adminReason,
            totalHours: calculatedHours !== null ? calculatedHours : undefined,
            deviceCheckIns: parsedCheckIn ? (existingRecord.deviceCheckIns || 1) : 0,
            deviceCheckOuts: parsedCheckOut ? (existingRecord.deviceCheckOuts || 1) : 0,
            lastDeviceSync: new Date(),
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
          },
        });
      } else {
        resultRecord = await prisma.attendance.create({
          data: {
            employeeId: targetUser.id,
            date: dateOnly,
            checkIn: parsedCheckIn,
            checkOut: parsedCheckOut,
            status: finalStatus,
            notes: adminNote,
            reason: adminReason,
            totalHours: calculatedHours !== null ? calculatedHours : null,
            deviceCheckIns: parsedCheckIn ? 1 : 0,
            deviceCheckOuts: parsedCheckOut ? 1 : 0,
            lastDeviceSync: new Date(),
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
          },
        });
      }

      res.json({
        success: true,
        message: `Attendance for ${targetUser.firstName} ${targetUser.lastName} on ${targetDateStr} updated successfully`,
        data: resultRecord,
      });
    } catch (error: any) {
      console.error("Error in superAdminEditAttendance:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update attendance record",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
