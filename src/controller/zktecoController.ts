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
   * Get all ZKTeco devices
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
   * Get device status by ID
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
   * Manually sync attendance data from devices
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
   * Get attendance data from ZKTeco devices
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

      // Build where clause
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

      if (employeeId) {
        where.employeeId = employeeId as string;
      }

      // If deviceId filter is needed, we can add a deviceId field to attendance records
      // For now, we'll get all attendance records

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

      // Transform data to include employee details
      const transformedRecords = attendanceRecords.map((record) => ({
        id: record.id,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        status: record.status,
        notes: record.notes,
        employee: {
          id: record.employee.id,
          employeeId: record.employee.employeeId,
          name: `${record.employee.firstName} ${record.employee.lastName}`,
          email: record.employee.email,
        },
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));

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
   * Upload employee data to ZKTeco device
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
   * Upload all employees to a device
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
   * iClock GET request handler - device requesting commands
   */
  static async handleIClockGetRequest(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const sn = req.query.SN as string;

      console.log(`iClock GET request from device: ${sn}, path: ${req.path}`);

      const result = await zktecoService.handleIClockGetRequest(sn);

      res.status(200).send(result);
    } catch (error) {
      console.error("Error handling iClock GET request:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  /**
   * iClock ping handler - device heartbeat
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
   * iClock cdata handler - device uploading data
   */
  static async handleIClockCData(req: Request, res: Response): Promise<void> {
    try {
      const sn = req.query.SN as string;
      const table = req.query.table as string;

      console.log(`🔄 iClock cdata from device: ${sn}, table: ${table}`);
      console.log(`📊 Query params:`, req.query);
      console.log(`📦 Headers:`, req.headers);

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
