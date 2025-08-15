import { Router } from "express";
import { DesignationController } from "../controller/designationController";
import {
  createDesignationValidation,
  updateDesignationValidation,
} from "../validators/designationValidator";
import { authenticate, hrAndAdmin, validateRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /designations
 * @desc    Get all designations with pagination and search
 * @access  Private (HR/Admin)
 */
router.get("/", hrAndAdmin, DesignationController.getAllDesignations);

/**
 * @route   GET /designations/departments
 * @desc    Get unique departments for filter dropdown
 * @access  Private (HR/Admin)
 */
router.get("/departments", hrAndAdmin, DesignationController.getDepartments);

/**
 * @route   GET /designations/:id
 * @desc    Get designation by ID
 * @access  Private (HR/Admin)
 */
router.get("/:id", hrAndAdmin, DesignationController.getDesignationById);

/**
 * @route   POST /designations
 * @desc    Create new designation
 * @access  Private (HR/Admin)
 */
router.post(
  "/",
  hrAndAdmin,
  createDesignationValidation,
  validateRequest,
  DesignationController.createDesignation
);

/**
 * @route   PUT /designations/:id
 * @desc    Update designation
 * @access  Private (HR/Admin)
 */
router.put(
  "/:id",
  hrAndAdmin,
  updateDesignationValidation,
  validateRequest,
  DesignationController.updateDesignation
);

/**
 * @route   DELETE /designations/:id
 * @desc    Delete designation
 * @access  Private (HR/Admin)
 */
router.delete("/:id", hrAndAdmin, DesignationController.deleteDesignation);

/**
 * @route   PATCH /designations/:id/toggle
 * @desc    Toggle designation active status
 * @access  Private (HR/Admin)
 */
router.patch(
  "/:id/toggle",
  hrAndAdmin,
  DesignationController.toggleDesignationStatus
);

export default router;
