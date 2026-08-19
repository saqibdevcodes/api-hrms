import { body, param, query } from "express-validator";

export const addDeviceValidator = [
  body("id")
    .notEmpty()
    .withMessage("Device ID is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Device ID must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Device ID can only contain letters, numbers, underscores, and hyphens",
    ),

  body("name")
    .notEmpty()
    .withMessage("Device name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Device name must be between 3 and 100 characters"),

  body("ip")
    .notEmpty()
    .withMessage("IP address is required")
    .isIP(4)
    .withMessage("Please provide a valid IPv4 address"),

  body("port")
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage("Port must be a valid integer between 1 and 65535"),

  body("serialNumber")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Serial number must not exceed 50 characters"),

  body("model")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Model must not exceed 50 characters"),
];

export const deviceIdValidator = [
  param("deviceId")
    .notEmpty()
    .withMessage("Device ID is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Device ID must be between 3 and 50 characters"),
];

export const uploadEmployeeValidator = [
  body("deviceId").notEmpty().withMessage("Device ID is required"),

  body("employeeId").notEmpty().withMessage("Employee ID is required"),

  body("cardNumber")
    .optional()
    .isLength({ max: 20 })
    .withMessage("Card number must not exceed 20 characters"),
];

export const syncAttendanceValidator = [
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),

  body("deviceId")
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage("Device ID must be between 3 and 50 characters"),
];

export const getAttendanceDataValidator = [
  query("deviceId")
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage("Device ID must be between 3 and 50 characters"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),

  query("employeeId")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("Employee ID must be between 1 and 50 characters"),

  query("departmentId")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("Department ID must be between 1 and 50 characters"),

  query("companyId")
    .optional()
    .isLength({ min: 1, max: 191 })
    .withMessage("Company ID must be between 1 and 191 characters"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage("Limit must be between 1 and 500"),
];

export const getEmpDashboardValidator = [
  query("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO 8601 date"),
];

export const getAttendanceStatsValidator = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),

  query("departmentId")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("Department ID must be between 1 and 50 characters"),

  query("companyId")
    .optional()
    .isLength({ min: 1, max: 191 })
    .withMessage("Company ID must be between 1 and 191 characters"),
];

export const clearDeviceAttendanceValidator = [
  body("deviceId").notEmpty().withMessage("Device ID is required"),
];

export const uploadAllEmployeesValidator = [
  body("deviceId").notEmpty().withMessage("Device ID is required"),
];
