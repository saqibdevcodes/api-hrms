"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateShiftValidation = exports.createShiftValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createShiftValidation = [
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("Shift name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Shift name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("startTime")
        .notEmpty()
        .withMessage("Start time is required")
        .isISO8601()
        .withMessage("Start time must be a valid datetime"),
    (0, express_validator_1.body)("endTime")
        .notEmpty()
        .withMessage("End time is required")
        .isISO8601()
        .withMessage("End time must be a valid datetime"),
    (0, express_validator_1.body)("breakTime")
        .optional()
        .isInt({ min: 0, max: 480 })
        .withMessage("Break time must be between 0 and 480 minutes"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
exports.updateShiftValidation = [
    (0, express_validator_1.body)("name")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Shift name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("startTime")
        .optional()
        .isISO8601()
        .withMessage("Start time must be a valid datetime"),
    (0, express_validator_1.body)("endTime")
        .optional()
        .isISO8601()
        .withMessage("End time must be a valid datetime"),
    (0, express_validator_1.body)("breakTime")
        .optional()
        .isInt({ min: 0, max: 480 })
        .withMessage("Break time must be between 0 and 480 minutes"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
