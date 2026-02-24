"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leavePolicyController_1 = require("../controller/leavePolicyController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const leavePolicyValidator_1 = require("../validators/leavePolicyValidator");
const router = (0, express_1.Router)();
// GET /api/leave-policies - Get all leave policies
router.get("/", auth_1.authenticate, leavePolicyController_1.LeavePolicyController.getAllLeavePolicies);
// GET /api/leave-policies/:id - Get leave policy by ID
router.get("/:id", auth_1.authenticate, leavePolicyController_1.LeavePolicyController.getLeavePolicyById);
// POST /api/leave-policies - Create new leave policy (HR and Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, leavePolicyValidator_1.createLeavePolicyValidation, validateRequest_1.validateRequest, leavePolicyController_1.LeavePolicyController.createLeavePolicy);
// PUT /api/leave-policies/:id - Update leave policy (HR and Admin only)
router.put("/:id", auth_1.authenticate, auth_1.hrAndAdmin, leavePolicyValidator_1.updateLeavePolicyValidation, validateRequest_1.validateRequest, leavePolicyController_1.LeavePolicyController.updateLeavePolicy);
// DELETE /api/leave-policies/:id - Delete leave policy (HR and Admin only)
router.delete("/:id", auth_1.authenticate, auth_1.hrAndAdmin, leavePolicyController_1.LeavePolicyController.deleteLeavePolicy);
// PATCH /api/leave-policies/:id/toggle - Toggle leave policy status (HR and Admin only)
router.patch("/:id/toggle", auth_1.authenticate, auth_1.hrAndAdmin, leavePolicyController_1.LeavePolicyController.toggleLeavePolicyStatus);
exports.default = router;
