import { body } from "express-validator";

export const createDesignationValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Designation title is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Designation title must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s&\-/()]+$/)
    .withMessage(
      "Designation title can only contain letters, numbers, spaces, &, -, /, and ()"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("level")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Level must be a number between 1 and 20"),

  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department cannot exceed 100 characters"),
];

export const updateDesignationValidation = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Designation title cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Designation title must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s&\-/()]+$/)
    .withMessage(
      "Designation title can only contain letters, numbers, spaces, &, -, /, and ()"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("level")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Level must be a number between 1 and 20"),

  body("department")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Department cannot exceed 100 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
