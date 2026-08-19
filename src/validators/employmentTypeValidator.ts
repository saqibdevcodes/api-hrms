import { body } from "express-validator";

export const createEmploymentTypeValidation = [
  body("companyIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Employment type name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Employment type name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage(
      "Employment type name can only contain letters, numbers, spaces, and hyphens"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
];

export const updateEmploymentTypeValidation = [
  body("companyIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Employment type name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("Employment type name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-]+$/)
    .withMessage(
      "Employment type name can only contain letters, numbers, spaces, and hyphens"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
