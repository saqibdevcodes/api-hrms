import { Router } from "express";
import { EmployeeLeaveController } from "../controller/employeeLeaveController";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createEmployeeLeaveValidation,
  updateEmployeeLeaveValidation,
  initializeFromPolicyValidation,
} from "../validators/employeeLeaveValidator";

const router = Router();

// GET /api/employee-leaves - Get all employee leaves (HR and Admin only)
router.get(
  "/",
  authenticate,
  hrAndAdmin,
  EmployeeLeaveController.getAllEmployeeLeaves
);

// GET /api/employee-leaves/:userId - Get employee leave by user ID
router.get("/:userId", authenticate, EmployeeLeaveController.getEmployeeLeave);

// POST /api/employee-leaves - Create employee leave record (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createEmployeeLeaveValidation,
  validateRequest,
  EmployeeLeaveController.createEmployeeLeave
);

// PUT /api/employee-leaves/:userId - Update employee leave (HR and Admin only)
router.put(
  "/:userId",
  authenticate,
  hrAndAdmin,
  updateEmployeeLeaveValidation,
  validateRequest,
  EmployeeLeaveController.updateEmployeeLeave
);

// POST /api/employee-leaves/initialize - Initialize employee leave from policy (HR and Admin only)
router.post(
  "/initialize",
  authenticate,
  hrAndAdmin,
  initializeFromPolicyValidation,
  validateRequest,
  EmployeeLeaveController.initializeFromPolicy
);

// POST /api/employee-leaves/reset - Reset leaves overall, per department, or per employee (HR and Admin only)
router.post(
  "/reset",
  authenticate,
  hrAndAdmin,
  EmployeeLeaveController.resetLeaves
);

export default router;

