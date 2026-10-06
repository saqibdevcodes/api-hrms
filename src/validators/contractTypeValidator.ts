import { body } from "express-validator";

const durationValidation = () => [
  body("duration")
    .optional({ values: "null" })
    .custom((value) =>
      (typeof value === "number" && Number.isInteger(value)) ||
      (typeof value === "string" && /^\d+$/.test(value))
    )
    .withMessage("Duration must contain whole numbers only")
    .bail()
    .isInt({ min: 1, max: 120 })
    .withMessage("Duration must be between 1 and 120"),
  body("durationUnit")
    .optional()
    .isString()
    .bail()
    .isIn(["MONTH", "YEAR"])
    .withMessage("Duration unit must be MONTH or YEAR"),
];

export const createContractTypeValidation = [
  body("companyIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),
  body("name")
    .notEmpty()
    .withMessage("Contract type name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Contract type name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),

  ...durationValidation(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

export const updateContractTypeValidation = [
  body("companyIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Contract type name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),

  ...durationValidation(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];
