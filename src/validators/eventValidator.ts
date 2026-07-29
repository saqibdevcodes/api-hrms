import { body } from "express-validator";

export const createEventValidation = [
  body("title")
    .notEmpty()
    .withMessage("Event title is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Event title must be between 2 and 200 characters"),

  body("eventDate")
    .notEmpty()
    .withMessage("Event date is required")
    .isISO8601()
    .withMessage("Invalid event date format"),

  body("startTime")
    .notEmpty()
    .withMessage("Start time is required"),

  body("endTime")
    .optional({ nullable: true })
    .custom((endTime, { req }) => {
      if (endTime && req.body.startTime) {
        const start = new Date(req.body.startTime);
        const end = new Date(endTime);
        if (end < start) {
          throw new Error("End time cannot be earlier than start time");
        }
      }
      return true;
    }),

  body("mode")
    .optional()
    .isIn(["OFFLINE", "ONLINE", "HYBRID"])
    .withMessage("Mode must be OFFLINE, ONLINE, or HYBRID"),

  body("priority")
    .optional()
    .isIn(["LOW", "NORMAL", "HIGH", "URGENT"])
    .withMessage("Priority must be LOW, NORMAL, HIGH, or URGENT"),

  body("isOutsourced")
    .optional()
    .isBoolean()
    .withMessage("isOutsourced must be a boolean"),

  body("outsourcingDescription")
    .custom((val, { req }) => {
      if (req.body.isOutsourced === true && (!val || !val.trim())) {
        throw new Error("Outsourcing description is required when outsourcing is enabled");
      }
      return true;
    }),
];

export const updateEventStatusValidation = [
  body("status")
    .notEmpty()
    .isIn(["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .withMessage("Invalid event status"),

  body("cancellationReason")
    .custom((reason, { req }) => {
      if (req.body.status === "CANCELLED" && (!reason || !reason.trim())) {
        throw new Error("Cancellation reason is required when cancelling an event");
      }
      return true;
    }),
];

export const masterNameValidation = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 150 })
    .withMessage("Name must be between 2 and 150 characters"),
];
