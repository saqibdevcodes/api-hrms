"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employmentTypeController_1 = require("../controller/employmentTypeController");
const employmentTypeValidator_1 = require("../validators/employmentTypeValidator");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /employment-types
 * @desc    Get all employment types with pagination and search
 * @access  Private (HR/Admin)
 */
router.get("/", auth_1.hrAndAdmin, employmentTypeController_1.EmploymentTypeController.getAllEmploymentTypes);
/**
 * @route   GET /employment-types/:id
 * @desc    Get employment type by ID
 * @access  Private (HR/Admin)
 */
router.get("/:id", auth_1.hrAndAdmin, employmentTypeController_1.EmploymentTypeController.getEmploymentTypeById);
/**
 * @route   POST /employment-types
 * @desc    Create new employment type
 * @access  Private (HR/Admin)
 */
router.post("/", auth_1.hrAndAdmin, employmentTypeValidator_1.createEmploymentTypeValidation, auth_1.validateRequest, employmentTypeController_1.EmploymentTypeController.createEmploymentType);
/**
 * @route   PUT /employment-types/:id
 * @desc    Update employment type
 * @access  Private (HR/Admin)
 */
router.put("/:id", auth_1.hrAndAdmin, employmentTypeValidator_1.updateEmploymentTypeValidation, auth_1.validateRequest, employmentTypeController_1.EmploymentTypeController.updateEmploymentType);
/**
 * @route   DELETE /employment-types/:id
 * @desc    Delete employment type
 * @access  Private (HR/Admin)
 */
router.delete("/:id", auth_1.hrAndAdmin, employmentTypeController_1.EmploymentTypeController.deleteEmploymentType);
/**
 * @route   PATCH /employment-types/:id/toggle
 * @desc    Toggle employment type active status
 * @access  Private (HR/Admin)
 */
router.patch("/:id/toggle", auth_1.hrAndAdmin, employmentTypeController_1.EmploymentTypeController.toggleEmploymentTypeStatus);
exports.default = router;
