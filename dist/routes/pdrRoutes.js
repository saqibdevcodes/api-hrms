"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pdrController_1 = require("../controller/pdrController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const pdrValidator_1 = require("../validators/pdrValidator");
const router = (0, express_1.Router)();
// Get all PDRs (role-filtered)
router.get("/", auth_1.authenticate, pdrValidator_1.getPdrsQueryValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.getAllPdrs);
// Get PDR statistics (for dashboard)
router.get("/statistics", auth_1.authenticate, pdrController_1.PdrController.getPdrStatistics);
// Get single PDR by ID
router.get("/:id", auth_1.authenticate, pdrValidator_1.pdrIdValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.getPdrById);
// Create single PDR (HR/Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, pdrValidator_1.createPdrValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.createPdr);
// Create bulk PDRs (HR/Admin only)
router.post("/bulk", auth_1.authenticate, auth_1.hrAndAdmin, pdrValidator_1.createBulkPdrValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.createBulkPdrs);
// Start filling PDR (Employee or Manager)
router.post("/:id/start-filling", auth_1.authenticate, pdrValidator_1.pdrIdValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.startFilling);
// Submit PDR (Employee or Manager)
router.post("/:id/submit", auth_1.authenticate, pdrValidator_1.submitPdrValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.submitPdr);
// HR Approve PDR
router.post("/:id/approve", auth_1.authenticate, auth_1.hrAndAdmin, pdrValidator_1.pdrIdValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.approvePdr);
// HR Revert PDR
router.post("/:id/revert", auth_1.authenticate, auth_1.hrAndAdmin, pdrValidator_1.revertPdrValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.revertPdr);
// Employee Acknowledge PDR
router.post("/:id/acknowledge", auth_1.authenticate, pdrValidator_1.acknowledgePdrValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.acknowledgePdr);
// Director Review PDR
router.post("/:id/director-review", auth_1.authenticate, pdrValidator_1.directorReviewValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.directorReview);
// Update PDR content (comments, qualities, goals)
router.put("/:id/content", auth_1.authenticate, pdrValidator_1.updatePdrContentValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.updatePdrContent);
// Save PDR form data (Part 1 & Part 2)
router.post("/:id/save-form", auth_1.authenticate, pdrController_1.PdrController.savePdrFormData);
// Resolve a PDR comment (mark as addressed)
router.patch("/comment/:commentId/resolve", auth_1.authenticate, pdrController_1.PdrController.resolveComment);
// Delete PDR (HR/Admin only)
router.delete("/:id", auth_1.authenticate, auth_1.hrAndAdmin, pdrValidator_1.pdrIdValidator, validateRequest_1.validateRequest, pdrController_1.PdrController.deletePdr);
exports.default = router;
