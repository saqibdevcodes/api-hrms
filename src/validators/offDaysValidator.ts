import { body } from "express-validator";

export const createOffDayValidation = [
  body("date")
    .isISO8601()
    .withMessage("Date must be a valid ISO date")
    .notEmpty()
    .withMessage("Date is required"),
  body("reason")
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Reason must be between 3 and 500 characters"),
];

export const updateOffDayValidation = [
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO date"),
  body("reason")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Reason must be between 3 and 500 characters"),
];

