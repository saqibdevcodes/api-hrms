import { Router } from "express";
import { ShiftController } from "../controller/shiftController";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createShiftValidation,
  updateShiftValidation,
} from "../validators/shiftValidator";

const router = Router();

// GET /api/shifts - Get all shifts
router.get("/", authenticate, ShiftController.getAllShifts);

// GET /api/shifts/:id - Get shift by ID
router.get("/:id", authenticate, ShiftController.getShiftById);

// POST /api/shifts - Create new shift (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createShiftValidation,
  validateRequest,
  ShiftController.createShift
);

// PUT /api/shifts/:id - Update shift (HR and Admin only)
router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  updateShiftValidation,
  validateRequest,
  ShiftController.updateShift
);

// DELETE /api/shifts/:id - Delete shift (HR and Admin only)
router.delete("/:id", authenticate, hrAndAdmin, ShiftController.deleteShift);

// PATCH /api/shifts/:id/toggle - Toggle shift status (HR and Admin only)
router.patch(
  "/:id/toggle",
  authenticate,
  hrAndAdmin,
  ShiftController.toggleShiftStatus
);

export default router;
