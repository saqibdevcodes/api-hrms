"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shiftController_1 = require("../controller/shiftController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const shiftValidator_1 = require("../validators/shiftValidator");
const router = (0, express_1.Router)();
// GET /api/shifts - Get all shifts
router.get("/", auth_1.authenticate, shiftController_1.ShiftController.getAllShifts);
// GET /api/shifts/:id - Get shift by ID
router.get("/:id", auth_1.authenticate, shiftController_1.ShiftController.getShiftById);
// POST /api/shifts - Create new shift (HR and Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, shiftValidator_1.createShiftValidation, validateRequest_1.validateRequest, shiftController_1.ShiftController.createShift);
// PUT /api/shifts/:id - Update shift (HR and Admin only)
router.put("/:id", auth_1.authenticate, auth_1.hrAndAdmin, shiftValidator_1.updateShiftValidation, validateRequest_1.validateRequest, shiftController_1.ShiftController.updateShift);
// DELETE /api/shifts/:id - Delete shift (HR and Admin only)
router.delete("/:id", auth_1.authenticate, auth_1.hrAndAdmin, shiftController_1.ShiftController.deleteShift);
// PATCH /api/shifts/:id/toggle - Toggle shift status (HR and Admin only)
router.patch("/:id/toggle", auth_1.authenticate, auth_1.hrAndAdmin, shiftController_1.ShiftController.toggleShiftStatus);
exports.default = router;
