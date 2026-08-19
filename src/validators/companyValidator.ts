import { body } from "express-validator";

const optionalText = (field: string, max: number) =>
  body(field)
    .optional({ nullable: true })
    .trim()
    .isLength({ max })
    .withMessage(`${field} cannot exceed ${max} characters`);

export const createCompanyValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Company name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Company name must be between 2 and 100 characters"),
  optionalText("description", 1000),
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("A valid company email is required"),
  optionalText("phone", 50),
  body("website")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isURL({ require_protocol: false })
    .withMessage("A valid website is required"),
  optionalText("address", 1000),
];

export const updateCompanyValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Company name cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Company name must be between 2 and 100 characters"),
  optionalText("description", 1000),
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("A valid company email is required"),
  optionalText("phone", 50),
  body("website")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isURL({ require_protocol: false })
    .withMessage("A valid website is required"),
  optionalText("address", 1000),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const assignCompanyEmployeesValidation = [
  body("employeeIds")
    .isArray()
    .withMessage("employeeIds must be an array"),
  body("employeeIds.*")
    .isString()
    .notEmpty()
    .withMessage("Each employee ID must be a non-empty string"),
];

