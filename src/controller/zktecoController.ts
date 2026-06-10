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
        departmentId,
        page = 1,
        limit = 50,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

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

      if (canViewAllRecords) {
        // 🔓 PRIVILEGED ACCESS: Can see all records, optionally filtered by employeeId and/or department

        // Build employee filter if either employeeId or departmentId is specified
        if (employeeId || departmentId) {
          where.employee = {};

          if (employeeId) {
            where.employee.id = employeeId as string;
          }

          if (departmentId) {
            where.employee.departmentId = departmentId as string;
          }
        }

        console.log(
          `👥 Privileged User ${currentUser.email} (${currentUser.role}) viewing attendance records`,
        );
      } else {
        // 🔒 DEFAULT/EMPLOYEE ACCESS: STRICTLY restrict to own records
        // If user role is EMPLOYEE or any other unhandled role, they see ONLY their own data
        where.employeeId = currentUser.id;
        console.log(
          `👤 User ${currentUser.email} (${currentUser.role}) viewing their own attendance`,
        );
      }

      // 📅 DATE FILTERING: Apply date range if specified
      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = new Date(startDate as string); // Greater than or equal to start date
        }
        if (endDate) {
          where.date.lte = new Date(endDate as string); // Less than or equal to end date
        }
      }

      // 🔧 FUTURE ENHANCEMENT: Device filtering can be added here
      // If deviceId filter is needed, we can add a deviceId field to attendance records
      // For now, we'll get all attendance records

      // ✅ NO 3-DAY FILTER NEEDED!
      // Once data is in the attendance table, it's already been finalized
      // (either auto-finalized after 3 days OR force-finalized by SuperAdmin)
      // So we show ALL attendance records immediately!

      console.log("📊 Fetching attendance records (all finalized data)");
      console.log(`   User: ${currentUser.email} (${currentUser.role})`);
      console.log(`   Department Filter: ${departmentId || "none"}`);
      console.log(`   Employee Filter: ${employeeId || "none"}`);
      console.log(`   Where Clause:`, JSON.stringify(where, null, 2));

      const [attendanceRecords, total] = await Promise.all([
        prisma.attendance.findMany({
          where,
          select: {
            id: true,
            employeeId: true,
            date: true,
            checkIn: true,
            checkOut: true,
            status: true,
            notes: true,
            reason: true, // ✅ Explicitly select reason field
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
          skip,
          take,
        }),
        prisma.attendance.count({ where }),
      ]);

      // Helper function to calculate attendance status based on shift timing
      const calculateAttendanceStatus = (
        record: any,
        shift: any,
      ): {
        status: string;
        lateMinutes?: number;
        earlyOutMinutes?: number;
        workingHours?: string;
        checkInStatus?: string;
        checkOutStatus?: string;
      } => {
        console.log("record", record);

        // Handle case where there's no check-in
        if (!record.checkIn) {
          // If there's a check-out but no check-in, still calculate check-out status
          if (record.checkOut && shift) {
            const checkOutTime = new Date(record.checkOut);
            const attendanceDate = new Date(record.date);
            const shiftEnd = new Date(shift.endTime);

            const todayShiftEnd = new Date(attendanceDate);
            todayShiftEnd.setHours(
              shiftEnd.getHours(),
              shiftEnd.getMinutes(),
              0,
              0,
            );

            const earlyOutMinutes =
              checkOutTime < todayShiftEnd
                ? Math.floor(
                    (todayShiftEnd.getTime() - checkOutTime.getTime()) /
                      (1000 * 60),
                  )
                : 0;

            // Determine check-out status
            let checkOutStatus = "ON_TIME_LEAVE";
            if (earlyOutMinutes > 30) {
              checkOutStatus = "EARLY_OUT";
            }

            return {
              status: "ABSENT",
              checkOutStatus: checkOutStatus,
              earlyOutMinutes: earlyOutMinutes,
            };
          }
          return { status: "ABSENT" };
        }
        console.log("shift", shift);

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
        const todayShiftStart = new Date(attendanceDate);
        todayShiftStart.setHours(
          shiftStart.getHours(),
          shiftStart.getMinutes(),
          0,
          0,
        );
        console.log("todayShiftStart", todayShiftStart);

        const todayShiftEnd = new Date(attendanceDate);
        todayShiftEnd.setHours(
          shiftEnd.getHours(),
          shiftEnd.getMinutes(),
          0,
          0,
        );
        console.log("todayShiftEnd", todayShiftEnd);

        // Calculate late arrival
        const lateMinutes =
          checkInTime > todayShiftStart
            ? Math.floor(
                (checkInTime.getTime() - todayShiftStart.getTime()) /
                  (1000 * 60),
              )
            : 0;
        console.log("checkInTime", new Date(checkInTime).toLocaleTimeString());
        console.log("checkOutTime", checkOutTime);

        console.log("lateMinutes", lateMinutes);
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
          console.log("earlyOutMinutes", earlyOutMinutes);

          let workingSeconds =
            (checkOutTime.getTime() - checkInTime.getTime()) / 1000;
          if (workingSeconds < 0) workingSeconds = 0;

          const hours = Math.floor(workingSeconds / 3600);
          const minutes = Math.floor((workingSeconds % 3600) / 60);
          const seconds = Math.floor(workingSeconds % 60);

          workingHours = `${hours}h ${minutes}m ${seconds}s`;
          console.log("workingHours", workingHours);
        }

        // Determine status based on timing
        let status = "PRESENT";

        // Check for half day (if left before half day threshold)
        if (halfDayStart && checkOutTime) {
          const todayHalfDayStart = new Date(attendanceDate);
          todayHalfDayStart.setHours(
            halfDayStart.getHours(),
            halfDayStart.getMinutes(),
            0,
            0,
          );

          if (checkOutTime < todayHalfDayStart) {
            status = "HALF_DAY";
          }
        }

        // Check for late arrival (more than 15 minutes late)
        if (lateMinutes > 15) {
          status = status === "HALF_DAY" ? "HALF_DAY" : "LATE";
        }

        // Check for early departure (more than 30 minutes early)
        if (earlyOutMinutes > 30 && status !== "HALF_DAY") {
          status = "EARLY_OUT";
        }

        // Determine check-in status
        let checkInStatus = "ON_TIME_ARRIVAL";
        if (lateMinutes > 15) {
          checkInStatus = "LATE";
        }

        // Determine check-out status
        let checkOutStatus = checkOutTime ? "ON_TIME_LEAVE" : undefined;
        if (checkOutTime && earlyOutMinutes > 30) {
          checkOutStatus = "EARLY_OUT";
        }

        return {
          status,
          lateMinutes: lateMinutes,
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
        console.log("record", record);
        console.log("record.zktecoRecords", record.zktecoRecords);

        // Get the most relevant precise status from ZKTeco records
        const checkInRecord = record.zktecoRecords.find(
          (r: any) => r.checkType === "check_in",
        );
        const checkOutRecord = record.zktecoRecords.find((r: any) => {
          console.log("rur", r);
          return r.checkType === "check_out";
        });
        console.log("checkInRecord", checkInRecord);
        console.log("checkOutRecord", checkOutRecord);

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
        console.log("preciseStatus", preciseStatus);

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

      res.json({
        success: true,
        message: "Attendance data retrieved successfully",
        data: {
          records: transformedRecords,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
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
            const todayShiftEnd = new Date(attendanceDate);
            todayShiftEnd.setHours(
              shiftEnd.getHours(),
              shiftEnd.getMinutes(),
              0,
              0,
            );
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

        const todayShiftStart = new Date(attendanceDate);
        todayShiftStart.setHours(
          shiftStart.getHours(),
          shiftStart.getMinutes(),
          0,
          0,
        );

        const todayShiftEnd = new Date(attendanceDate);
        todayShiftEnd.setHours(
          shiftEnd.getHours(),
          shiftEnd.getMinutes(),
          0,
          0,
        );

        const lateMinutes =
          checkInTime > todayShiftStart
            ? Math.floor(
                (checkInTime.getTime() - todayShiftStart.getTime()) /
                  (1000 * 60),
              )
            : 0;

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
          const todayHalfDayStart = new Date(attendanceDate);
          todayHalfDayStart.setHours(
            halfDayStart.getHours(),
            halfDayStart.getMinutes(),
            0,
            0,
          );
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
            `Error uploading ${employee.firstName} ${employee.lastName}: ${
              error instanceof Error ? error.message : "Unknown error"
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

      console.log(
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
        console.log(
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
        console.log(
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

      console.log(
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

      console.log("leaveBalance", leaveBalance);

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
      console.log("recordIds", recordIds);

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

      console.log(
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

      console.log(
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

      console.log(
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
      const { startDate, endDate, departmentId } = req.query;

      const where: any = {};

      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.date.lte = new Date(endDate as string);
        }
      }

      if (departmentId) {
        where.employee = {
          departmentId: departmentId as string,
        };
      }

      // NOTE:
      // `Attendance.status` can remain PRESENT after finalization even when punches indicate LATE/ABSENT.
      // Derive stats from linked ZKTeco status + check-in/out for accurate analytics.
      const attendanceRecords = await prisma.attendance.findMany({
        where,
        select: {
          id: true,
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

      const totalRecords = attendanceRecords.length;

      const lateCount = attendanceRecords.filter((record: any) =>
        record.zktecoRecords.some((zkr: any) => zkr.overallStatus === "LATE"),
      ).length;

      const halfDayCount = attendanceRecords.filter((record: any) =>
        record.zktecoRecords.some(
          (zkr: any) => zkr.overallStatus === "HALF_DAY_LEAVE",
        ),
      ).length;

      const absentCount = attendanceRecords.filter((record: any) => {
        const hasAbsentStatus = record.zktecoRecords.some(
          (zkr: any) =>
            zkr.overallStatus === "ABSENT" ||
            zkr.overallStatus === "FULL_DAY_LEAVE",
        );
        const hasNoPunches = !record.checkIn && !record.checkOut;
        return hasAbsentStatus || hasNoPunches;
      }).length;

      const wfhCount = attendanceRecords.filter(
        (record: any) => record.status === "WORK_FROM_HOME",
      ).length;

      const presentCount = Math.max(totalRecords - absentCount, 0);

      const stats = {
        total: totalRecords,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount,
        workFromHome: wfhCount,
        presentPercentage:
          totalRecords > 0
            ? ((presentCount / totalRecords) * 100).toFixed(2)
            : "0",
        absentPercentage:
          totalRecords > 0
            ? ((absentCount / totalRecords) * 100).toFixed(2)
            : "0",
      };

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
      console.log(`iClock GET request from device: ${sn}, path: ${req.path}`);

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
      const sn = req.query.SN as string;
      const table = req.query.table as string;

      console.log(`🔄 iClock fdata from device: ${sn}, table: ${table}`);
      console.log(`📊 Query params:`, req.query);
      console.log(`📦 Headers:`, req.headers);
      console.log(`🔍 Device ${sn} status: ${sn ? "Connected" : "Unknown"}`);
      console.log(`🌐 Request IP: ${req.ip}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

      // Get raw body data
      const postData = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body || "", "utf-8");

      console.log(`📝 Received ${postData.length} bytes of face data`);
      if (postData.length > 0) {
        console.log(`📋 Face data received from device ${sn}`);
        console.log(`📊 Data type: ${table || "FACE"}`);
      } else {
        console.log(`⚠️ No face data received in request body`);
      }

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

      console.log(`🔄 iClock cdata from device: ${sn}, table: ${table}`);
      console.log(`📊 Query params:`, req.query);
      console.log(`📦 Headers:`, req.headers);
      console.log(`🔍 Device ${sn} status: ${sn ? "Connected" : "Unknown"}`);
      console.log(`🌐 Request IP: ${req.ip}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

      // Get raw body data
      const postData = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body || "", "utf-8");

      console.log(`📝 Received ${postData.length} bytes of data`);
      if (postData.length > 0) {
        const dataStr = postData.toString("utf-8");
        console.log(`📋 Full data: "${dataStr}"`);
        console.log(`📊 Data preview: ${dataStr.substring(0, 200)}...`);

        // Parse and log individual records
        const lines = dataStr.split("\n");
        console.log(`📊 Number of lines: ${lines.length}`);
        lines.forEach((line, index) => {
          if (line.trim()) {
            console.log(`📋 Line ${index}: "${line.trim()}"`);
            const parts = line.trim().split("\t");
            console.log(`📊 Parts: [${parts.map((p) => `"${p}"`).join(", ")}]`);
          }
        });
      } else {
        console.log(`⚠️ No data received in request body`);
      }

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

      console.log(
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

      console.log(
        `🔐 SuperAdmin ${currentUser.email} running finalization cron manually`,
      );

      const { finalizationService } =
        await import("../services/finalizationService");
      const result = await finalizationService.finalizeStagingRecords();

      res.json({
        success: result.success,
        message: `Finalized ${result.finalized} records (3+ days old) with ${result.errors} errors`,
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

      // Find the attendance record
      const record = await prisma.attendance.findUnique({
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

      // Find the attendance record
      const record = await prisma.attendance.findUnique({
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

      const { sendAll = false, fromDate, toDate } = req.body as {
        sendAll?: boolean;
        fromDate?: string;
        toDate?: string;
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

      const recordsByEmployee =
        AttendanceReminderService.groupByEmployee(recordsNeedingReasons);

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
        message: `Queued reminder emails for ${recordsByEmployee.size} employee${recordsByEmployee.size !== 1 ? "s" : ""}. Ensure the email worker is running.`,
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
              dates: records.map((r) =>
                new Date(r.date).toLocaleDateString(),
              ),
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
      const employeeEmail = record.employee?.email;
      if (!employeeEmail) {
        res.status(400).json({
          success: false,
          message: "Employee email not found in record",
        });
        return;
      }

      // Build attendance issue description (HTML)
      const issues = [];

      if (!record.checkIn) {
        issues.push(
          "<li><strong style='color: #dc2626;'>⚠️ No check-in recorded</strong></li>",
        );
      } else if (record.checkInStatus === "LATE" && record.lateMinutes > 0) {
        issues.push(
          `<li><span style='color: #ea580c;'>Check-in was <strong>late by ${record.lateMinutes} minute(s)</strong></span></li>`,
        );
      }

      if (!record.checkOut) {
        issues.push(
          "<li><strong style='color: #dc2626;'>⚠️ No check-out recorded</strong></li>",
        );
      } else if (
        record.checkOutStatus === "EARLY" &&
        record.earlyOutMinutes > 0
      ) {
        issues.push(
          `<li><span style='color: #ea580c;'>Check-out was <strong>early by ${record.earlyOutMinutes} minute(s)</strong></span></li>`,
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
}
