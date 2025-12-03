"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employeeLeaveController_1 = require("../controller/employeeLeaveController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const employeeLeaveValidator_1 = require("../validators/employeeLeaveValidator");
const router = (0, express_1.Router)();
// GET /api/employee-leaves - Get all employee leaves (HR and Admin only)
router.get("/", auth_1.authenticate, auth_1.hrAndAdmin, employeeLeaveController_1.EmployeeLeaveController.getAllEmployeeLeaves);
// GET /api/employee-leaves/:userId - Get employee leave by user ID
router.get("/:userId", auth_1.authenticate, employeeLeaveController_1.EmployeeLeaveController.getEmployeeLeave);
// POST /api/employee-leaves - Create employee leave record (HR and Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, employeeLeaveValidator_1.createEmployeeLeaveValidation, validateRequest_1.validateRequest, employeeLeaveController_1.EmployeeLeaveController.createEmployeeLeave);
// PUT /api/employee-leaves/:userId - Update employee leave (HR and Admin only)
router.put("/:userId", auth_1.authenticate, auth_1.hrAndAdmin, employeeLeaveValidator_1.updateEmployeeLeaveValidation, validateRequest_1.validateRequest, employeeLeaveController_1.EmployeeLeaveController.updateEmployeeLeave);
// POST /api/employee-leaves/initialize - Initialize employee leave from policy (HR and Admin only)
router.post("/initialize", auth_1.authenticate, auth_1.hrAndAdmin, employeeLeaveValidator_1.initializeFromPolicyValidation, validateRequest_1.validateRequest, employeeLeaveController_1.EmployeeLeaveController.initializeFromPolicy);
exports.default = router;
