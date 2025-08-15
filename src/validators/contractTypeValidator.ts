import { body } from "express-validator";

export const createContractTypeValidation = [
  body("name")
    .notEmpty()
    .withMessage("Contract type name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Contract type name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),

  body("duration")
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage(
      "Duration must be a positive integer between 1 and 120 months"
    ),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

export const updateContractTypeValidation = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Contract type name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),

  body("duration")
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage(
      "Duration must be a positive integer between 1 and 120 months"
    ),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
