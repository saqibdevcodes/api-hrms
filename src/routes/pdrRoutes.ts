import { Router } from "express";
import { PdrController } from "../controller/pdrController";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createPdrValidator,
  createBulkPdrValidator,
  pdrIdValidator,
  submitPdrValidator,
  revertPdrValidator,
  acknowledgePdrValidator,
  directorReviewValidator,
  getPdrsQueryValidator,
  updatePdrContentValidator,
  createPdrCycleValidator,
  updatePdrDeadlinesValidator,
  bulkClosePdrEmployeePortalValidator,
  pdrExportValidator,
} from "../validators/pdrValidator";

const router = Router();

// Export preview + Excel export (HR/Admin only).
// Registered before the "/:id" routes so "export" is never treated as an ID.
router.post(
  "/export/preview",
  authenticate,
  hrAndAdmin,
  pdrExportValidator,
  validateRequest,
  PdrController.getExportPreview,
);
router.post(
  "/export",
  authenticate,
  hrAndAdmin,
  pdrExportValidator,
  validateRequest,
  PdrController.exportPdrs,
);

// Get all PDRs (role-filtered)
router.get(
  "/",
  authenticate,
  getPdrsQueryValidator,
  validateRequest,
  PdrController.getAllPdrs
);

// Get PDR statistics (for dashboard)
router.get("/statistics", authenticate, PdrController.getPdrStatistics);

// Get/create PDR cycles
router.get("/cycles", authenticate, PdrController.getCycles);
router.post(
  "/cycles",
  authenticate,
  hrAndAdmin,
  createPdrCycleValidator,
  validateRequest,
  PdrController.createCycle
);

router.patch("/:id/deadlines",
  authenticate, 
  hrAndAdmin, 
  updatePdrDeadlinesValidator,
  validateRequest, 
  PdrController.updatePdrDeadlines,
);

// Get single PDR by ID
router.get(
  "/:id",
  authenticate,
  pdrIdValidator,
  validateRequest,
  PdrController.getPdrById
);

// Create single PDR (HR/Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createPdrValidator,
  validateRequest,
  PdrController.createPdr
);

// Create bulk PDRs (HR/Admin only)
router.post(
  "/bulk",
  authenticate,
  hrAndAdmin,
  createBulkPdrValidator,
  validateRequest,
  PdrController.createBulkPdrs
);

// Close employee access to one or more PDRs now or at a scheduled time.
router.patch(
  "/bulk/employee-portal-close",
  authenticate,
  hrAndAdmin,
  bulkClosePdrEmployeePortalValidator,
  validateRequest,
  PdrController.bulkCloseEmployeePortal,
);

// Start filling PDR (Employee or Manager)
router.post(
  "/:id/start-filling",
  authenticate,
  pdrIdValidator,
  validateRequest,
  PdrController.startFilling
);

// Submit PDR (Employee or Manager)
router.post(
  "/:id/submit",
  authenticate,
  submitPdrValidator,
  validateRequest,
  PdrController.submitPdr
);

// HR Approve PDR
router.post(
  "/:id/approve",
  authenticate,
  hrAndAdmin,
  pdrIdValidator,
  validateRequest,
  PdrController.approvePdr
);

// HR Revert PDR
router.post(
  "/:id/revert",
  authenticate,
  hrAndAdmin,
  revertPdrValidator,
  validateRequest,
  PdrController.revertPdr
);

// Employee Acknowledge PDR
router.post(
  "/:id/acknowledge",
  authenticate,
  acknowledgePdrValidator,
  validateRequest,
  PdrController.acknowledgePdr
);

// Director Review PDR
router.post(
  "/:id/director-review",
  authenticate,
  directorReviewValidator,
  validateRequest,
  PdrController.directorReview
);

// Update PDR content (comments, qualities, goals)
router.put(
  "/:id/content",
  authenticate,
  updatePdrContentValidator,
  validateRequest,
  PdrController.updatePdrContent
);

// Save PDR form data (Part 1 & Part 2)
router.post(
  "/:id/save-form",
  authenticate,
  pdrIdValidator,
  validateRequest,
  PdrController.savePdrFormData
);

// Resolve a PDR comment (mark as addressed)
router.patch(
  "/comment/:commentId/resolve",
  authenticate,
  PdrController.resolveComment
);

// Delete PDR (HR/Admin only)
router.delete(
  "/:id",
  authenticate,
  hrAndAdmin,
  pdrIdValidator,
  validateRequest,
  PdrController.deletePdr
);

export default router;
