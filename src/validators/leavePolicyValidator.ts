import { body } from "express-validator";

export const createLeavePolicyValidation = [
  body("name")
    .notEmpty()
    .withMessage("Leave policy name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Leave policy name must be between 2 and 100 characters"),

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

  body("maternityLeaves")
    .notEmpty()
    .withMessage("Maternity leaves is required")
    .isInt({ min: 0, max: 365 })
    .withMessage("Maternity leaves must be between 0 and 365 days"),

  body("paternityLeaves")
    .notEmpty()
    .withMessage("Paternity leaves is required")
    .isInt({ min: 0, max: 365 })
    .withMessage("Paternity leaves must be between 0 and 365 days"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

export const updateLeavePolicyValidation = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Leave policy name must be between 2 and 100 characters"),

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

  body("maternityLeaves")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("Maternity leaves must be between 0 and 365 days"),

  body("paternityLeaves")
    .optional()
    .isInt({ min: 0, max: 365 })
    .withMessage("Paternity leaves must be between 0 and 365 days"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
