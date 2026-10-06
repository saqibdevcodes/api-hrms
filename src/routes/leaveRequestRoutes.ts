import { Router } from "express";
import { LeaveRequestController } from "../controller/leaveRequestController";
import { authenticate, hrAndAdmin, managerAndAbove } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createLeaveRequestValidation,
  updateLeaveRequestValidation,
  approveRejectLeaveRequestValidation,
  getLeaveRequestsValidation,
} from "../validators/leaveRequestValidator";

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/leave-requests - Get all leave requests (with filtering and pagination)
router.get(
  "/",
  getLeaveRequestsValidation,
  validateRequest,
  LeaveRequestController.getAllLeaveRequests
);

// GET /api/leave-requests/stats - Get leave request statistics
router.get("/stats", LeaveRequestController.getLeaveRequestStats);

// GET /api/leave-requests/:id - Get leave request by ID
router.get("/:id", LeaveRequestController.getLeaveRequestById);

// POST /api/leave-requests - Create new leave request
router.post(
  "/",
  createLeaveRequestValidation,
  validateRequest,
  LeaveRequestController.createLeaveRequest
);

// PUT /api/leave-requests/:id - Update leave request
router.put(
  "/:id",
  updateLeaveRequestValidation,
  validateRequest,
  LeaveRequestController.updateLeaveRequest
);

// DELETE /api/leave-requests/:id - Delete leave request
router.delete("/:id", LeaveRequestController.deleteLeaveRequest);

// POST /api/leave-requests/:id/approve - Approve leave request (Managers, HR, Admin)
router.post(
  "/:id/approve",
  managerAndAbove,
  approveRejectLeaveRequestValidation,
  validateRequest,
  LeaveRequestController.approveLeaveRequest
);

// POST /api/leave-requests/:id/reject - Reject leave request (Managers, HR, Admin)
router.post(
  "/:id/reject",
  managerAndAbove,
  approveRejectLeaveRequestValidation,
  validateRequest,
  LeaveRequestController.rejectLeaveRequest
);

export default router;
