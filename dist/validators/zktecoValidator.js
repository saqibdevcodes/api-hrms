"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAllEmployeesValidator = exports.clearDeviceAttendanceValidator = exports.getAttendanceStatsValidator = exports.getEmpDashboardValidator = exports.getAttendanceDataValidator = exports.syncAttendanceValidator = exports.uploadEmployeeValidator = exports.deviceIdValidator = exports.addDeviceValidator = void 0;
const express_validator_1 = require("express-validator");
exports.addDeviceValidator = [
    (0, express_validator_1.body)("id")
        .notEmpty()
        .withMessage("Device ID is required")
        .isLength({ min: 3, max: 50 })
        .withMessage("Device ID must be between 3 and 50 characters")
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage("Device ID can only contain letters, numbers, underscores, and hyphens"),
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("Device name is required")
        .isLength({ min: 3, max: 100 })
        .withMessage("Device name must be between 3 and 100 characters"),
    (0, express_validator_1.body)("ip")
        .notEmpty()
        .withMessage("IP address is required")
        .isIP(4)
        .withMessage("Please provide a valid IPv4 address"),
    (0, express_validator_1.body)("port")
        .optional()
        .isInt({ min: 1, max: 65535 })
        .withMessage("Port must be a valid integer between 1 and 65535"),
    (0, express_validator_1.body)("serialNumber")
        .optional()
        .isLength({ max: 50 })
        .withMessage("Serial number must not exceed 50 characters"),
    (0, express_validator_1.body)("model")
        .optional()
        .isLength({ max: 50 })
        .withMessage("Model must not exceed 50 characters"),
];
exports.deviceIdValidator = [
    (0, express_validator_1.param)("deviceId")
        .notEmpty()
        .withMessage("Device ID is required")
        .isLength({ min: 3, max: 50 })
        .withMessage("Device ID must be between 3 and 50 characters"),
];
exports.uploadEmployeeValidator = [
    (0, express_validator_1.body)("deviceId").notEmpty().withMessage("Device ID is required"),
    (0, express_validator_1.body)("employeeId").notEmpty().withMessage("Employee ID is required"),
    (0, express_validator_1.body)("cardNumber")
        .optional()
        .isLength({ max: 20 })
        .withMessage("Card number must not exceed 20 characters"),
];
exports.syncAttendanceValidator = [
    (0, express_validator_1.body)("startDate")
        .optional()
        .isISO8601()
        .withMessage("Start date must be a valid ISO 8601 date"),
    (0, express_validator_1.body)("endDate")
        .optional()
        .isISO8601()
        .withMessage("End date must be a valid ISO 8601 date"),
    (0, express_validator_1.body)("deviceId")
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage("Device ID must be between 3 and 50 characters"),
];
exports.getAttendanceDataValidator = [
    (0, express_validator_1.query)("deviceId")
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage("Device ID must be between 3 and 50 characters"),
    (0, express_validator_1.query)("startDate")
        .optional()
        .isISO8601()
        .withMessage("Start date must be a valid ISO 8601 date"),
    (0, express_validator_1.query)("endDate")
        .optional()
        .isISO8601()
        .withMessage("End date must be a valid ISO 8601 date"),
    (0, express_validator_1.query)("employeeId")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("Employee ID must be between 1 and 50 characters"),
    (0, express_validator_1.query)("departmentId")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("Department ID must be between 1 and 50 characters"),
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];
exports.getEmpDashboardValidator = [
    (0, express_validator_1.query)("date")
        .optional()
        .isISO8601()
        .withMessage("Date must be a valid ISO 8601 date"),
];
exports.getAttendanceStatsValidator = [
    (0, express_validator_1.query)("startDate")
        .optional()
        .isISO8601()
        .withMessage("Start date must be a valid ISO 8601 date"),
    (0, express_validator_1.query)("endDate")
        .optional()
        .isISO8601()
        .withMessage("End date must be a valid ISO 8601 date"),
    (0, express_validator_1.query)("departmentId")
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage("Department ID must be between 1 and 50 characters"),
];
exports.clearDeviceAttendanceValidator = [
    (0, express_validator_1.body)("deviceId").notEmpty().withMessage("Device ID is required"),
];
exports.uploadAllEmployeesValidator = [
    (0, express_validator_1.body)("deviceId").notEmpty().withMessage("Device ID is required"),
];
