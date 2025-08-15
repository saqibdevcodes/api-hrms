import { body } from "express-validator";

export const createDepartmentValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Department name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Department name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s&-]+$/)
    .withMessage(
      "Department name can only contain letters, numbers, spaces, & and -"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("manager")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Manager name cannot exceed 100 characters"),

  body("budget")
    .optional()
    .isNumeric()
    .withMessage("Budget must be a valid number")
    .custom((value) => {
      if (value && parseFloat(value) < 0) {
        throw new Error("Budget cannot be negative");
      }
      return true;
    }),
];

export const updateDepartmentValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Department name cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Department name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s&-]+$/)
    .withMessage(
      "Department name can only contain letters, numbers, spaces, & and -"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("manager")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Manager name cannot exceed 100 characters"),

  body("budget")
    .optional()
    .isNumeric()
    .withMessage("Budget must be a valid number")
    .custom((value) => {
      if (value && parseFloat(value) < 0) {
        throw new Error("Budget cannot be negative");
      }
      return true;
    }),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
