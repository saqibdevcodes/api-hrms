import axios, { AxiosInstance } from "axios";
import dgram from "dgram";
import { prisma } from "../lib/prisma";
import cron from "node-cron";
import { getSocketManager } from "../index";

export interface ZKTecoDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  password?: string;
  serialNumber?: string;
  model?: string;
  isActive: boolean;
  status?: "online" | "offline";
  lastSeen?: Date;
  info?: any;
}

export interface AttendanceData {
  employeeId: string;
  timestamp: Date;
  checkType: "check_in" | "check_out";
  deviceId: string;
  verifyType: number; // 1: fingerprint, 2: face, 3: card, etc.
}

export interface EmployeeData {
  employeeId: string;
  name: string;
  fingerprintTemplate?: string;
  faceTemplate?: string;
  cardNumber?: string;
}

export class ZKTecoService {
  private devices: Map<string, ZKTecoDevice> = new Map();
  private admsServer: dgram.Socket | null = null;
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize devices
    this.initializeDevices();

    // Start ADMS server
    this.startADMSServer();

    // Schedule periodic data sync
    this.scheduleDataSync();
  }

  private initializeDevices() {
    // Add your ZKTeco UFace 800 device
    const device: ZKTecoDevice = {
      id: "uface800_001",
      name: "UFace 800 Main Entry",
      ip: "192.168.2.202",
      port: 4370, // TCP port
      password: "888888", // Device password
      model: "UFace 800",
      isActive: true,
    };

    this.devices.set(device.id, device);
    console.log(
      `ZKTeco device initialized: ${device.name} (${device.ip}:${device.port})`,
    );
  }

  /**
   * Start ADMS (iClock HTTP Server) to receive push data from devices
   */
  private startADMSServer() {
    try {
      // Note: iClock protocol uses HTTP, not UDP
      console.log("iClock HTTP server will be started via Express routes");
      console.log(
        "Device should be configured to push to: http://147.79.100.197:30000/api/v1/zkteco/iclock/",
      );
    } catch (error) {
      console.error("Failed to start ADMS server:", error);
    }
  }

  /**
   * Process incoming ADMS messages from ZKTeco devices
   */
  private async processADMSMessage(message: Buffer, remote: dgram.RemoteInfo) {
    try {
      // Parse the message based on ZKTeco ADMS protocol
      const data = this.parseADMSMessage(message);

      if (data.type === "attendance") {
        await this.processAttendanceData(data.attendanceData, remote.address);
      } else if (data.type === "heartbeat") {
        await this.processHeartbeat(remote.address);
      }
    } catch (error) {
      console.error("Error parsing ADMS message:", error);
    }
  }

  /**
   * Parse ADMS message according to ZKTeco protocol
   */
  private parseADMSMessage(message: Buffer): any {
    // ZKTeco ADMS protocol parsing
    // This is a simplified version - you may need to adjust based on actual protocol

    if (message.length < 8) {
      throw new Error("Invalid message length");
    }

    const command = message.readUInt16LE(0);
    const checksum = message.readUInt16LE(2);
    const sessionId = message.readUInt16LE(4);
    const replyId = message.readUInt16LE(6);

    // Command codes (simplified)
    switch (command) {
      case 500: // Real-time attendance data
        return {
          type: "attendance",
          attendanceData: this.parseAttendanceFromBuffer(message.slice(8)),
        };
      case 1002: // Heartbeat
        return {
          type: "heartbeat",
          sessionId,
          replyId,
        };
      default:
        console.log(`Unknown command: ${command}`);
        return { type: "unknown", command };
    }
  }

  /**
   * Parse attendance data from buffer
   */
  private parseAttendanceFromBuffer(buffer: Buffer): AttendanceData {
    // This is a simplified parsing - adjust based on actual ZKTeco protocol
    const employeeId = buffer.readUInt32LE(0).toString();
    const timestamp = new Date(buffer.readUInt32LE(4) * 1000);
    const verifyType = buffer.readUInt8(8);
    const inOutMode = buffer.readUInt8(9);

    return {
      employeeId,
      timestamp,
      checkType: inOutMode === 0 ? "check_in" : "check_out",
      deviceId: "uface800_001",
      verifyType,
    };
  }

  /**
   * Process attendance data and save to database
   */
  public async processAttendanceData(
    attendanceData: AttendanceData,
    deviceIp: string,
  ) {
    try {
      console.log("Processing attendance data:", attendanceData);

      // Find employee by employeeId (ZKTeco internal ID)
      const employee = await prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: attendanceData.employeeId },
            { id: attendanceData.employeeId }, // fallback to user ID
          ],
        },
      });

      if (!employee) {
        console.warn(`Employee not found for ID: ${attendanceData.employeeId}`);
        return;
      }

      const attendanceDate = new Date(attendanceData.timestamp);
      const dateOnly = new Date(
        attendanceDate.getFullYear(),
        attendanceDate.getMonth(),
        attendanceDate.getDate(),
      );

      // Check if attendance record exists for this date
      let attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          date: dateOnly,
        },
      });

      if (!attendance) {
        // Create new attendance record
        attendance = await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: dateOnly,
            checkIn:
              attendanceData.checkType === "check_in"
                ? attendanceData.timestamp
                : null,
            checkOut:
              attendanceData.checkType === "check_out"
                ? attendanceData.timestamp
                : null,
            status: "PRESENT",
            notes: `Recorded via ZKTeco device (${deviceIp})`,
          },
        });
      } else {
        // Update existing attendance record
        const updateData: any = {
          status: "PRESENT",
          notes: `Updated via ZKTeco device (${deviceIp})`,
        };

        if (attendanceData.checkType === "check_in" && !attendance.checkIn) {
          updateData.checkIn = attendanceData.timestamp;
        } else if (attendanceData.checkType === "check_out") {
          updateData.checkOut = attendanceData.timestamp;
        }

        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: updateData,
        });
      }

      console.log(
        `Attendance recorded for employee ${employee.employeeId}: ${attendanceData.checkType} at ${attendanceData.timestamp}`,
      );

      // Emit real-time attendance update via Socket.IO
      try {
        const socketManager = getSocketManager();
        if (socketManager) {
          // Prepare attendance data for frontend
          const attendanceUpdate = {
            id: attendance.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            employeeId: employee.employeeId || employee.id,
            date: attendanceDate.toISOString().split("T")[0],
            checkIn: attendance.checkIn
              ? new Date(attendance.checkIn).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
            checkOut: attendance.checkOut
              ? new Date(attendance.checkOut).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
            status: this.getAttendanceStatus(
              attendance.checkIn,
              attendance.checkOut,
              attendanceDate,
            ),
            checkType: attendanceData.checkType,
            timestamp: attendanceData.timestamp,
            deviceIp: deviceIp,
            isNew: !attendance.checkIn || !attendance.checkOut, // Indicates if this is a new record or update
          };

          // Emit to all admin and HR users for live monitoring
          socketManager.emitToRole(
            "admin",
            "attendance:live_update",
            attendanceUpdate,
          );
          socketManager.emitToRole(
            "hr",
            "attendance:live_update",
            attendanceUpdate,
          );

          // Also emit to the specific employee
          socketManager.emitToUser(employee.id, "attendance:personal_update", {
            checkType: attendanceData.checkType,
            timestamp: attendanceData.timestamp,
            status: attendanceUpdate.status,
          });

          console.log(
            `Live attendance update emitted for ${employee.employeeId}`,
          );
        }
      } catch (socketError) {
        console.error("Error emitting live attendance update:", socketError);
      }
    } catch (error) {
      console.error("Error processing attendance data:", error);
    }
  }

  /**
   * Determine attendance status based on check-in/check-out times
   */
  private getAttendanceStatus(
    checkIn: Date | null,
    checkOut: Date | null,
    attendanceDate: Date,
  ): string {
    if (!checkIn && !checkOut) {
      return "Absent";
    }

    if (checkIn) {
      // Consider late if check-in is after 9:00 AM
      const standardCheckIn = new Date(attendanceDate);
      standardCheckIn.setHours(9, 0, 0, 0);

      if (checkIn > standardCheckIn) {
        return "Late";
      }
    }

    // If only check-in or both check-in/out are present and on time
    return "Present";
  }

  /**
   * Process heartbeat from device
   */
  private async processHeartbeat(deviceIp: string) {
    const device = Array.from(this.devices.values()).find(
      (d) => d.ip === deviceIp,
    );
    if (device) {
      console.log(
        `Heartbeat received from device: ${device.name} (${deviceIp})`,
      );
      // You can update device status, last seen time, etc.
    }
  }

  /**
   * Fetch attendance data directly from device via HTTP API
   */
  async fetchAttendanceFromDevice(
    deviceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AttendanceData[]> {
    const device = this.devices.get(deviceId);
    if (!device || !device.isActive) {
      throw new Error(`Device ${deviceId} not found or inactive`);
    }

    try {
      // ZKTeco devices often support HTTP API for data retrieval
      const url = `http://${device.ip}/cgi-bin/attendlog.cgi`;
      const params: any = {};

      // Add authentication password if available
      if (device.password) {
        params.password = device.password;
      }

      if (startDate) {
        params.start = Math.floor(startDate.getTime() / 1000);
      }
      if (endDate) {
        params.end = Math.floor(endDate.getTime() / 1000);
      }

      const response = await this.httpClient.get(url, { params });
      return this.parseHttpAttendanceResponse(response.data, deviceId);
    } catch (error) {
      console.error(
        `Error fetching attendance from device ${deviceId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Parse HTTP response containing attendance data
   */
  private parseHttpAttendanceResponse(
    data: string,
    deviceId: string,
  ): AttendanceData[] {
    const attendanceRecords: AttendanceData[] = [];

    // Parse the response (format may vary by device firmware)
    // Example format: "1\t2024-01-15 09:00:00\t0\t1\n"
    const lines = data.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length >= 4) {
        const employeeId = parts[0];
        const timestamp = new Date(parts[1]);
        const inOutMode = parseInt(parts[2]);
        const verifyType = parseInt(parts[3]);

        attendanceRecords.push({
          employeeId,
          timestamp,
          checkType: inOutMode === 0 ? "check_in" : "check_out",
          deviceId,
          verifyType,
        });
      }
    }

    return attendanceRecords;
  }

  /**
   * Sync attendance data from all devices (Manual sync only - ADMS handles real-time)
   */
  async syncAttendanceData(startDate?: Date, endDate?: Date): Promise<void> {
    console.log("Starting manual attendance data sync...");

    for (const device of this.devices.values()) {
      if (!device.isActive) continue;

      try {
        const attendanceData = await this.fetchAttendanceFromDevice(
          device.id,
          startDate,
          endDate,
        );

        for (const attendance of attendanceData) {
          await this.processAttendanceData(attendance, device.ip);
        }

        console.log(
          `Synced ${attendanceData.length} records from device ${device.name}`,
        );
      } catch (error) {
        console.error(`Error syncing data from device ${device.name}:`, error);
      }
    }

    console.log("Attendance data sync completed");
  }

  /**
   * Get device status
   */
  async getDeviceStatus(deviceId: string): Promise<any> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      const url = `http://${device.ip}/cgi-bin/deviceinfo.cgi`;
      const params: any = {};

      // Add authentication password if available
      if (device.password) {
        params.password = device.password;
      }

      const response = await this.httpClient.get(url, {
        params,
        timeout: 3000,
      });

      return {
        device,
        online: true,
        lastSeen: new Date(),
        info: response.data,
      };
    } catch (error) {
      return {
        device,
        online: false,
        lastSeen: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get detailed device information from the device
   */
  async getDeviceInfo(deviceId: string): Promise<any> {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Try to get device info via HTTP (if supported)
      const response = await this.httpClient.get(
        `http://${device.ip}:${device.port}/cgi-bin/getdeviceinfo.cgi`,
        {
          params: { password: device.password || "888888" },
          timeout: 5000,
        },
      );

      if (response.data) {
        return {
          model: response.data.deviceName || device.model,
          firmwareVersion: response.data.firmwareVersion,
          deviceTime: response.data.deviceTime,
          ...response.data,
        };
      }

      return null;
    } catch (error) {
      console.log(
        `Could not fetch device info for ${deviceId}:`,
        (error as Error).message,
      );
      return null;
    }
  }

  /**
   * Get all registered devices
   */
  getDevices(): ZKTecoDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Add a new device
   */
  addDevice(device: ZKTecoDevice): void {
    this.devices.set(device.id, device);
    console.log(`Device added: ${device.name} (${device.ip})`);
  }

  /**
   * Remove a device
   */
  removeDevice(deviceId: string): boolean {
    const removed = this.devices.delete(deviceId);
    if (removed) {
      console.log(`Device removed: ${deviceId}`);
    }
    return removed;
  }

  /**
   * Schedule periodic data sync
   */
  private scheduleDataSync(): void {
    // Note: Disabled HTTP polling since ADMS push is the primary method
    // ADMS (real-time push) is preferred over HTTP polling for ZKTeco devices
    console.log("ADMS real-time push enabled - HTTP polling sync disabled");
  }

  /**
   * Upload employee data to device
   */
  async uploadEmployeeToDevice(
    deviceId: string,
    employee: EmployeeData,
  ): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      // Upload employee via HTTP API
      const url = `http://${device.ip}/cgi-bin/userinfo.cgi`;
      const data = {
        pin: employee.employeeId,
        name: employee.name,
        privilege: 0, // Regular user
        passwd: "", // Password if needed
        card: employee.cardNumber || "",
        grp: 1, // Group ID
        tz: 1, // Timezone
        // Add device password for authentication
        password: device.password || "",
      };

      await this.httpClient.post(url, data);
      console.log(
        `Employee ${employee.name} uploaded to device ${device.name}`,
      );
      return true;
    } catch (error) {
      console.error(`Error uploading employee to device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Clear all attendance data from device
   */
  async clearDeviceAttendance(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      const url = `http://${device.ip}/cgi-bin/clearattlog.cgi`;
      const data = {
        password: device.password || "",
      };
      await this.httpClient.post(url, data);
      console.log(`Attendance data cleared from device ${device.name}`);
      return true;
    } catch (error) {
      console.error(
        `Error clearing attendance from device ${deviceId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Stop the ADMS server
   */
  stopADMSServer(): void {
    if (this.admsServer) {
      this.admsServer.close();
      this.admsServer = null;
      console.log("ADMS Server stopped");
    }
  }

  /**
   * Handle iClock GET request (device requesting commands)
   */
  async handleIClockGetRequest(sn: string): Promise<string> {
    console.log(`Device ${sn} requesting commands`);

    // Update device status and sync details automatically
    if (sn) {
      try {
        await this.autoSyncDeviceDetails(sn);
        console.log(
          `🔍 Device ${sn} is online - waiting for attendance data...`,
        );
        console.log(
          `📡 Device should push to: http://147.79.100.197:30000/api/v1/zkteco/iclock/`,
        );
        console.log(
          `💡 Check device configuration: ADMS Server = 147.79.100.197, Port = 30000`,
        );
      } catch (error) {
        console.error(`Error auto-syncing device ${sn}:`, error);
      }
    }

    // Return OK (no commands to send)
    return "OK";
  }

  /**
   * Auto-sync device details when device connects
   */
  private async autoSyncDeviceDetails(sn: string): Promise<void> {
    try {
      console.log(`🔄 Auto-syncing device details for ${sn}...`);

      // Check if device exists in our in-memory storage
      const existingDevice = this.devices.get(sn);

      if (existingDevice) {
        // Update device status and last seen
        existingDevice.status = "online";
        existingDevice.lastSeen = new Date();
        this.devices.set(sn, existingDevice);
        console.log(`✅ Device ${sn} status updated to online`);
      } else {
        // Create new device record if not exists
        const newDevice: ZKTecoDevice = {
          id: `device_${sn}`,
          name: `ZKTeco Device ${sn}`,
          serialNumber: sn,
          status: "online",
          lastSeen: new Date(),
          model: "UFace 800",
          ip: "192.168.2.202", // Default IP, can be updated later
          port: 4370,
          password: "",
          isActive: true,
        };
        this.devices.set(sn, newDevice);
        console.log(`✅ New device ${sn} created in memory`);
      }

      // Try to fetch additional device info if possible
      try {
        const deviceInfo = await this.getDeviceInfo(sn);
        if (deviceInfo && existingDevice) {
          existingDevice.model = deviceInfo.model || existingDevice.model;
          existingDevice.info = deviceInfo;
          this.devices.set(sn, existingDevice);
          console.log(`✅ Device ${sn} info updated`);
        }
      } catch (infoError) {
        console.log(
          `ℹ️ Could not fetch detailed info for device ${sn}:`,
          (infoError as Error).message,
        );
      }
    } catch (error) {
      console.error(`❌ Error auto-syncing device ${sn}:`, error);
      throw error;
    }
  }

  /**
   * Handle iClock ping (device heartbeat)
   */
  async handleIClockPing(sn: string): Promise<string> {
    console.log(`Device ${sn} ping`);

    // Update device status
    if (sn) {
      try {
        // Update last seen timestamp in memory
        const device = this.devices.get(sn);

        if (device) {
          device.lastSeen = new Date();
          device.status = "online";
          this.devices.set(sn, device);
          console.log(`💓 Device ${sn} heartbeat - status updated`);
        }
      } catch (error) {
        console.error(`Error updating device ${sn} heartbeat:`, error);
      }
    }

    return "OK";
  }

  /**
   * Handle iClock cdata (device uploading data)
   */
  async handleIClockCData(
    sn: string,
    table: string,
    postData: Buffer,
  ): Promise<string> {
    console.log(`Device ${sn} uploading ${table} data`);

    try {
      // Auto-sync device status when data is received
      await this.autoSyncDeviceDetails(sn);

      if (table === "ATTLOG") {
        await this.processIClockAttendanceData(sn, postData);
      } else if (table === "USER") {
        console.log(`Processing user data from ${sn}`);
        // Handle user data if needed
      } else if (table === "OPERLOG") {
        console.log(`Processing operation log from ${sn}`);
        // Handle operation log if needed
      } else {
        console.log(`Unknown table type: ${table}`);
      }

      return "OK";
    } catch (error) {
      console.error(`Error processing ${table} data:`, error);
      throw error;
    }
  }

  /**
   * Process iClock attendance data (tab-separated format)
   */
  private async processIClockAttendanceData(
    deviceSn: string,
    data: Buffer,
  ): Promise<void> {
    if (!data || data.length === 0) {
      return;
    }

    try {
      // ZKTeco attendance data format: PIN\tDateTime\tStatus\tVerify\tWorkCode\tReserved
      const dataStr = data.toString("utf-8").trim();
      if (!dataStr) {
        return;
      }

      const lines = dataStr.split("\n");
      let recordsProcessed = 0;

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        try {
          // Parse attendance record
          const parts = trimmedLine.split("\t");
          if (parts.length >= 4) {
            const userId = parts[0];
            const timestampStr = parts[1];
            const status = parts[2] || "1";
            const verify = parts[3] || "1";
            const workCode = parts[4] || "0";

            // Convert timestamp - device sends local PKT time (UTC+5)
            let timestamp: Date;
            try {
              const isoStr = timestampStr.trim().replace(" ", "T");
              timestamp = new Date(isoStr + "+05:00");
              if (isNaN(timestamp.getTime())) {
                throw new Error("Invalid date format");
              }
            } catch (e) {
              console.warn(`Invalid timestamp format: ${timestampStr}`);
              continue;
            }

            // Create attendance data object
            const attendanceData = {
              employeeId: userId,
              timestamp: timestamp,
              checkType: this.determineCheckType(status),
              deviceId: deviceSn,
              verifyType: parseInt(verify),
            };

            console.log(`🔄 Processing attendance record:`, {
              employeeId: attendanceData.employeeId,
              timestamp: attendanceData.timestamp.toISOString(),
              checkType: attendanceData.checkType,
              deviceId: attendanceData.deviceId,
              verifyType: attendanceData.verifyType,
            });

            // Process the attendance data (this will save to DB and emit live updates)
            await this.processZKTecoAttendanceData(
              attendanceData,
              this.devices.get(deviceSn)?.ip || "192.168.2.202",
            );
            recordsProcessed++;
          }
        } catch (error) {
          console.warn(
            `Error parsing attendance line '${trimmedLine}':`,
            error,
          );
          continue;
        }
      }

      console.log(
        `✅ Processed ${recordsProcessed} attendance records from ${deviceSn}`,
      );
      console.log(`📊 Processing completed at: ${new Date().toISOString()}`);
    } catch (error) {
      console.error("❌ Error processing iClock attendance data:", error);
      throw error;
    }
  }

  /**
   * Determine check type from status code
   */
  private determineCheckType(status: string): "check_in" | "check_out" {
    // ZKTeco status codes:
    // 0 = Check In, 1 = Check Out, 2 = Break Out, 3 = Break In, 4 = OT In, 5 = OT Out
    const statusCode = parseInt(status);
    return statusCode === 0 || statusCode === 3 || statusCode === 4
      ? "check_in"
      : "check_out";
  }

  /**
   * Handle progressive deductions and update employee leaves
   * 3 LATE = 1 HALF_DAY_LEAVE deduction
   * 2 HALF_DAY_LEAVE = 1 FULL_DAY_LEAVE deduction (from casual leaves)
   * PLUS: Automatic deduction for FULL_DAY_LEAVE status
   */
  private async handleProgressiveDeductions(
    employeeId: string,
    attendanceId: string,
  ): Promise<void> {
    try {
      // Get recent statuses that haven't been used for deductions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const unusedLateRecords = await prisma.zKTecoAttendanceRecord.findMany({
        where: {
          userId: employeeId,
          timestamp: { gte: thirtyDaysAgo },
          overallStatus: "LATE",
          usedForDeduction: false, // Only get records not used for deductions
        },
        select: { id: true, timestamp: true, overallStatus: true },
        orderBy: { timestamp: "asc" },
      });

      const unusedHalfDayRecords = await prisma.zKTecoAttendanceRecord.findMany(
        {
          where: {
            userId: employeeId,
            timestamp: { gte: thirtyDaysAgo },
            overallStatus: "HALF_DAY_LEAVE",
            usedForDeduction: false, // Only get records not used for deductions
          },
          select: { id: true, timestamp: true, overallStatus: true },
          orderBy: { timestamp: "asc" },
        },
      );

      // NEW: Get today's FULL_DAY_LEAVE records for automatic deduction
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const todayFullDayLeaveRecords =
        await prisma.zKTecoAttendanceRecord.findMany({
          where: {
            userId: employeeId,
            overallStatus: "FULL_DAY_LEAVE",
            timestamp: {
              gte: todayStart,
              lt: todayEnd,
            },
            usedForDeduction: false, // Only get records not used for deductions
          },
          select: {
            id: true,
            timestamp: true,
            overallStatus: true,
            checkType: true,
          },
          orderBy: { timestamp: "asc" },
        });

      console.log(
        `📊 Employee ${employeeId} - Unused Late: ${unusedLateRecords.length}, Unused Half Day: ${unusedHalfDayRecords.length}, Today FULL_DAY_LEAVE: ${todayFullDayLeaveRecords.length}`,
      );

      // NEW: Automatic deduction for FULL_DAY_LEAVE status
      if (todayFullDayLeaveRecords.length > 0) {
        console.log(
          `🚫 Processing automatic deduction for ${todayFullDayLeaveRecords.length} FULL_DAY_LEAVE record(s)`,
        );

        for (const record of todayFullDayLeaveRecords) {
          // Mark this record as used for deduction
          await this.markRecordsAsUsedForDeduction([record.id]);

          // Apply 1 day deduction from casual leaves
          await this.deductFromLeavePolicy(
            employeeId,
            1.0,
            "FULL_DAY_LEAVE_AUTOMATIC",
          );

          // Create deduction record
          await this.createAttendanceDeduction(
            attendanceId,
            `Automatic deduction for FULL_DAY_LEAVE status (${record.checkType})`,
            1.0, // Full day
            employeeId,
            [record.id],
            "FULL_DAY_LEAVE_AUTOMATIC",
          );

          console.log(
            `⚠️ Applied automatic FULL_DAY_LEAVE deduction for employee ${employeeId}. Record: ${record.id}`,
          );
        }
      }

      // Check for 3 LATE = 1 HALF_DAY_LEAVE deduction
      if (unusedLateRecords.length >= 3) {
        // Take the first 3 unused late records
        const recordsToUse = unusedLateRecords.slice(0, 3);
        const recordIds = recordsToUse.map((r: any) => r.id);

        await this.createAttendanceDeduction(
          attendanceId,
          "3 Late arrivals converted to Half Day Leave deduction",
          0.5, // Half day
          employeeId,
          recordIds,
          "LATE_TO_HALF_DAY",
        );

        // Mark these records as used for deduction
        await this.markRecordsAsUsedForDeduction(recordIds);

        // Deduct from leave policy
        await this.deductFromLeavePolicy(employeeId, 0.5, "LATE_TO_HALF_DAY");

        console.log(
          `⚠️ Applied Half Day deduction for 3 late arrivals to employee ${employeeId}. Records: ${recordIds.join(
            ", ",
          )}`,
        );
      }

      // Check for 2 HALF_DAY_LEAVE = 1 FULL_DAY_LEAVE deduction
      if (unusedHalfDayRecords.length >= 2) {
        // Take the first 2 unused half day records
        const recordsToUse = unusedHalfDayRecords.slice(0, 2);
        const recordIds = recordsToUse.map((r: any) => r.id);

        await this.createAttendanceDeduction(
          attendanceId,
          "2 Half Day leaves converted to Full Day Leave deduction",
          1.0, // Full day
          employeeId,
          recordIds,
          "HALF_DAY_TO_FULL_DAY",
        );

        // Mark these records as used for deduction
        await this.markRecordsAsUsedForDeduction(recordIds);

        // Deduct from leave policy
        await this.deductFromLeavePolicy(employeeId, 1, "HALF_DAY_TO_FULL_DAY");

        console.log(
          `⚠️ Applied Full Day deduction and deducted from casual leaves for employee ${employeeId}. Records: ${recordIds.join(
            ", ",
          )}`,
        );
      }
    } catch (error) {
      console.error("Error handling progressive deductions:", error);
    }
  }

  /**
   * Create an attendance deduction record with tracking
   */
  private async createAttendanceDeduction(
    attendanceId: string,
    reason: string,
    deductValue: number,
    employeeId: string,
    zktecoRecordIds: string[],
    deductionType: string,
  ): Promise<void> {
    // Get employee's leave record ID

    const employeeLeave = await prisma.employeeLeave.findUnique({
      where: { userId: employeeId },
    });

    await prisma.attendanceDeduction.create({
      data: {
        attendanceId,
        deductionReason: reason,
        deductValue,
        leaveId: employeeLeave?.id || null,
        datetime: new Date(),
        zktecoRecordIds: JSON.stringify(zktecoRecordIds), // Store which records triggered this
        deductionType,
      },
    });
  }

  /**
   * Mark ZKTeco records as used for deduction to prevent duplicate processing
   */
  private async markRecordsAsUsedForDeduction(
    recordIds: string[],
  ): Promise<void> {
    await prisma.zKTecoAttendanceRecord.updateMany({
      where: {
        id: { in: recordIds },
      },
      data: {
        usedForDeduction: true,
        deductionAppliedAt: new Date(),
      },
    });
  }

  /**
   * Deduct from employee's leave policy based on attendance violation type
   */
  private async deductFromLeavePolicy(
    employeeId: string,
    daysToDeduct: number,
    violationType:
      | "LATE_TO_HALF_DAY"
      | "HALF_DAY_TO_FULL_DAY"
      | "FULL_DAY_LEAVE_AUTOMATIC",
  ): Promise<void> {
    try {
      // Get employee's leave policy and current balances
      const employeeLeave = await prisma.employeeLeave.findUnique({
        where: { userId: employeeId },
        include: {
          user: {
            include: {
              leavePolicy: true, // Include the assigned leave policy
            },
          },
        },
      });

      if (!employeeLeave) {
        console.warn(
          `❌ No employee leave record found for user ${employeeId}`,
        );
        return;
      }

      if (!employeeLeave.user.leavePolicy) {
        console.warn(`❌ No leave policy assigned to user ${employeeId}`);
        return;
      }

      const leavePolicy = employeeLeave.user.leavePolicy;
      console.log(`📋 Leave policy for ${employeeId}: ${leavePolicy.name}`);

      // Determine which leave category to deduct from based on violation type
      let leaveCategory: string = "";
      let currentBalance: number = 0;
      let newBalance: number = 0;

      if (violationType === "LATE_TO_HALF_DAY") {
        // For 3 LATE = 0.5 day deduction, prefer casual leaves first
        if (employeeLeave.casualLeaves >= daysToDeduct) {
          leaveCategory = "casualLeaves";
          currentBalance = employeeLeave.casualLeaves;
          newBalance = Math.max(0, currentBalance - daysToDeduct);

          await prisma.employeeLeave.update({
            where: { userId: employeeId },
            data: { casualLeaves: newBalance },
          });
        } else if (employeeLeave.annualLeaves >= daysToDeduct) {
          // Fallback to annual leaves if casual leaves insufficient
          leaveCategory = "annualLeaves";
          currentBalance = employeeLeave.annualLeaves;
          newBalance = Math.max(0, currentBalance - daysToDeduct);

          await prisma.employeeLeave.update({
            where: { userId: employeeId },
            data: { annualLeaves: newBalance },
          });
        } else {
          console.warn(
            `⚠️ Insufficient leave balance for deduction. Casual: ${employeeLeave.casualLeaves}, Annual: ${employeeLeave.annualLeaves}`,
          );
          return;
        }
      } else if (violationType === "HALF_DAY_TO_FULL_DAY") {
        // For 2 HALF_DAY_LEAVE = 1 day deduction, prefer annual leaves
        if (employeeLeave.annualLeaves >= daysToDeduct) {
          leaveCategory = "annualLeaves";
          currentBalance = employeeLeave.annualLeaves;
          newBalance = Math.max(0, currentBalance - daysToDeduct);

          await prisma.employeeLeave.update({
            where: { userId: employeeId },
            data: { annualLeaves: newBalance },
          });
        } else if (employeeLeave.casualLeaves >= daysToDeduct) {
          // Fallback to casual leaves if annual leaves insufficient
          leaveCategory = "casualLeaves";
          currentBalance = employeeLeave.casualLeaves;
          newBalance = Math.max(0, currentBalance - daysToDeduct);

          await prisma.employeeLeave.update({
            where: { userId: employeeId },
            data: { casualLeaves: newBalance },
          });
        } else {
          console.warn(
            `⚠️ Insufficient leave balance for deduction. Annual: ${employeeLeave.annualLeaves}, Casual: ${employeeLeave.casualLeaves}`,
          );
          return;
        }
      } else if (violationType === "FULL_DAY_LEAVE_AUTOMATIC") {
        // NEW: For FULL_DAY_LEAVE status, always deduct from casual leaves
        if (employeeLeave.casualLeaves >= daysToDeduct) {
          leaveCategory = "casualLeaves";
          currentBalance = employeeLeave.casualLeaves;
          newBalance = Math.max(0, currentBalance - daysToDeduct);

          await prisma.employeeLeave.update({
            where: { userId: employeeId },
            data: { casualLeaves: newBalance },
          });
        } else if (employeeLeave.annualLeaves >= daysToDeduct) {
          // Fallback to annual leaves if casual leaves insufficient
          leaveCategory = "annualLeaves";
          currentBalance = employeeLeave.annualLeaves;
          newBalance = Math.max(0, currentBalance - daysToDeduct);

          await prisma.employeeLeave.update({
            where: { userId: employeeId },
            data: { annualLeaves: newBalance },
          });
        } else {
          console.warn(
            `⚠️ Insufficient leave balance for FULL_DAY_LEAVE deduction. Casual: ${employeeLeave.casualLeaves}, Annual: ${employeeLeave.annualLeaves}`,
          );
          return;
        }
      }

      console.log(
        `📉 Deducted ${daysToDeduct} day(s) from ${leaveCategory}. Old balance: ${currentBalance}, New balance: ${newBalance}`,
      );

      // Log the deduction details for audit
      console.log(
        `📊 Leave deduction applied: ${violationType} → ${daysToDeduct} day(s) from ${leaveCategory}`,
      );

      // Also log the updated leave balance summary
      const updatedBalance = await prisma.employeeLeave.findUnique({
        where: { userId: employeeId },
        select: {
          annualLeaves: true,
          casualLeaves: true,
          sickLeaves: true,
        },
      });

      if (updatedBalance) {
        console.log(
          `📊 Updated leave balance for ${employeeId}: Annual: ${updatedBalance.annualLeaves}, Casual: ${updatedBalance.casualLeaves}, Sick: ${updatedBalance.sickLeaves}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Error deducting from leave policy for user ${employeeId}:`,
        error,
      );
    }
  }

  /**
   * Debug function: Check attendance records for a specific employee and date
   */
  public async debugAttendanceRecords(
    employeeId: string,
    date: string,
  ): Promise<any> {
    try {
      const targetDate = new Date(date);
      const dateOnly = new Date(
        Date.UTC(
          targetDate.getUTCFullYear(),
          targetDate.getUTCMonth(),
          targetDate.getUTCDate(),
        ),
      );

      console.log(
        `🔍 Debug: Searching for attendance on ${dateOnly.toISOString()}`,
      );

      // Get attendance record
      const attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employeeId,
          date: dateOnly,
        },
      });

      // Get all ZKTeco records for this employee on this date
      const zktecoRecords = await prisma.zKTecoAttendanceRecord.findMany({
        where: {
          userId: employeeId,
          timestamp: {
            gte: dateOnly,
            lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      return {
        date: dateOnly.toISOString(),
        attendance: attendance
          ? {
              id: attendance.id,
              date: attendance.date?.toISOString(),
              checkIn: attendance.checkIn?.toISOString(),
              checkOut: attendance.checkOut?.toISOString(),
              deviceCheckIns: attendance.deviceCheckIns,
              deviceCheckOuts: attendance.deviceCheckOuts,
              totalHours: attendance.totalHours,
            }
          : null,
        zktecoRecords: zktecoRecords.map((record: any) => ({
          id: record.id,
          timestamp: record.timestamp.toISOString(),
          checkType: record.checkType,
          overallStatus: record.overallStatus,
          processed: record.processed,
          processingError: record.processingError,
        })),
        summary: {
          totalRecords: zktecoRecords.length,
          checkIns: zktecoRecords.filter((r: any) => r.checkType === "check_in")
            .length,
          checkOuts: zktecoRecords.filter(
            (r: any) => r.checkType === "check_out",
          ).length,
          processed: zktecoRecords.filter((r: any) => r.processed).length,
          errors: zktecoRecords.filter((r: any) => r.processingError).length,
        },
      };
    } catch (error) {
      console.error(`❌ Error debugging attendance records:`, error);
      return null;
    }
  }

  /**
   * Fix attendance records by processing unprocessed ZKTeco records
   */
  public async fixAttendanceRecords(
    employeeId: string,
    date: string,
  ): Promise<any> {
    try {
      const targetDate = new Date(date);
      const dateOnly = new Date(
        Date.UTC(
          targetDate.getUTCFullYear(),
          targetDate.getUTCMonth(),
          targetDate.getUTCDate(),
        ),
      );

      console.log(
        `🔧 Fix: Processing attendance for ${employeeId} on ${dateOnly.toISOString()}`,
      );

      // Get all unprocessed ZKTeco records for this employee on this date
      const unprocessedRecords = await prisma.zKTecoAttendanceRecord.findMany({
        where: {
          userId: employeeId,
          processed: false,
          timestamp: {
            gte: dateOnly,
            lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      console.log(`🔧 Found ${unprocessedRecords.length} unprocessed records`);

      let fixedCount = 0;
      for (const record of unprocessedRecords) {
        try {
          // Process each unprocessed record
          const attendanceData = {
            employeeId: record.employeeId || "",
            timestamp: record.timestamp,
            checkType: record.checkType as "check_in" | "check_out",
            deviceId: record.deviceId,
            verifyType: record.verifyType,
            workCode: record.workCode,
          };

          const result = await this.processZKTecoAttendanceData(
            attendanceData,
            record.deviceId,
          );
          if (result) {
            fixedCount++;
            console.log(`✅ Fixed record ${record.id}`);
          }
        } catch (error) {
          console.error(`❌ Error fixing record ${record.id}:`, error);
        }
      }

      // Get updated attendance record
      const updatedAttendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employeeId,
          date: dateOnly,
        },
      });

      return {
        date: dateOnly.toISOString(),
        processedRecords: fixedCount,
        totalUnprocessed: unprocessedRecords.length,
        updatedAttendance: updatedAttendance
          ? {
              id: updatedAttendance.id,
              checkIn: updatedAttendance.checkIn?.toISOString(),
              checkOut: updatedAttendance.checkOut?.toISOString(),
              deviceCheckIns: updatedAttendance.deviceCheckIns,
              deviceCheckOuts: updatedAttendance.deviceCheckOuts,
              totalHours: updatedAttendance.totalHours,
            }
          : null,
      };
    } catch (error) {
      console.error(`❌ Error fixing attendance records:`, error);
      return null;
    }
  }

  /**
   * Get employee's current leave balance summary
   */
  public async getEmployeeLeaveBalance(employeeId: string): Promise<any> {
    try {
      const employeeLeave = await prisma.employeeLeave.findUnique({
        where: { userId: employeeId },
        include: {
          user: {
            include: {
              leavePolicy: true,
            },
          },
        },
      });

      if (!employeeLeave) {
        return null;
      }

      return {
        employeeId,
        employeeName: `${employeeLeave.user.firstName} ${employeeLeave.user.lastName}`,
        leavePolicy:
          employeeLeave.user.leavePolicy?.name || "No Policy Assigned",
        currentBalance: {
          annualLeaves: employeeLeave.annualLeaves,
          casualLeaves: employeeLeave.casualLeaves,
          sickLeaves: employeeLeave.sickLeaves,
        },
        policyLimits: employeeLeave.user.leavePolicy
          ? {
              annualLeaves: employeeLeave.user.leavePolicy.annualLeaves,
              casualLeaves: employeeLeave.user.leavePolicy.casualLeaves,
              sickLeaves: employeeLeave.user.leavePolicy.sickLeaves,
            }
          : null,
      };
    } catch (error) {
      console.error(
        `❌ Error getting leave balance for user ${employeeId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get deduction history for an employee with details of which records triggered deductions
   */
  public async getEmployeeDeductionHistory(employeeId: string): Promise<any[]> {
    const deductions = await prisma.attendanceDeduction.findMany({
      where: {
        attendance: {
          some: {
            employeeId: employeeId,
          },
        },
      },
      orderBy: {
        datetime: "desc",
      },
    });
    console.log("deductions", deductions);

    // Enhance with ZKTeco record details
    const enhancedDeductions = await Promise.all(
      deductions.map(async (deduction: any) => {
        let triggeringRecords: any[] = [];

        if (deduction.zktecoRecordIds) {
          try {
            const recordIds = JSON.parse(deduction.zktecoRecordIds);
            triggeringRecords = await prisma.zKTecoAttendanceRecord.findMany({
              where: {
                id: { in: recordIds },
              },
              select: {
                id: true,
                timestamp: true,
                overallStatus: true,
                checkType: true,
              },
            });
          } catch (error) {
            console.error("Error parsing zktecoRecordIds:", error);
          }
        }

        return {
          ...deduction,
          triggeringRecords,
        };
      }),
    );

    return enhancedDeductions;
  }

  /**
   * Validate if specific records have already been used for deductions
   */
  public async validateRecordsForDeduction(recordIds: string[]): Promise<{
    canUse: boolean;
    alreadyUsed: string[];
    available: string[];
  }> {
    const records = await prisma.zKTecoAttendanceRecord.findMany({
      where: {
        id: { in: recordIds },
      },
      select: {
        id: true,
        usedForDeduction: true,
        deductionAppliedAt: true,
        overallStatus: true,
      },
    });

    const alreadyUsed = records
      .filter((r: any) => r.usedForDeduction)
      .map((r: any) => r.id);
    const available = records
      .filter((r: any) => !r.usedForDeduction)
      .map((r: any) => r.id);

    return {
      canUse: alreadyUsed.length === 0,
      alreadyUsed,
      available,
    };
  }

  /**
   * Calculate precise attendance status based on shift timing rules
   */
  private calculatePreciseAttendanceStatus(
    checkType: string,
    timestamp: Date,
    shift: any,
  ): string | null {
    if (!shift) return null;
    console.log("Calculating precise attendance status");

    const checkTime = new Date(timestamp);
    console.log("checkTime", checkTime);
    const attendanceDate = new Date(timestamp);
    console.log("attendanceDate", attendanceDate);

    // Extract times from shift (these are stored as full DateTime in DB)
    const shiftStart = new Date(shift.startTime); // st (start time)
    console.log("shiftStart", shiftStart);
    const halfDayStart = shift.halfDayStart
      ? new Date(shift.halfDayStart)
      : null; // hfs
    console.log("halfDayStart", halfDayStart);
    const fullDayStart = shift.fullDayStart
      ? new Date(shift.fullDayStart)
      : null; // fds
    console.log("fullDayStart", fullDayStart);
    const earlyOut = shift.earlyOut ? new Date(shift.earlyOut) : null; // eo
    console.log("earlyOut", earlyOut);
    const shiftEnd = new Date(shift.endTime); // et (end time)
    console.log("shiftEnd", shiftEnd);
    // Create today's shift times by copying time from shift to attendance date
    const todayShiftStart = new Date(attendanceDate);
    todayShiftStart.setHours(
      shiftStart.getHours(),
      shiftStart.getMinutes(),
      0,
      0,
    );
    console.log("todayShiftStart", todayShiftStart);
    const todayHalfDayStart = halfDayStart ? new Date(attendanceDate) : null;
    if (todayHalfDayStart && halfDayStart) {
      todayHalfDayStart.setHours(
        halfDayStart.getHours(),
        halfDayStart.getMinutes(),
        0,
        0,
      );
    }
    console.log("todayHalfDayStart", todayHalfDayStart);
    const todayFullDayStart = fullDayStart ? new Date(attendanceDate) : null;
    if (todayFullDayStart && fullDayStart) {
      todayFullDayStart.setHours(
        fullDayStart.getHours(),
        fullDayStart.getMinutes(),
        0,
        0,
      );
    }
    console.log("todayFullDayStart", todayFullDayStart);
    const todayEarlyOut = earlyOut ? new Date(attendanceDate) : null;
    if (todayEarlyOut && earlyOut) {
      todayEarlyOut.setHours(earlyOut.getHours(), earlyOut.getMinutes(), 0, 0);
    }
    console.log("todayEarlyOut", todayEarlyOut);
    const todayShiftEnd = new Date(attendanceDate);
    todayShiftEnd.setHours(shiftEnd.getHours(), shiftEnd.getMinutes(), 0, 0);
    console.log("todayShiftEnd", todayShiftEnd);
    if (checkType === "check_in") {
      const toa = checkTime; // Time of arrival
      console.log("toa", toa);
      // On time arrival = toa < st
      if (toa < todayShiftStart) {
        return "ON_TIME_ARRIVAL"; //ok
      }
      console.log("toa < todayShiftStart", toa < todayShiftStart);
      // late = toa >= st && < hfs
      if (
        todayHalfDayStart &&
        toa >= todayShiftStart &&
        toa < todayHalfDayStart
      ) {
        return "LATE"; //ok
      }

      // half day leave = toa >= hfs && < fds (on basis of toa)
      if (
        todayHalfDayStart &&
        todayFullDayStart &&
        toa >= todayHalfDayStart &&
        toa < todayFullDayStart
      ) {
        return "HALF_DAY_LEAVE"; //ok
      }
      /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      // full day leave = toa >= fds (on basis of toa) - will be validated with checkout time
      if (todayFullDayStart && toa >= todayFullDayStart) {
        // This is a potential FULL_DAY_LEAVE, but we need to check checkout time
        // The final status will be determined in the main processing logic
        return "FULL_DAY_LEAVE_POTENTIAL";
      }

      // If no half day or full day start times defined, just check late
      if (!todayHalfDayStart && toa >= todayShiftStart) {
        return "LATE";
      }
    } else if (checkType === "check_out") {
      const tol = checkTime; // Time of leave

      // half day leave = tol >= fds && < eo (on basis of tol)
      if (
        todayFullDayStart &&
        todayEarlyOut &&
        tol >= todayFullDayStart &&
        tol < todayEarlyOut
      ) {
        return "HALF_DAY_LEAVE";
      }

      // full day leave = tol < fds && > st (on basis of tol) - updated rule
      if (
        todayFullDayStart &&
        todayShiftStart &&
        tol < todayFullDayStart &&
        tol > todayShiftStart
      ) {
        return "FULL_DAY_LEAVE";
      }

      // early out = tol < eo
      if (todayEarlyOut && tol >= todayEarlyOut && tol < todayShiftEnd) {
        return "EARLY_OUT";
      }

      // On time leave = tol >= eo (normal end time or later)
      if (todayEarlyOut && tol >= todayShiftEnd) {
        return "ON_TIME_LEAVE";
      }

      // If no early out time defined, check against shift end
      if (!todayEarlyOut && tol >= todayShiftEnd) {
        return "ON_TIME_LEAVE";
      }
    }

    return null; // No specific status determined
  }

  /**
   * Enhanced process attendance data with ZKTeco validation and new schema
   */
  public async processZKTecoAttendanceData(
    attendanceData: AttendanceData,
    deviceIp: string,
  ): Promise<boolean> {
    try {
      console.log("🔄 Processing ZKTeco attendance data:", attendanceData);

      // Step 1: Save to STAGING table first (3-day delay before finalization)
      // Store all timestamps as PKT in the database so DB values match wall-clock time
      const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
      const pktNow = () => new Date(Date.now() + PKT_OFFSET_MS);
      const pktTimestamp = new Date(attendanceData.timestamp.getTime() + PKT_OFFSET_MS);

      const stagingRecord = await prisma.zKTecoAttendanceStaging.create({
        data: {
          employeeId: attendanceData.employeeId,
          deviceId: attendanceData.deviceId,
          timestamp: pktTimestamp,
          checkType: attendanceData.checkType,
          verifyType: attendanceData.verifyType,
          workCode: (attendanceData as any).workCode || null,
          processed: false,
          isFinalized: false,
          createdAt: pktNow(),
          updatedAt: pktNow(),
        },
      });

      console.log(
        `📝 Staging record saved with ID: ${stagingRecord.id} (will finalize after 3 days)`,
      );

      // Step 2: Find employee by employeeId (ZKTeco internal ID) with shift information
      const employee = await prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: attendanceData.employeeId },
            { id: attendanceData.employeeId },
          ],
        },
        include: {
          shift: true, // Include shift data for status calculation
        },
      });

      if (!employee) {
        await prisma.zKTecoAttendanceStaging.update({
          where: { id: stagingRecord.id },
          data: {
            processingError: `Employee not found for ID: ${attendanceData.employeeId}`,
            overallStatus: "ABSENT",
            updatedAt: pktNow(),
          },
        });
        console.warn(
          `❌ Employee not found for ID: ${attendanceData.employeeId}`,
        );
        return false;
      }

      // Step 3: Calculate precise attendance status based on shift rules
      let calculatedStatus = this.calculatePreciseAttendanceStatus(
        attendanceData.checkType,
        attendanceData.timestamp,
        employee.shift,
      );

      // Special handling for FULL_DAY_LEAVE_POTENTIAL from check-in
      if (calculatedStatus === "FULL_DAY_LEAVE_POTENTIAL") {
        // Check if this is a check-in with potential for FULL_DAY_LEAVE
        // We need to see if there's a corresponding check-out that meets the criteria
        console.log(`🔍 Check-in has FULL_DAY_LEAVE_POTENTIAL status`);
        // Temporarily use FULL_DAY_LEAVE to avoid database error
        calculatedStatus = "FULL_DAY_LEAVE";
      }

      console.log(
        `📊 Calculated status for ${employee.firstName} ${employee.lastName}: ${
          calculatedStatus || "No specific status"
        }`,
      );

      // Step 4: Update the staging record with calculated status
      await prisma.zKTecoAttendanceStaging.update({
        where: { id: stagingRecord.id },
        data: {
          userId: employee.id,
          overallStatus: calculatedStatus as any,
          updatedAt: pktNow(),
        },
      });

      // Step 4.1: Validate FULL_DAY_LEAVE_POTENTIAL with checkout time
      if (
        calculatedStatus === "FULL_DAY_LEAVE_POTENTIAL" &&
        attendanceData.checkType === "check_in"
      ) {
        // This is a check-in with potential for FULL_DAY_LEAVE
        // We need to check if there's a corresponding check-out that meets the criteria
        console.log(`🔍 Validating FULL_DAY_LEAVE_POTENTIAL for check-in`);

        // The final status will be determined when the check-out record is processed
        // For now, mark it as potential
        calculatedStatus = "FULL_DAY_LEAVE_POTENTIAL";
      }

      // Step 4.1: Bidirectional FULL_DAY_LEAVE deduction tracking
      const attendanceDate = new Date(attendanceData.timestamp);
      const todayDateOnly = new Date(
        Date.UTC(
          attendanceDate.getFullYear(),
          attendanceDate.getMonth(),
          attendanceDate.getDate(),
        ),
      );

      if (attendanceData.checkType === "check_out") {
        // Check if there's a check-in record for today with FULL_DAY_LEAVE_POTENTIAL or FULL_DAY_LEAVE status
        const todayCheckIn = await prisma.zKTecoAttendanceStaging.findFirst({
          where: {
            userId: employee.id,
            checkType: "check_in",
            overallStatus: {
              in: ["FULL_DAY_LEAVE", "FULL_DAY_LEAVE_POTENTIAL"],
            },
            timestamp: {
              gte: new Date(todayDateOnly.getTime()),
              lt: new Date(todayDateOnly.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        // If check-in has FULL_DAY_LEAVE_POTENTIAL, validate the complete condition
        if (
          todayCheckIn?.overallStatus === "FULL_DAY_LEAVE_POTENTIAL" ||
          todayCheckIn?.overallStatus === "FULL_DAY_LEAVE"
        ) {
          console.log(`🔍 Validating complete FULL_DAY_LEAVE condition`);

          // Get shift times for validation
          const shift = employee.shift;
          if (shift) {
            // checkInTime from DB is already PKT-as-UTC; convert checkOutTime to match
            const checkInTime = new Date(todayCheckIn.timestamp);
            const checkOutTime = new Date(attendanceData.timestamp.getTime() + PKT_OFFSET_MS);

            // Create today's shift times using setUTCHours with PKT hours
            // (shift.startTime stored as real UTC, .getHours() returns PKT local hour)
            const todayShiftStart = new Date(todayDateOnly);
            todayShiftStart.setUTCHours(
              new Date(shift.startTime).getHours(),
              new Date(shift.startTime).getMinutes(),
              0,
              0,
            );

            const todayFullDayStart = new Date(todayDateOnly);
            if (shift.fullDayStart) {
              todayFullDayStart.setUTCHours(
                new Date(shift.fullDayStart).getHours(),
                new Date(shift.fullDayStart).getMinutes(),
                0,
                0,
              );
            }

            // Validate: toa >= fds AND tol < fds && > st
            const toaValid = checkInTime >= todayFullDayStart;
            const tolValid =
              checkOutTime < todayFullDayStart &&
              checkOutTime > todayShiftStart;

            if (toaValid && tolValid) {
              console.log(
                `✅ FULL_DAY_LEAVE condition validated: toa >= fds AND tol < fds && > st`,
              );

              // Update check-in record to confirmed FULL_DAY_LEAVE
              await prisma.zKTecoAttendanceStaging.update({
                where: { id: todayCheckIn.id },
                data: {
                  overallStatus: "FULL_DAY_LEAVE",
                  updatedAt: pktNow(),
                },
              });

              // Update current check-out record to confirmed FULL_DAY_LEAVE
              await prisma.zKTecoAttendanceStaging.update({
                where: { id: stagingRecord.id },
                data: {
                  overallStatus: "FULL_DAY_LEAVE",
                  updatedAt: pktNow(),
                },
              });

              calculatedStatus = "FULL_DAY_LEAVE";
            } else {
              console.log(`❌ FULL_DAY_LEAVE condition not met:`, {
                toaValid,
                tolValid,
                checkInTime: checkInTime.toISOString(),
                checkOutTime: checkOutTime.toISOString(),
                shiftStart: todayShiftStart.toISOString(),
                fullDayStart: todayFullDayStart.toISOString(),
              });

              // Reset to normal status
              calculatedStatus = "ON_TIME_LEAVE";
            }
          }
        }

        // NEW: Handle case where check-out itself has FULL_DAY_LEAVE status
        if (
          calculatedStatus === "FULL_DAY_LEAVE" &&
          attendanceData.checkType === "check_out"
        ) {
          console.log(
            `🚫 Check-out has FULL_DAY_LEAVE status: Marking both records for deduction`,
          );

          // Mark current check-out record with processing error (deduction tracking only in final table)
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: stagingRecord.id },
            data: {
              processingError: "Marked for FULL_DAY_LEAVE deduction",
              updatedAt: pktNow(),
            },
          });

          // Mark corresponding check-in record with processing error
          if (todayCheckIn) {
            await prisma.zKTecoAttendanceStaging.update({
              where: { id: todayCheckIn.id },
              data: {
                processingError: "Marked for FULL_DAY_LEAVE deduction",
                updatedAt: pktNow(),
              },
            });
            console.log(
              `✅ Marked check-in record ${todayCheckIn.id} as used for deduction`,
            );
          } else {
            console.log(`⚠️ No check-in record found to mark for deduction`);
          }

          console.log(
            `✅ Both check-in and check-out records marked as used for deduction`,
          );
        }

        if (
          todayCheckIn &&
          todayCheckIn.overallStatus === "FULL_DAY_LEAVE" &&
          calculatedStatus !== "FULL_DAY_LEAVE"
        ) {
          console.log(
            `🚫 Checkout blocked for ${employee.firstName} ${employee.lastName} - Check-in was FULL_DAY_LEAVE`,
          );

          // Mark this checkout record as blocked
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: stagingRecord.id },
            data: {
              overallStatus: todayCheckIn.overallStatus,
              processingError:
                "Checkout blocked - Check-in was FULL_DAY_LEAVE (deduction in final table)",
              updatedAt: pktNow(),
            },
          });

          // Mark the check-in record with processing note
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: todayCheckIn.id },
            data: {
              processingError:
                "Marked for FULL_DAY_LEAVE deduction (will apply in final table)",
              updatedAt: pktNow(),
            },
          });

          console.log(
            `🔒 Marked check-in record ${todayCheckIn.id} as used for deduction`,
          );

          return true; // Still return success but don't process further
        }
      } else if (attendanceData.checkType === "check_in") {
        // Check if there's a checkout record for today with FULL_DAY_LEAVE status
        const todayCheckOut = await prisma.zKTecoAttendanceStaging.findFirst({
          where: {
            userId: employee.id,
            checkType: "check_out",
            overallStatus: "FULL_DAY_LEAVE",
            timestamp: {
              gte: new Date(todayDateOnly.getTime()),
              lt: new Date(todayDateOnly.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (todayCheckOut) {
          console.log(
            `🚫 Check-in blocked for ${employee.firstName} ${employee.lastName} - Check-out was FULL_DAY_LEAVE`,
          );
          console.log(
            "todayCheckOut.overallStatus",
            todayCheckOut.overallStatus,
          );
          // Mark this check-in record as blocked
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: stagingRecord.id },
            data: {
              overallStatus: null,
              processingError:
                "Check-in blocked - Check-out was FULL_DAY_LEAVE (deduction in final table)",
              updatedAt: pktNow(),
            },
          });

          // Mark the checkout record with processing note
          await prisma.zKTecoAttendanceStaging.update({
            where: { id: todayCheckOut.id },
            data: {
              processingError:
                "Marked for FULL_DAY_LEAVE deduction (will apply in final table)",
              updatedAt: pktNow(),
            },
          });

          console.log(
            `🔒 Marked checkout record ${todayCheckOut.id} as used for deduction`,
          );

          return true; // Still return success but don't process further
        }
      }

      // Step 5: Mark staging record as processed
      // NO ATTENDANCE RECORD CREATED YET - Will be created after 3 days by finalization cron
      await prisma.zKTecoAttendanceStaging.update({
        where: { id: stagingRecord.id },
        data: {
          processed: true,
          processingError: null,
          updatedAt: pktNow(),
        },
      });

      console.log(
        `✅ Staging record processed for ${employee.employeeId}: ${attendanceData.checkType} at ${attendanceData.timestamp.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} PKT (DB stores UTC: ${attendanceData.timestamp.toISOString()})`,
      );
      console.log(
        `⏳ Record will be finalized and moved to attendance after 3 days`,
      );

      return true;
    } catch (error) {
      console.error("❌ Error processing ZKTeco attendance data:", error);
      return false;
    }
  }

  /**
   * Emit real-time attendance updates via Socket.IO
   */
  private async emitAttendanceUpdate(
    employee: any,
    attendance: any,
    attendanceData: AttendanceData,
  ) {
    try {
      const socketManager = getSocketManager();
      if (!socketManager) return;

      const attendanceUpdate = {
        id: attendance.id,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        date: attendance.date.toISOString().split("T")[0],
        checkIn:
          attendance.checkIn?.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }) || null,
        checkOut:
          attendance.checkOut?.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }) || null,
        status: this.getAttendanceStatus(
          attendance.checkIn,
          attendance.checkOut,
          attendance.date,
        ),
        timestamp: attendanceData.timestamp.toISOString(),
        checkType: attendanceData.checkType,
        deviceId: attendanceData.deviceId,
        verifyType: attendanceData.verifyType,
        totalHours: attendance.totalHours,
        employee: {
          firstName: employee.firstName,
          lastName: employee.lastName,
        },
      };

      // Emit to admins and HR
      socketManager.emitToRole(
        "admin",
        "attendance:live_update",
        attendanceUpdate,
      );
      socketManager.emitToRole(
        "hr",
        "attendance:live_update",
        attendanceUpdate,
      );

      // Emit personal update
      socketManager.emitToUser(employee.id, "attendance:personal_update", {
        message: `You have been marked ${
          attendanceData.checkType === "check_in" ? "present" : "checked out"
        } at ${attendanceData.timestamp.toLocaleTimeString()}`,
        timestamp: attendanceData.timestamp.toISOString(),
        checkType: attendanceData.checkType,
        totalHours: attendance.totalHours,
      });

      console.log(
        `📡 Live attendance update emitted for employee ${employee.employeeId}`,
      );
    } catch (error) {
      console.error("Error emitting attendance update:", error);
    }
  }
}

// Create singleton instance
export const zktecoService = new ZKTecoService();
