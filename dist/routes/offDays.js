"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const offDays_1 = require("../controller/offDays");
const validateRequest_1 = require("../middleware/validateRequest");
const offDaysValidator_1 = require("../validators/offDaysValidator");
const router = (0, express_1.Router)();
// GET /api/off-days - Get all off days with pagination and search
router.get("/", auth_1.authenticate, offDays_1.OffDayController.getAllOffDays);
// GET /api/off-days/range - Get off days by date range
router.get("/range", auth_1.authenticate, offDays_1.OffDayController.getOffDaysByDateRange);
// GET /api/off-days/:id - Get off day by ID
router.get("/:id", auth_1.authenticate, offDays_1.OffDayController.getOffDayById);
// POST /api/off-days - Create new off day (HR and Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, offDaysValidator_1.createOffDayValidation, validateRequest_1.validateRequest, offDays_1.OffDayController.createOffDay);
// PUT /api/off-days/:id - Update off day (HR and Admin only)
router.put("/:id", auth_1.authenticate, auth_1.hrAndAdmin, offDaysValidator_1.updateOffDayValidation, validateRequest_1.validateRequest, offDays_1.OffDayController.updateOffDay);
// DELETE /api/off-days/:id - Delete off day (HR and Admin only)
router.delete("/:id", auth_1.authenticate, auth_1.hrAndAdmin, offDays_1.OffDayController.deleteOffDay);
exports.default = router;
