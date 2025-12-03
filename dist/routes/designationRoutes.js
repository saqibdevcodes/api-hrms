"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const designationController_1 = require("../controller/designationController");
const designationValidator_1 = require("../validators/designationValidator");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /designations
 * @desc    Get all designations with pagination and search
 * @access  Private (HR/Admin)
 */
router.get("/", auth_1.hrAndAdmin, designationController_1.DesignationController.getAllDesignations);
/**
 * @route   GET /designations/departments
 * @desc    Get unique departments for filter dropdown
 * @access  Private (HR/Admin)
 */
router.get("/departments", auth_1.hrAndAdmin, designationController_1.DesignationController.getDepartments);
/**
 * @route   GET /designations/:id
 * @desc    Get designation by ID
 * @access  Private (HR/Admin)
 */
router.get("/:id", auth_1.hrAndAdmin, designationController_1.DesignationController.getDesignationById);
/**
 * @route   POST /designations
 * @desc    Create new designation
 * @access  Private (HR/Admin)
 */
router.post("/", auth_1.hrAndAdmin, designationValidator_1.createDesignationValidation, auth_1.validateRequest, designationController_1.DesignationController.createDesignation);
/**
 * @route   PUT /designations/:id
 * @desc    Update designation
 * @access  Private (HR/Admin)
 */
router.put("/:id", auth_1.hrAndAdmin, designationValidator_1.updateDesignationValidation, auth_1.validateRequest, designationController_1.DesignationController.updateDesignation);
/**
 * @route   DELETE /designations/:id
 * @desc    Delete designation
 * @access  Private (HR/Admin)
 */
router.delete("/:id", auth_1.hrAndAdmin, designationController_1.DesignationController.deleteDesignation);
/**
 * @route   PATCH /designations/:id/toggle
 * @desc    Toggle designation active status
 * @access  Private (HR/Admin)
 */
router.patch("/:id/toggle", auth_1.hrAndAdmin, designationController_1.DesignationController.toggleDesignationStatus);
exports.default = router;
