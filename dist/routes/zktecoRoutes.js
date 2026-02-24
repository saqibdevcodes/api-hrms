"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zktecoController_1 = require("../controller/zktecoController");
const auth_1 = require("../middleware/auth");
const zktecoValidator_1 = require("../validators/zktecoValidator");
const router = (0, express_1.Router)();
// Device Management Routes
router.get("/devices", auth_1.authenticate, zktecoController_1.ZKTecoController.getDevices);
router.post("/devices", auth_1.authenticate, zktecoValidator_1.addDeviceValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.addDevice);
router.delete("/devices/:deviceId", auth_1.authenticate, zktecoValidator_1.deviceIdValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.removeDevice);
router.get("/devices/:deviceId/status", auth_1.authenticate, zktecoValidator_1.deviceIdValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.getDeviceStatus);
router.get("/devices/:deviceId/info", auth_1.authenticate, zktecoValidator_1.deviceIdValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.getDeviceInfo);
// Employee Management Routes
router.post("/devices/upload-employee", auth_1.authenticate, zktecoValidator_1.uploadEmployeeValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.uploadEmployeeToDevice);
router.post("/devices/upload-all-employees", auth_1.authenticate, zktecoValidator_1.uploadAllEmployeesValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.uploadAllEmployeesToDevice);
// Attendance Data Routes
router.post("/attendance/sync", auth_1.authenticate, zktecoValidator_1.syncAttendanceValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.syncAttendanceData);
router.get("/attendance/data", auth_1.authenticate, zktecoValidator_1.getAttendanceDataValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.getAttendanceData);
router.get("/attendance/stats", auth_1.authenticate, zktecoValidator_1.getAttendanceStatsValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.getAttendanceStats);
router.get("/attendance/fetch-all-from-machine", auth_1.authenticate, zktecoController_1.ZKTecoController.fetchAllAttendanceFromMachine);
router.get("/attendance/zkteco-records", auth_1.authenticate, zktecoController_1.ZKTecoController.getAllZKTecoRecords);
router.get("/attendance/export", auth_1.authenticate, zktecoController_1.ZKTecoController.exportAttendanceData);
router.post("/attendance/late-reason", auth_1.authenticate, zktecoController_1.ZKTecoController.addLateReason);
router.put("/attendance/late-reason/:id", auth_1.authenticate, zktecoController_1.ZKTecoController.updateLateReason);
router.post("/attendance/request-reason", auth_1.authenticate, zktecoController_1.ZKTecoController.requestReason);
router.post("/attendance/late-reason-reminders", auth_1.authenticate, zktecoController_1.ZKTecoController.sendLateReasonReminders);
router.post("/employees/create-from-zkteco", auth_1.authenticate, zktecoController_1.ZKTecoController.createEmployeeFromZKTeco);
// Get employee deduction history
router.get("/employees/:employeeId/deduction-history", auth_1.authenticate, zktecoController_1.ZKTecoController.getEmployeeDeductionHistory);
// Get employee leave balance
router.get("/employees/:employeeId/leave-balance", auth_1.authenticate, zktecoController_1.ZKTecoController.getEmployeeLeaveBalance);
// Debug attendance records for a specific date
router.get("/employees/:employeeId/debug-attendance/:date", auth_1.authenticate, zktecoController_1.ZKTecoController.debugAttendanceRecords);
// Fix attendance records for a specific date
router.post("/employees/:employeeId/fix-attendance/:date", auth_1.authenticate, zktecoController_1.ZKTecoController.fixAttendanceRecords);
// Validate records for deduction
router.post("/attendance/validate-records", auth_1.authenticate, zktecoController_1.ZKTecoController.validateRecordsForDeduction);
// Device Operations Routes
router.post("/devices/clear-attendance", auth_1.authenticate, zktecoValidator_1.clearDeviceAttendanceValidator, auth_1.validateRequest, zktecoController_1.ZKTecoController.clearDeviceAttendance);
// iClock protocol routes (for ZKTeco device communication)
// Note: These routes don't require authentication as they're for device communication
// Direct iClock routes (device hits /iclock/path)
router.get("/getrequest", zktecoController_1.ZKTecoController.handleIClockGetRequest);
router.post("/ping", zktecoController_1.ZKTecoController.handleIClockPing);
router.post("/cdata", zktecoController_1.ZKTecoController.handleIClockCData);
router.get("/cdata", zktecoController_1.ZKTecoController.handleIClockCData); // Allow GET for testing/legacy
router.post("/fdata", zktecoController_1.ZKTecoController.handleIClockFData); // Add face data handler
// API versions for manual calls (/api/v1/zkteco/iclock/path)
router.get("/iclock/getrequest", zktecoController_1.ZKTecoController.handleIClockGetRequest);
router.post("/iclock/ping", zktecoController_1.ZKTecoController.handleIClockPing);
router.post("/iclock/cdata", zktecoController_1.ZKTecoController.handleIClockCData);
router.post("/iclock/fdata", zktecoController_1.ZKTecoController.handleIClockFData); // Add face data handler
// Finalization Routes (SuperAdmin only)
router.post("/attendance/force-finalize-all", auth_1.authenticate, zktecoController_1.ZKTecoController.forceFinalizeAll);
router.post("/attendance/run-finalization-cron", auth_1.authenticate, zktecoController_1.ZKTecoController.runFinalizationCron);
exports.default = router;
