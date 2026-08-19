import { Router } from "express";
import { ZKTecoController } from "../controller/zktecoController";
import { authenticate, validateRequest } from "../middleware/auth";
import {
  addDeviceValidator,
  deviceIdValidator,
  uploadEmployeeValidator,
  syncAttendanceValidator,
  getAttendanceDataValidator,
  getAttendanceStatsValidator,
  getEmpDashboardValidator,
  clearDeviceAttendanceValidator,
  uploadAllEmployeesValidator,
} from "../validators/zktecoValidator";

const router = Router();

// Device Management Routes
router.get("/devices", authenticate, ZKTecoController.getDevices);
router.post(
  "/devices",
  authenticate,
  addDeviceValidator,
  validateRequest,
  ZKTecoController.addDevice,
);
router.delete(
  "/devices/:deviceId",
  authenticate,
  deviceIdValidator,
  validateRequest,
  ZKTecoController.removeDevice,
);
router.get(
  "/devices/:deviceId/status",
  authenticate,
  deviceIdValidator,
  validateRequest,
  ZKTecoController.getDeviceStatus,
);
router.get(
  "/devices/:deviceId/info",
  authenticate,
  deviceIdValidator,
  validateRequest,
  ZKTecoController.getDeviceInfo,
);

// Employee Management Routes
router.post(
  "/devices/upload-employee",
  authenticate,
  uploadEmployeeValidator,
  validateRequest,
  ZKTecoController.uploadEmployeeToDevice,
);
router.post(
  "/devices/upload-all-employees",
  authenticate,
  uploadAllEmployeesValidator,
  validateRequest,
  ZKTecoController.uploadAllEmployeesToDevice,
);

// Attendance Data Routes
router.post(
  "/attendance/sync",
  authenticate,
  syncAttendanceValidator,
  validateRequest,
  ZKTecoController.syncAttendanceData,
);
router.get(
  "/attendance/export",
  authenticate,
  ZKTecoController.exportAttendanceExcel,
);
router.get(
  "/attendance/data",
  authenticate,
  getAttendanceDataValidator,
  validateRequest,
  ZKTecoController.getAttendanceData,
);
router.get(
  "/attendance/stats",
  authenticate,
  getAttendanceStatsValidator,
  validateRequest,
  ZKTecoController.getAttendanceStats,
);
router.get(
  "/attendance/emp-dashboard",
  authenticate,
  getEmpDashboardValidator,
  validateRequest,
  ZKTecoController.getEmpStatsData,
);
router.get(
  "/attendance/fetch-all-from-machine",
  authenticate,
  ZKTecoController.fetchAllAttendanceFromMachine,
);
router.get(
  "/attendance/zkteco-records",
  authenticate,
  ZKTecoController.getAllZKTecoRecords,
);
router.post(
  "/attendance/late-reason",
  authenticate,
  ZKTecoController.addLateReason,
);
router.put(
  "/attendance/late-reason/:id",
  authenticate,
  ZKTecoController.updateLateReason,
);

router.post(
  "/attendance/request-reason",
  authenticate,
  ZKTecoController.requestReason,
);

router.post(
  "/attendance/late-reason-reminders",
  authenticate,
  ZKTecoController.sendLateReasonReminders,
);

router.get(
  "/attendance/unmarked",
  authenticate,
  ZKTecoController.getUnmarkedAttendance,
);
router.post(
  "/attendance/send-unmarked-reminders",
  authenticate,
  ZKTecoController.sendUnmarkedAttendanceReminders,
);

router.post(
  "/employees/create-from-zkteco",
  authenticate,
  ZKTecoController.createEmployeeFromZKTeco,
);

// Get employee deduction history
router.get(
  "/employees/:employeeId/deduction-history",
  authenticate,
  ZKTecoController.getEmployeeDeductionHistory,
);

// Get employee leave balance
router.get(
  "/employees/:employeeId/leave-balance",
  authenticate,
  ZKTecoController.getEmployeeLeaveBalance,
);

// Debug attendance records for a specific date
router.get(
  "/employees/:employeeId/debug-attendance/:date",
  authenticate,
  ZKTecoController.debugAttendanceRecords,
);

// Fix attendance records for a specific date
router.post(
  "/employees/:employeeId/fix-attendance/:date",
  authenticate,
  ZKTecoController.fixAttendanceRecords,
);

// Validate records for deduction
router.post(
  "/attendance/validate-records",
  authenticate,
  ZKTecoController.validateRecordsForDeduction,
);

// Device Operations Routes
router.post(
  "/devices/clear-attendance",
  authenticate,
  clearDeviceAttendanceValidator,
  validateRequest,
  ZKTecoController.clearDeviceAttendance,
);

// iClock protocol routes (for ZKTeco device communication)
// Note: These routes don't require authentication as they're for device communication

// Direct iClock routes (device hits /iclock/path)
router.get("/getrequest", ZKTecoController.handleIClockGetRequest);
router.post("/ping", ZKTecoController.handleIClockPing);
router.post("/cdata", ZKTecoController.handleIClockCData);
router.get("/cdata", ZKTecoController.handleIClockCData); // Allow GET for testing/legacy
router.post("/fdata", ZKTecoController.handleIClockFData); // Add face data handler

// API versions for manual calls (/api/v1/zkteco/iclock/path)
router.get("/iclock/getrequest", ZKTecoController.handleIClockGetRequest);
router.post("/iclock/ping", ZKTecoController.handleIClockPing);
router.post("/iclock/cdata", ZKTecoController.handleIClockCData);
router.get("/iclock/cdata", ZKTecoController.handleIClockCData);
router.post("/iclock/fdata", ZKTecoController.handleIClockFData); // Add face data handler

// Finalization Routes (SuperAdmin only)
router.post(
  "/attendance/force-finalize-all",
  authenticate,
  ZKTecoController.forceFinalizeAll,
);
router.post(
  "/attendance/run-finalization-cron",
  authenticate,
  ZKTecoController.runFinalizationCron,
);

export default router;
