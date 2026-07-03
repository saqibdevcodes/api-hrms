import { body } from "express-validator";

export const createEmployeeLeaveValidation = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string"),

  body("annualLeaves")
    .notEmpty()
    .withMessage("Annual leaves is required")
    .isInt({ min: 0, max: 365 })
    .withMessage("Annual leaves must be between 0 and 365 days"),

  body("sickLeaves")
    .notEmpty()
    .withMessage("Sick leaves is required")
    .isInt({ min: 0, max: 365 })
    .withMessage("Sick leaves must be between 0 and 365 days"),

  body("casualLeaves")
    .notEmpty()
    .withMessage("Casual leaves is required")
    .isInt({ min: 0, max: 365 })
    .withMessage("Casual leaves must be between 0 and 365 days"),

  body("leavePolicyId")
    .optional()
    .isString()
    .withMessage("Leave policy ID must be a string"),
];

export const updateEmployeeLeaveValidation = [
  body("annualLeaves")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("Annual leaves must be between 0 and 365 days"),

  body("sickLeaves")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("Sick leaves must be between 0 and 365 days"),

  body("casualLeaves")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("Casual leaves must be between 0 and 365 days"),

  body("leavePolicyId")
    .optional()
    .isString()
    .withMessage("Leave policy ID must be a string"),
];

export const initializeFromPolicyValidation = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string"),

  body("leavePolicyId")
    .notEmpty()
    .withMessage("Leave policy ID is required")
    .isString()
    .withMessage("Leave policy ID must be a string"),
];
