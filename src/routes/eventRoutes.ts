import { Router } from "express";
import { authenticate, SuperAdmin, hrAndAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { EventMasterController } from "../controller/eventMasterController";
import { EventController } from "../controller/eventController";
import {
  createEventValidation,
  updateEventStatusValidation,
  masterNameValidation,
} from "../validators/eventValidator";

const router = Router();

// ==========================================
// 1. MASTER MANAGEMENT ENDPOINTS (SUPERADMIN)
// ==========================================

// Event Types Master
router.get("/masters/event-types", authenticate, EventMasterController.getEventTypes);
router.post(
  "/masters/event-types",
  authenticate,
  SuperAdmin,
  masterNameValidation,
  validateRequest,
  EventMasterController.createEventType,
);
router.put(
  "/masters/event-types/:id",
  authenticate,
  SuperAdmin,
  EventMasterController.updateEventType,
);
router.delete(
  "/masters/event-types/:id",
  authenticate,
  SuperAdmin,
  EventMasterController.deleteEventType,
);

// Venues Master
router.get("/masters/venues", authenticate, EventMasterController.getVenues);
router.post(
  "/masters/venues",
  authenticate,
  SuperAdmin,
  masterNameValidation,
  validateRequest,
  EventMasterController.createVenue,
);
router.put(
  "/masters/venues/:id",
  authenticate,
  SuperAdmin,
  EventMasterController.updateVenue,
);
router.delete(
  "/masters/venues/:id",
  authenticate,
  SuperAdmin,
  EventMasterController.deleteVenue,
);

// Hierarchical Requirements Master
router.get("/masters/requirements", authenticate, EventMasterController.getRequirementsTree);
router.post(
  "/masters/requirements",
  authenticate,
  SuperAdmin,
  masterNameValidation,
  validateRequest,
  EventMasterController.createRequirement,
);
router.put(
  "/masters/requirements/:id",
  authenticate,
  SuperAdmin,
  EventMasterController.updateRequirement,
);
router.delete(
  "/masters/requirements/:id",
  authenticate,
  SuperAdmin,
  EventMasterController.deleteRequirement,
);

// ==========================================
// 2. CORE EVENT MANAGEMENT ENDPOINTS
// ==========================================

router.get("/", authenticate, EventController.getEvents);
router.get("/:id", authenticate, EventController.getEventById);

router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createEventValidation,
  validateRequest,
  EventController.createEvent,
);

router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  createEventValidation,
  validateRequest,
  EventController.updateEvent,
);

router.patch(
  "/:id/status",
  authenticate,
  hrAndAdmin,
  updateEventStatusValidation,
  validateRequest,
  EventController.updateEventStatus,
);

router.post("/:id/acknowledge", authenticate, EventController.acknowledgeAssignment);

router.post("/bulk-delete", authenticate, hrAndAdmin, EventController.deleteBulkEvents);

router.delete("/:id", authenticate, hrAndAdmin, EventController.deleteEvent);

// Checklist items
router.patch("/checklists/:checklistId", authenticate, EventController.toggleChecklistItem);
router.post("/:id/checklists", authenticate, hrAndAdmin, EventController.addChecklistItem);
router.delete("/checklists/:checklistId", authenticate, hrAndAdmin, EventController.deleteChecklistItem);

export default router;
