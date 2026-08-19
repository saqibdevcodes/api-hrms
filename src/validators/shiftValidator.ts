import { body } from "express-validator";

export const createShiftValidation = [
  body("companyIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),
  body("name")
    .notEmpty()
    .withMessage("Shift name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Shift name must be between 2 and 100 characters"),

  body("startTime")
    .notEmpty()
    .withMessage("Start time is required")
    .isISO8601()
    .withMessage("Start time must be a valid datetime"),

  body("endTime")
    .notEmpty()
    .withMessage("End time is required")
    .isISO8601()
    .withMessage("End time must be a valid datetime"),

  body("breakTime")
    .optional()
    .isInt({ min: 0, max: 480 })
    .withMessage("Break time must be between 0 and 480 minutes"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

export const updateShiftValidation = [
  body("companyIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Shift name must be between 2 and 100 characters"),

  body("startTime")
    .optional()
    .isISO8601()
    .withMessage("Start time must be a valid datetime"),

  body("endTime")
    .optional()
    .isISO8601()
    .withMessage("End time must be a valid datetime"),

  body("breakTime")
    .optional()
    .isInt({ min: 0, max: 480 })
    .withMessage("Break time must be between 0 and 480 minutes"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
