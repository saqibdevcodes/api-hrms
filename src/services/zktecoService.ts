import axios, { AxiosInstance } from "axios";
import dgram from "dgram";
import { PrismaClient } from "../generated/prisma";
import cron from "node-cron";
import { getSocketManager } from "../index";

const prisma = new PrismaClient();

export interface ZKTecoDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  password?: string;
  serialNumber?: string;
  model?: string;
  isActive: boolean;
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
      `ZKTeco device initialized: ${device.name} (${device.ip}:${device.port})`
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
        "Device should be configured to push to: http://192.168.2.85:3001/api/v1/zkteco/iclock/"
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
    deviceIp: string
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
        attendanceDate.getDate()
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
        `Attendance recorded for employee ${employee.employeeId}: ${attendanceData.checkType} at ${attendanceData.timestamp}`
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
              attendanceDate
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
            attendanceUpdate
          );
          socketManager.emitToRole(
            "hr",
            "attendance:live_update",
            attendanceUpdate
          );

          // Also emit to the specific employee
          socketManager.emitToUser(employee.id, "attendance:personal_update", {
            checkType: attendanceData.checkType,
            timestamp: attendanceData.timestamp,
            status: attendanceUpdate.status,
          });

          console.log(
            `Live attendance update emitted for ${employee.employeeId}`
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
    attendanceDate: Date
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
      (d) => d.ip === deviceIp
    );
    if (device) {
      console.log(
        `Heartbeat received from device: ${device.name} (${deviceIp})`
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
    endDate?: Date
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
        error
      );
      throw error;
    }
  }

  /**
   * Parse HTTP response containing attendance data
   */
  private parseHttpAttendanceResponse(
    data: string,
    deviceId: string
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
          endDate
        );

        for (const attendance of attendanceData) {
          await this.processAttendanceData(attendance, device.ip);
        }

        console.log(
          `Synced ${attendanceData.length} records from device ${device.name}`
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
    employee: EmployeeData
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
        `Employee ${employee.name} uploaded to device ${device.name}`
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
        error
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

    // Update device status
    if (sn) {
      // You can update device status in database here
      console.log(`Device ${sn} is online`);
    }

    // Return OK (no commands to send)
    return "OK";
  }

  /**
   * Handle iClock ping (device heartbeat)
   */
  async handleIClockPing(sn: string): Promise<string> {
    console.log(`Device ${sn} ping`);

    // Update device status
    if (sn) {
      console.log(`Device ${sn} heartbeat received`);
    }

    return "OK";
  }

  /**
   * Handle iClock cdata (device uploading data)
   */
  async handleIClockCData(
    sn: string,
    table: string,
    postData: Buffer
  ): Promise<string> {
    console.log(`Device ${sn} uploading ${table} data`);

    try {
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
    data: Buffer
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

            // Convert timestamp
            let timestamp: Date;
            try {
              timestamp = new Date(timestampStr);
              if (isNaN(timestamp.getTime())) {
                // Try parsing as YYYY-MM-DD HH:MM:SS
                const parsedDate = new Date(timestampStr.replace(" ", "T"));
                if (!isNaN(parsedDate.getTime())) {
                  timestamp = parsedDate;
                } else {
                  throw new Error("Invalid date format");
                }
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

            // Process the attendance data (this will save to DB and emit live updates)
            await this.processZKTecoAttendanceData(
              attendanceData,
              this.devices.get(deviceSn)?.ip || "192.168.2.202"
            );
            recordsProcessed++;
          }
        } catch (error) {
          console.warn(
            `Error parsing attendance line '${trimmedLine}':`,
            error
          );
          continue;
        }
      }

      console.log(
        `Processed ${recordsProcessed} attendance records from ${deviceSn}`
      );
    } catch (error) {
      console.error("Error processing iClock attendance data:", error);
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
   * Enhanced process attendance data with ZKTeco validation and new schema
   */
  public async processZKTecoAttendanceData(
    attendanceData: AttendanceData,
    deviceIp: string
  ): Promise<boolean> {
    try {
      console.log("🔄 Processing ZKTeco attendance data:", attendanceData);

      // Step 1: Save raw ZKTeco record first
      const zktecoRecord = await prisma.zKTecoAttendanceRecord.create({
        data: {
          employeeId: attendanceData.employeeId,
          deviceId: attendanceData.deviceId,
          timestamp: attendanceData.timestamp,
          checkType: attendanceData.checkType, // Keep as lowercase (check_in, check_out)
          verifyType: attendanceData.verifyType,
          workCode: (attendanceData as any).workCode || null,
          processed: false,
        },
      });

      console.log(`📝 Raw ZKTeco record saved with ID: ${zktecoRecord.id}`);

      // Step 2: Find employee by employeeId (ZKTeco internal ID)
      const employee = await prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: attendanceData.employeeId },
            { id: attendanceData.employeeId },
          ],
        },
      });

      if (!employee) {
        await prisma.zKTecoAttendanceRecord.update({
          where: { id: zktecoRecord.id },
          data: {
            processingError: `Employee not found for ID: ${attendanceData.employeeId}`,
          },
        });
        console.warn(
          `❌ Employee not found for ID: ${attendanceData.employeeId}`
        );
        return false;
      }

      // Step 3: Link the record to the user
      await prisma.zKTecoAttendanceRecord.update({
        where: { id: zktecoRecord.id },
        data: { userId: employee.id },
      });

      const attendanceDate = new Date(attendanceData.timestamp);

      // Create date in UTC to avoid timezone issues
      const dateOnly = new Date(
        Date.UTC(
          attendanceDate.getUTCFullYear(),
          attendanceDate.getUTCMonth(),
          attendanceDate.getUTCDate()
        )
      );

      // Step 4: Check existing attendance for validation
      let attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          date: dateOnly,
        },
      });

      console.log(
        `🔍 Employee ID: ${employee.id}, Employee Number: ${employee.employeeId}`
      );
      console.log(
        `🔍 Looking for attendance on date: ${dateOnly.toISOString()}`
      );
      console.log(`🔍 Found attendance:`, attendance);

      // Step 5: Validate check-in/out rules
      const today = new Date();
      const todayDateOnly = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate()
        )
      );
      const isToday = dateOnly.getTime() === todayDateOnly.getTime();

      console.log(
        `🔍 Date validation: attendanceDate=${dateOnly.toISOString()}, today=${todayDateOnly.toISOString()}, isToday=${isToday}`
      );
      console.log(
        `🔍 Existing attendance:`,
        attendance
          ? { checkIn: attendance.checkIn, checkOut: attendance.checkOut }
          : "None"
      );

      if (attendanceData.checkType === "check_in") {
        if (attendance?.checkIn && isToday) {
          await prisma.zKTecoAttendanceRecord.update({
            where: { id: zktecoRecord.id },
            data: {
              processingError: "Employee already checked in today",
              processed: true,
            },
          });
          console.warn(
            `⚠️ Employee ${employee.employeeId} already checked in today`
          );
          return false;
        }
      } else if (attendanceData.checkType === "check_out") {
        if (!attendance?.checkIn && isToday) {
          await prisma.zKTecoAttendanceRecord.update({
            where: { id: zktecoRecord.id },
            data: {
              processingError: "Cannot check out without checking in first",
              processed: true,
            },
          });
          console.warn(
            `⚠️ Employee ${employee.employeeId} trying to check out without checking in`
          );
          return false;
        }
        if (attendance?.checkOut && isToday) {
          await prisma.zKTecoAttendanceRecord.update({
            where: { id: zktecoRecord.id },
            data: {
              processingError: "Employee already checked out today",
              processed: true,
            },
          });
          console.warn(
            `⚠️ Employee ${employee.employeeId} already checked out today`
          );
          return false;
        }
      }

      // Step 6: Create or update attendance record
      if (!attendance) {
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
            deviceCheckIns: attendanceData.checkType === "check_in" ? 1 : 0,
            deviceCheckOuts: attendanceData.checkType === "check_out" ? 1 : 0,
            lastDeviceSync: new Date(),
            notes: `Recorded via ZKTeco device ${attendanceData.deviceId} (${deviceIp})`,
          },
        });
      } else {
        const updateData: any = {
          status: "PRESENT",
          lastDeviceSync: new Date(),
          notes: `Updated via ZKTeco device ${
            attendanceData.deviceId
          } at ${new Date().toISOString()}`,
        };

        if (attendanceData.checkType === "check_in" && !attendance.checkIn) {
          updateData.checkIn = attendanceData.timestamp;
          updateData.deviceCheckIns = (attendance.deviceCheckIns || 0) + 1;
        } else if (attendanceData.checkType === "check_out") {
          updateData.checkOut = attendanceData.timestamp;
          updateData.deviceCheckOuts = (attendance.deviceCheckOuts || 0) + 1;

          if (attendance.checkIn) {
            const workingMs =
              attendanceData.timestamp.getTime() - attendance.checkIn.getTime();
            const workingHours = workingMs / (1000 * 60 * 60);
            updateData.totalHours = Math.round(workingHours * 100) / 100;
          }
        }

        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: updateData,
        });
      }

      // Step 7: Mark ZKTeco record as processed
      await prisma.zKTecoAttendanceRecord.update({
        where: { id: zktecoRecord.id },
        data: {
          attendanceId: attendance.id,
          processed: true,
          processingError: null,
        },
      });

      console.log(
        `✅ Attendance processed for ${employee.employeeId}: ${attendanceData.checkType} at ${attendanceData.timestamp}`
      );

      // Step 8: Emit real-time updates
      await this.emitAttendanceUpdate(employee, attendance, attendanceData);

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
    attendanceData: AttendanceData
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
          attendance.date
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
        attendanceUpdate
      );
      socketManager.emitToRole(
        "hr",
        "attendance:live_update",
        attendanceUpdate
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
        `📡 Live attendance update emitted for employee ${employee.employeeId}`
      );
    } catch (error) {
      console.error("Error emitting attendance update:", error);
    }
  }
}

// Create singleton instance
export const zktecoService = new ZKTecoService();
