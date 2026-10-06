import { Router } from "express";
import { AttendancePolicyController } from "../controller/attendancePolicyController";
import { authenticate, hrAndAdmin } from "../middleware/auth";

const router = Router();

// --- Policy Settings ---
// GET /api/v1/attendance-policy
router.get("/", authenticate, AttendancePolicyController.getPolicy);

// PUT /api/v1/attendance-policy
router.put("/", authenticate, hrAndAdmin, AttendancePolicyController.updatePolicy);

// POST /api/v1/attendance-policy/restore-defaults
router.post(
  "/restore-defaults",
  authenticate,
  hrAndAdmin,
  AttendancePolicyController.restoreDefaults
);

// --- Department Shift Timings ---
// GET /api/v1/attendance-policy/department-timings
router.get(
  "/department-timings",
  authenticate,
  AttendancePolicyController.getDepartmentTimings
);

// POST /api/v1/attendance-policy/department-timings
router.post(
  "/department-timings",
  authenticate,
  hrAndAdmin,
  AttendancePolicyController.createDepartmentTiming
);

// PUT /api/v1/attendance-policy/department-timings/:id
router.put(
  "/department-timings/:id",
  authenticate,
  hrAndAdmin,
  AttendancePolicyController.updateDepartmentTiming
);

// DELETE /api/v1/attendance-policy/department-timings/:id
router.delete(
  "/department-timings/:id",
  authenticate,
  hrAndAdmin,
  AttendancePolicyController.deleteDepartmentTiming
);

// --- Monthly Allowances Tracking ---
// GET /api/v1/attendance-policy/monthly-allowances/:employeeId
router.get(
  "/monthly-allowances/:employeeId",
  authenticate,
  AttendancePolicyController.getMonthlyAllowances
);

// --- Regularisation Workflow ---
// POST /api/v1/attendance-policy/regularisations
router.post(
  "/regularisations",
  authenticate,
  AttendancePolicyController.submitRegularisation
);

// GET /api/v1/attendance-policy/regularisations
router.get(
  "/regularisations",
  authenticate,
  AttendancePolicyController.getRegularisations
);

// PUT /api/v1/attendance-policy/regularisations/:id/review
router.put(
  "/regularisations/:id/review",
  authenticate,
  hrAndAdmin,
  AttendancePolicyController.reviewRegularisation
);

export default router;
