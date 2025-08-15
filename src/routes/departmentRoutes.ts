import { Router } from "express";
import { DepartmentController } from "../controller/departmentController";
import {
  createDepartmentValidation,
  updateDepartmentValidation,
} from "../validators/departmentValidator";
import { authenticate, hrAndAdmin, validateRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /departments
 * @desc    Get all departments with pagination and search
 * @access  Private (HR/Admin)
 */
router.get("/", hrAndAdmin, DepartmentController.getAllDepartments);

/**
 * @route   GET /departments/:id
 * @desc    Get department by ID
 * @access  Private (HR/Admin)
 */
router.get("/:id", hrAndAdmin, DepartmentController.getDepartmentById);

/**
 * @route   POST /departments
 * @desc    Create new department
 * @access  Private (HR/Admin)
 */
router.post(
  "/",
  hrAndAdmin,
  createDepartmentValidation,
  validateRequest,
  DepartmentController.createDepartment
);

/**
 * @route   PUT /departments/:id
 * @desc    Update department
 * @access  Private (HR/Admin)
 */
router.put(
  "/:id",
  hrAndAdmin,
  updateDepartmentValidation,
  validateRequest,
  DepartmentController.updateDepartment
);

/**
 * @route   DELETE /departments/:id
 * @desc    Delete department
 * @access  Private (HR/Admin)
 */
router.delete("/:id", hrAndAdmin, DepartmentController.deleteDepartment);

/**
 * @route   PATCH /departments/:id/toggle
 * @desc    Toggle department active status
 * @access  Private (HR/Admin)
 */
router.patch(
  "/:id/toggle",
  hrAndAdmin,
  DepartmentController.toggleDepartmentStatus
);

export default router;
