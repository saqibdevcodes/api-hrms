import { Router } from "express";
import { EmploymentTypeController } from "../controller/employmentTypeController";
import {
  createEmploymentTypeValidation,
  updateEmploymentTypeValidation,
} from "../validators/employmentTypeValidator";
import { authenticate, hrAndAdmin, validateRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /employment-types
 * @desc    Get all employment types with pagination and search
 * @access  Private (HR/Admin)
 */
router.get("/", hrAndAdmin, EmploymentTypeController.getAllEmploymentTypes);

/**
 * @route   GET /employment-types/:id
 * @desc    Get employment type by ID
 * @access  Private (HR/Admin)
 */
router.get("/:id", hrAndAdmin, EmploymentTypeController.getEmploymentTypeById);

/**
 * @route   POST /employment-types
 * @desc    Create new employment type
 * @access  Private (HR/Admin)
 */
router.post(
  "/",
  hrAndAdmin,
  createEmploymentTypeValidation,
  validateRequest,
  EmploymentTypeController.createEmploymentType
);

/**
 * @route   PUT /employment-types/:id
 * @desc    Update employment type
 * @access  Private (HR/Admin)
 */
router.put(
  "/:id",
  hrAndAdmin,
  updateEmploymentTypeValidation,
  validateRequest,
  EmploymentTypeController.updateEmploymentType
);

/**
 * @route   DELETE /employment-types/:id
 * @desc    Delete employment type
 * @access  Private (HR/Admin)
 */
router.delete(
  "/:id",
  hrAndAdmin,
  EmploymentTypeController.deleteEmploymentType
);

/**
 * @route   PATCH /employment-types/:id/toggle
 * @desc    Toggle employment type active status
 * @access  Private (HR/Admin)
 */
router.patch(
  "/:id/toggle",
  hrAndAdmin,
  EmploymentTypeController.toggleEmploymentTypeStatus
);

export default router;
