import { Router } from "express";
import { LeavePolicyController } from "../controller/leavePolicyController";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createLeavePolicyValidation,
  updateLeavePolicyValidation,
} from "../validators/leavePolicyValidator";

const router = Router();

// GET /api/leave-policies - Get all leave policies
router.get("/", authenticate, LeavePolicyController.getAllLeavePolicies);

// GET /api/leave-policies/:id - Get leave policy by ID
router.get("/:id", authenticate, LeavePolicyController.getLeavePolicyById);

// POST /api/leave-policies - Create new leave policy (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createLeavePolicyValidation,
  validateRequest,
  LeavePolicyController.createLeavePolicy
);

// PUT /api/leave-policies/:id - Update leave policy (HR and Admin only)
router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  updateLeavePolicyValidation,
  validateRequest,
  LeavePolicyController.updateLeavePolicy
);

// DELETE /api/leave-policies/:id - Delete leave policy (HR and Admin only)
router.delete(
  "/:id",
  authenticate,
  hrAndAdmin,
  LeavePolicyController.deleteLeavePolicy
);

// PATCH /api/leave-policies/:id/toggle - Toggle leave policy status (HR and Admin only)
router.patch(
  "/:id/toggle",
  authenticate,
  hrAndAdmin,
  LeavePolicyController.toggleLeavePolicyStatus
);

export default router;
