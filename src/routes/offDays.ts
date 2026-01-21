import { Router } from "express";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import { OffDayController } from "../controller/offDays";
import { validateRequest } from "../middleware/validateRequest";
import {
  createOffDayValidation,
  updateOffDayValidation,
} from "../validators/offDaysValidator";

const router = Router();

// GET /api/off-days - Get all off days with pagination and search
router.get("/", authenticate, OffDayController.getAllOffDays);

// GET /api/off-days/range - Get off days by date range
router.get("/range", authenticate, OffDayController.getOffDaysByDateRange);

// GET /api/off-days/:id - Get off day by ID
router.get("/:id", authenticate, OffDayController.getOffDayById);

// POST /api/off-days/send-chart-email - Send chart email
router.post("/send-chart-email", authenticate, OffDayController.sendChartEmail);

// POST /api/off-days - Create new off day (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createOffDayValidation,
  validateRequest,
  OffDayController.createOffDay
);

// PUT /api/off-days/:id - Update off day (HR and Admin only)
router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  updateOffDayValidation,
  validateRequest,
  OffDayController.updateOffDay
);

// DELETE /api/off-days/:id - Delete off day (HR and Admin only)
router.delete("/:id", authenticate, hrAndAdmin, OffDayController.deleteOffDay);

export default router;
