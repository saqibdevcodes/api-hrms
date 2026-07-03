"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const departmentController_1 = require("../controller/departmentController");
const departmentValidator_1 = require("../validators/departmentValidator");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /departments
 * @desc    Get all departments with pagination and search
 * @access  Private (HR/Admin)
 */
router.get("/", departmentController_1.DepartmentController.getAllDepartments);
/**
 * @route   GET /departments/:id
 * @desc    Get department by ID
 * @access  Private (HR/Admin)
 */
router.get("/:id", auth_1.hrAndAdmin, departmentController_1.DepartmentController.getDepartmentById);
/**
 * @route   POST /departments
 * @desc    Create new department
 * @access  Private (HR/Admin)
 */
router.post("/", auth_1.hrAndAdmin, departmentValidator_1.createDepartmentValidation, auth_1.validateRequest, departmentController_1.DepartmentController.createDepartment);
/**
 * @route   PUT /departments/:id
 * @desc    Update department
 * @access  Private (HR/Admin)
 */
router.put("/:id", auth_1.hrAndAdmin, departmentValidator_1.updateDepartmentValidation, auth_1.validateRequest, departmentController_1.DepartmentController.updateDepartment);
/**
 * @route   DELETE /departments/:id
 * @desc    Delete department
 * @access  Private (HR/Admin)
 */
router.delete("/:id", auth_1.hrAndAdmin, departmentController_1.DepartmentController.deleteDepartment);
/**
 * @route   PATCH /departments/:id/toggle
 * @desc    Toggle department active status
 * @access  Private (HR/Admin)
 */
router.patch("/:id/toggle", auth_1.hrAndAdmin, departmentController_1.DepartmentController.toggleDepartmentStatus);
exports.default = router;
