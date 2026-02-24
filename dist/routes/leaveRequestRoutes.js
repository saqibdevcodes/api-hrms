"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leaveRequestController_1 = require("../controller/leaveRequestController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const leaveRequestValidator_1 = require("../validators/leaveRequestValidator");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// GET /api/leave-requests - Get all leave requests (with filtering and pagination)
router.get("/", leaveRequestValidator_1.getLeaveRequestsValidation, validateRequest_1.validateRequest, leaveRequestController_1.LeaveRequestController.getAllLeaveRequests);
// GET /api/leave-requests/stats - Get leave request statistics
router.get("/stats", leaveRequestController_1.LeaveRequestController.getLeaveRequestStats);
// GET /api/leave-requests/:id - Get leave request by ID
router.get("/:id", leaveRequestController_1.LeaveRequestController.getLeaveRequestById);
// POST /api/leave-requests - Create new leave request
router.post("/", leaveRequestValidator_1.createLeaveRequestValidation, validateRequest_1.validateRequest, leaveRequestController_1.LeaveRequestController.createLeaveRequest);
// PUT /api/leave-requests/:id - Update leave request
router.put("/:id", leaveRequestValidator_1.updateLeaveRequestValidation, validateRequest_1.validateRequest, leaveRequestController_1.LeaveRequestController.updateLeaveRequest);
// DELETE /api/leave-requests/:id - Delete leave request
router.delete("/:id", leaveRequestController_1.LeaveRequestController.deleteLeaveRequest);
// POST /api/leave-requests/:id/approve - Approve leave request (HR and Admin only)
router.post("/:id/approve", auth_1.hrAndAdmin, leaveRequestValidator_1.approveRejectLeaveRequestValidation, validateRequest_1.validateRequest, leaveRequestController_1.LeaveRequestController.approveLeaveRequest);
// POST /api/leave-requests/:id/reject - Reject leave request (HR and Admin only)
router.post("/:id/reject", auth_1.hrAndAdmin, leaveRequestValidator_1.approveRejectLeaveRequestValidation, validateRequest_1.validateRequest, leaveRequestController_1.LeaveRequestController.rejectLeaveRequest);
exports.default = router;
