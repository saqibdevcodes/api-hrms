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
  ZKTecoController.addDevice
);
router.delete(
  "/devices/:deviceId",
  authenticate,
  deviceIdValidator,
  validateRequest,
  ZKTecoController.removeDevice
);
router.get(
  "/devices/:deviceId/status",
  authenticate,
  deviceIdValidator,
  validateRequest,
  ZKTecoController.getDeviceStatus
);
router.get(
  "/devices/:deviceId/info",
  authenticate,
  deviceIdValidator,
  validateRequest,
  ZKTecoController.getDeviceInfo
);

// Employee Management Routes
router.post(
  "/devices/upload-employee",
  authenticate,
  uploadEmployeeValidator,
  validateRequest,
  ZKTecoController.uploadEmployeeToDevice
);
router.post(
  "/devices/upload-all-employees",
  authenticate,
  uploadAllEmployeesValidator,
  validateRequest,
  ZKTecoController.uploadAllEmployeesToDevice
);

// Attendance Data Routes
router.post(
  "/attendance/sync",
  authenticate,
  syncAttendanceValidator,
  validateRequest,
  ZKTecoController.syncAttendanceData
);
router.get(
  "/attendance/data",
  authenticate,
  getAttendanceDataValidator,
  validateRequest,
  ZKTecoController.getAttendanceData
);
router.get(
  "/attendance/stats",
  authenticate,
  getAttendanceStatsValidator,
  validateRequest,
  ZKTecoController.getAttendanceStats
);

// Device Operations Routes
router.post(
  "/devices/clear-attendance",
  authenticate,
  clearDeviceAttendanceValidator,
  validateRequest,
  ZKTecoController.clearDeviceAttendance
);

// iClock protocol routes (for ZKTeco device communication)
// Note: These routes don't require authentication as they're for device communication

// Direct iClock routes (device hits /iclock/path)
router.get("/getrequest", ZKTecoController.handleIClockGetRequest);
router.post("/ping", ZKTecoController.handleIClockPing);
router.post("/cdata", ZKTecoController.handleIClockCData);

// API versions for manual calls (/api/v1/zkteco/iclock/path)
router.get("/iclock/getrequest", ZKTecoController.handleIClockGetRequest);
router.post("/iclock/ping", ZKTecoController.handleIClockPing);
router.post("/iclock/cdata", ZKTecoController.handleIClockCData);

export default router;
