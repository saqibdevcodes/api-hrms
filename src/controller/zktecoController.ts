/**
 * ZKTeco Controller - Handles all ZKTeco biometric device operations
 *
 * This controller manages:
 * - Device management (add, remove, status)
 * - Employee management (upload to devices)
 * - Attendance data synchronization
 * - iClock protocol handling (device communication)
 * - Real-time data processing
 *
 * Key Features:
 * - Automatic device status monitoring
 * - Real-time attendance data processing
 * - Employee enrollment on devices
 * - Device health monitoring
 * - Data export and reporting
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  zktecoService,
  ZKTecoDevice,
  AttendanceData,
  EmployeeData,
} from "../services/zktecoService";
import { PrismaClient } from "../generated/prisma";
import { AuthenticatedRequest } from "../types/auth";

const prisma = new PrismaClient();

export class ZKTecoController {
  /**
   * ========================================
   * DEVICE MANAGEMENT METHODS
   * ========================================
   */

  /**
   * Get all registered ZKTeco devices with their current status
   *
   * This method:
   * 1. Retrieves all devices from the service
   * 2. Checks each device's online/offline status
   * 3. Fetches real-time device information
   * 4. Returns comprehensive device status for the frontend
   *
   * Use case: Dashboard display, device monitoring
   *
   * @param req - Express request object
   * @param res - Express response object
   * @returns JSON with devices array and total count
   */
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
        })
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

  /**
   * Get detailed status of a specific ZKTeco device
   *
   * This method:
   * 1. Takes a device ID from the request parameters
   * 2. Attempts to connect to the device via HTTP
   * 3. Fetches real-time device information (firmware, time, etc.)
   * 4. Returns comprehensive device status including online/offline state
   *
   * Use case: Device detail page, troubleshooting, health monitoring
   *
   * @param req - Express request object with deviceId in params
   * @param res - Express response object
   * @returns JSON with device status, info, and online state
   */
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

  /**
   * ========================================
   * ATTENDANCE SYNCHRONIZATION METHODS
   * ========================================
   */

  /**
   * Manually sync attendance data from ZKTeco devices
   *
   * ⚠️ IMPORTANT: This method is for MANUAL sync only
   * Your UFace 800 device uses iClock push protocol, so this will always fail
   * Real-time data comes automatically via iClock push (handleIClockCData)
   *
   * This method:
   * 1. Accepts optional date range and device ID filters
   * 2. Attempts to pull data from device via HTTP (not supported by UFace 800)
   * 3. Returns error because UFace 800 doesn't support HTTP attendance retrieval
   *
   * Use case: Manual data sync (not recommended for UFace 800)
   * Better alternative: Use real-time iClock push data
   *
   * @param req - Express request object with optional startDate, endDate, deviceId
   * @param res - Express response object
   * @returns JSON with sync results (will be error for UFace 800)
   */
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
          end
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

  /**
   * ========================================
   * ATTENDANCE DATA RETRIEVAL METHODS
   * ========================================
   */

  /**
   * Get processed attendance data from the database
   *
   * This method:
   * 1. Accepts query parameters for filtering (deviceId, dates, employeeId, pagination)
   * 2. Implements role-based access control (employees see only their data, admins see all)
   * 3. Applies date range filtering if specified
   * 4. Returns paginated attendance records with employee and shift information
   * 5. Includes related ZKTeco raw records for debugging
   *
   * Use case: Attendance dashboard, reports, employee self-service
   * Called by: Frontend attendance page, reports, mobile apps
   *
   * ⚠️ Note: This returns PROCESSED attendance data, not raw device data
   * Raw device data is available via getZKTecoRecords endpoint
   *
   * @param req - Express request object with query parameters
   * @param res - Express response object
   * @returns JSON with paginated attendance records and total count
   */
  static async getAttendanceData(req: Request, res: Response) {
    try {
      const {
        deviceId,
        startDate,
        endDate,
        employeeId,
        page = 1,
        limit = 50,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // 🔐 SECURITY: Get authenticated user from request
      const authenticatedRequest = req as any;
      const currentUser = authenticatedRequest.user;

      // 🏗️ BUILD FILTER: Create database query conditions
      const where: any = {};

      // 👥 ROLE-BASED ACCESS CONTROL: Filter data based on user role
      if (currentUser.role === "EMPLOYEE") {
        // 🔒 EMPLOYEE VIEW: Can only see their own attendance records
        where.employeeId = currentUser.id;
        console.log(
          `👤 Employee ${currentUser.email} viewing their own attendance`
        );
      } else if (currentUser.role === "ADMIN") {
        // 🔓 ADMIN VIEW: Can see all records, optionally filtered by employeeId
        if (employeeId) {
          where.employeeId = employeeId as string;
        }
        console.log(`👥 Admin ${currentUser.email} viewing attendance records`);
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

      // Add 3-day delay filter (unless forceFetch is enabled by SuperAdmin)
      const forceFetch = req.query.forceFetch === 'true';
      
      // Security: Only SuperAdmin can use forceFetch
      if (forceFetch && currentUser.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can force fetch attendance data',
          error: 'Insufficient permissions',
        });
      }
      
      if (!forceFetch) {
        // Normal mode: Only show records created 3+ days ago
        const today = new Date();
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(today.getDate() - 3);
        where.createdAt = {
          lte: threeDaysAgo,
        };
        console.log('📅 Applying 3-day delay filter for attendance data');
      } else {
        // Force fetch mode: Show all records (SuperAdmin only)
        console.log('⚡ Force fetch enabled by SuperAdmin - showing all attendance records');
      }

      const [attendanceRecords, total] = await Promise.all([
        prisma.attendance.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
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
        shift: any
      ): {
        status: string;
        lateMinutes?: number;
        earlyOutMinutes?: number;
        workingHours?: string;
      } => {
        console.log("record", record);

        if (!record.checkIn) {
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
          0
        );
        console.log("todayShiftStart", todayShiftStart);

        const todayShiftEnd = new Date(attendanceDate);
        todayShiftEnd.setHours(
          shiftEnd.getHours(),
          shiftEnd.getMinutes(),
          0,
          0
        );
        console.log("todayShiftEnd", todayShiftEnd);

        // Calculate late arrival
        const lateMinutes =
          checkInTime > todayShiftStart
            ? Math.floor(
                (checkInTime.getTime() - todayShiftStart.getTime()) /
                  (1000 * 60)
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
                    (1000 * 60)
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
            0
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

        return {
          status,
          lateMinutes: lateMinutes,
          earlyOutMinutes: earlyOutMinutes,
          workingHours: workingHours,
        };
      };

      // Transform data to include employee details and precise status from ZKTeco records
      const transformedRecords = attendanceRecords.map((record) => {
        const calculatedStatus = calculateAttendanceStatus(
          record,
          record.employee.shift
        );
        console.log("record", record);
        console.log("record.zktecoRecords", record.zktecoRecords);

        // Get the most relevant precise status from ZKTeco records
        const checkInRecord = record.zktecoRecords.find(
          (r) => r.checkType === "check_in"
        );
        const checkOutRecord = record.zktecoRecords.find((r) => {
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

          // Shift-based calculations
          lateMinutes: calculatedStatus.lateMinutes,
          earlyOutMinutes: calculatedStatus.earlyOutMinutes,
          workingHours: calculatedStatus.workingHours,

          // ZKTeco precise status details
          checkInStatus: checkInRecord?.overallStatus || null,
          checkOutStatus: checkOutRecord?.overallStatus || null,
          zktecoRecords: record.zktecoRecords.map((zkr) => ({
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

  /**
   * ========================================
   * EMPLOYEE MANAGEMENT METHODS
   * ========================================
   */

  /**
   * Upload a single employee to a ZKTeco device
   *
   * This method:
   * 1. Validates the request data (deviceId, employeeId, cardNumber)
   * 2. Finds the employee in the database by ID or employeeId
   * 3. Prepares employee data for device upload
   * 4. Calls the service to upload to the physical device
   * 5. Returns success/failure response
   *
   * Use case: Adding individual employees to devices
   * Called by: "Add Employee" button in frontend
   *
   * @param req - Authenticated request with deviceId, employeeId, cardNumber
   * @param res - Express response object
   * @returns JSON with upload success status and employee data
   * 
   */
  static async uploadEmployeeToDevice(
    req: AuthenticatedRequest,
    res: Response
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
        employeeData
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

  /**
   * Upload all active employees to a ZKTeco device (bulk operation)
   *
   * This method:
   * 1. Takes a deviceId from the request body
   * 2. Fetches all active employees from the database
   * 3. Attempts to upload each employee to the device
   * 4. Tracks success/failure counts and errors
   * 5. Returns comprehensive upload results
   *
   * Use case: Initial device setup, bulk employee enrollment
   * Called by: "Upload All Employees" button in frontend
   *
   * ⚠️ Note: This can take a while for large employee databases
   *
   * @param req - Authenticated request with deviceId
   * @param res - Express response object
   * @returns JSON with upload counts, success status, and any errors
   */
  static async uploadAllEmployeesToDevice(
    req: AuthenticatedRequest,
    res: Response
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
            employeeData
          );
          if (success) {
            successCount++;
          } else {
            failCount++;
            errors.push(
              `Failed to upload ${employee.firstName} ${employee.lastName}`
            );
          }
        } catch (error) {
          failCount++;
          errors.push(
            `Error uploading ${employee.firstName} ${employee.lastName}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
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

  /**
   * Add a new ZKTeco device
   */
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

  /**
   * Remove a ZKTeco device
   */
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

  /**
   * Clear attendance data from device
   */
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

  /**
   * Fetch all attendance records for a specific device from database
   * (Machine doesn't support HTTP attendance retrieval - data comes via iClock push)
   */
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
        `🔄 Fetching attendance records for device: ${deviceId} with filter: ${filter}`
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
          `📅 Custom date range: ${start.toISOString()} to ${end.toISOString()}`
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
              59
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
          `📅 Filter applied: ${filter} - ${start?.toISOString()} to ${end?.toISOString()}`
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
      const transformedRecords = zktecoRecords.map((record) => ({
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
        `📊 Found ${transformedRecords.length} attendance records for device ${deviceId}`
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

  /**
   * Get raw ZKTeco attendance records from the database
   * 
   * This method:
   * 1. Accepts query parameters for filtering (employeeId, deviceId, checkType, dates, pagination)
   * 2. Returns UNPROCESSED raw data directly from the device
   * 3. Includes employee information for each record
  4. Applies comprehensive filtering and pagination
   * 5. Returns data in a format suitable for debugging and analysis
   * 
   * Use case: Debugging attendance issues, raw data analysis, troubleshooting
   * Called by: Admin debugging tools, data export, system monitoring
   * 
   * ⚠️ Note: This returns RAW device data, not processed attendance records
   * Processed data is available via getAttendanceData endpoint
   * 
   * @param req - Express request object with query parameters
   * @param res - Express response object
   * @returns JSON with paginated raw ZKTeco records and total count
   */
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
      const transformedRecords = zktecoRecords.map((record) => ({
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

  /**
   * Get employee deduction history with details
   */
  static async getEmployeeDeductionHistory(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;
      const deductionHistory = await zktecoService.getEmployeeDeductionHistory(
        employeeId
      );

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

  /**
   * Debug attendance records for a specific employee and date
   */
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
        date
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

  /**
   * Fix attendance records by processing unprocessed ZKTeco records
   */
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
        date
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

  /**
   * Get employee's current leave balance
   */
  static async getEmployeeLeaveBalance(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;
      const leaveBalance = await zktecoService.getEmployeeLeaveBalance(
        employeeId
      );

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

  /**
   * Validate if specific records can be used for deductions
   */
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

      const validation = await zktecoService.validateRecordsForDeduction(
        recordIds
      );

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

  /**
   * Export attendance data to CSV or XLSX
   */
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
        `🔄 Exporting attendance data for device: ${deviceId} in ${format} format`
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
      const exportData = zktecoRecords.map((record) => ({
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
          ...exportData.map((row) =>
            headers
              .map((header) => {
                const value = row[header as keyof typeof row];
                // Escape quotes and wrap in quotes if contains comma
                return typeof value === "string" && value.includes(",")
                  ? `"${value.replace(/"/g, '""')}"`
                  : value;
              })
              .join(",")
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.csv"`
        );
        res.send(csvContent);
      } else if (format === "xlsx") {
        // For XLSX, we'll return JSON and let frontend handle Excel generation
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.json"`
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
        `📊 Exported ${exportData.length} attendance records in ${format} format`
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

  /**
   * Create employee from ZKTeco data (helper function)
   */
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
        `✅ Employee created: ${employee.employeeId} - ${employee.firstName} ${employee.lastName}`
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

  /**
   * Get attendance statistics
   */
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

      const [
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        halfDayCount,
        wfhCount,
      ] = await Promise.all([
        prisma.attendance.count({ where }),
        prisma.attendance.count({ where: { ...where, status: "PRESENT" } }),
        prisma.attendance.count({ where: { ...where, status: "ABSENT" } }),
        prisma.attendance.count({ where: { ...where, status: "LATE" } }),
        prisma.attendance.count({ where: { ...where, status: "HALF_DAY" } }),
        prisma.attendance.count({
          where: { ...where, status: "WORK_FROM_HOME" },
        }),
      ]);

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

  /**
   * Get real-time device info
   */
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

  /**
   * Test endpoint to simulate attendance data from ZKTeco device
   */
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
        deviceIp
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

  /**
   * ========================================
   * ICLOCK PROTOCOL HANDLERS
   * ========================================
   *
   * These methods handle the iClock protocol communication with ZKTeco devices
   * iClock is the HTTP-based protocol used by ZKTeco devices for real-time data exchange
   *
   * Protocol Flow:
   * 1. Device sends GET /getrequest to check for commands
   * 2. Device sends POST /ping for heartbeat/status
   * 3. Device sends POST /cdata for attendance data
   * 4. Device sends POST /fdata for face data
   *
   * Your UFace 800 device automatically sends these requests to your server
   */

  /**
   * Handle iClock GET /getrequest - Device requesting commands
   *
   * This method:
   * 1. Receives GET request from device when it connects
   * 2. Extracts device serial number (SN) from query parameters
   * 3. Calls service to handle device connection and auto-sync
   * 4. Returns "OK" to acknowledge device connection
   *
   * Use case: Device connection, automatic device registration
   * Called by: Device automatically when it connects to network
   *
   * @param req - Express request object with SN query parameter
   * @param res - Express response object
   * @returns "OK" response to acknowledge device
   */
  static async handleIClockGetRequest(
    req: Request,
    res: Response
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

  /**
   * Handle iClock POST /ping - Device heartbeat/status update
   *
   * This method:
   * 1. Receives POST request from device for heartbeat
   * 2. Extracts device serial number (SN) from query parameters
   * 3. Updates device status and last seen timestamp
   * 4. Returns "OK" to acknowledge heartbeat
   *
   * Use case: Device health monitoring, online status tracking
   * Called by: Device automatically every few minutes
   *
   * @param req - Express request object with SN query parameter
   * @param res - Express response object
   * @returns "OK" response to acknowledge heartbeat
   */
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

  /**
   * Handle iClock POST /fdata - Device uploading face data
   *
   * This method:
   * 1. Receives POST request from device with face data
   * 2. Extracts device serial number (SN) and table type from query parameters
   * 3. Logs detailed information about the request for debugging
   * 4. Processes face data if needed (currently just logs)
   * 5. Returns "OK" to acknowledge data receipt
   *
   * Use case: Face recognition data, employee face templates
   * Called by: Device when uploading face data or user information
   *
   * ⚠️ Note: Currently just logs data, can be extended for face processing
   *
   * @param req - Express request object with SN, table query parameters and face data in body
   * @param res - Express response object
   * @returns "OK" response to acknowledge data receipt
   */
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

  /**
   * Handle iClock POST /cdata - Device uploading attendance data
   *
   * This method:
   * 1. Receives POST request from device with attendance data
   * 2. Extracts device serial number (SN) and table type from query parameters
   * 3. Logs detailed information about the request for debugging
   * 4. Processes attendance data via service (creates/updates attendance records)
   * 5. Returns "OK" to acknowledge data receipt
   *
   * Use case: Real-time attendance data, punch in/out records
   * Called by: Device automatically when attendance events occur
   *
   * ⚠️ This is the MAIN method for receiving attendance data from your UFace 800
   * All punch in/out events come through this endpoint
   *
   * @param req - Express request object with SN, table query parameters and attendance data in body
   * @param res - Express response object
   * @returns "OK" response to acknowledge data receipt
   */
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
}

/**
 * ========================================
 * ZKTECO CONTROLLER SUMMARY
 * ========================================
 *
 * This controller provides a complete interface for ZKTeco biometric device management.
 *
 * KEY ENDPOINTS:
 *
 * DEVICE MANAGEMENT:
 * - GET /devices - List all devices with status
 * - GET /devices/:id/status - Get specific device status
 *
 * EMPLOYEE MANAGEMENT:
 * - POST /devices/upload-employee - Add single employee to device
 * - POST /devices/upload-all-employees - Bulk upload all employees
 *
 * ATTENDANCE DATA:
 * - GET /attendance/data - Get processed attendance records (with pagination)
 * - GET /attendance/zkteco-records - Get raw device data (for debugging)
 * - POST /attendance/sync - Manual sync (not recommended for UFace 800)
 *
 * ICLOCK PROTOCOL (AUTOMATIC):
 * - GET /iclock/getrequest - Device connection (auto-registers device)
 * - POST /iclock/ping - Device heartbeat (updates status)
 * - POST /iclock/cdata - Attendance data (main data source)
 * - POST /iclock/fdata - Face data (employee templates)
 *
 * MODIFICATION GUIDE:
 *
 * 1. To add new device operations:
 *    - Add method to this controller
 *    - Add route in zktecoRoutes.ts
 *    - Add validation in zktecoValidator.ts
 *
 * 2. To modify attendance processing:
 *    - Edit zktecoService.ts methods
 *    - Update business logic in processZKTecoAttendanceData
 *
 * 3. To add new data types:
 *    - Add new iClock handler method
 *    - Update service layer accordingly
 *    - Add database schema if needed
 *
 * 4. To customize device communication:
 *    - Modify iClock protocol handlers
 *    - Update device status tracking
 *    - Enhance error handling
 *
 * ⚠️ IMPORTANT NOTES:
 * - Your UFace 800 uses iClock push protocol (not HTTP polling)
 * - Manual sync will always fail (device limitation)
 * - Real-time data comes via handleIClockCData
 * - Device auto-registers when it connects
 *
 * Happy coding! 🚀
 */
