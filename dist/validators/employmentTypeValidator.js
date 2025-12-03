"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmploymentTypeValidation = exports.createEmploymentTypeValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createEmploymentTypeValidation = [
    (0, express_validator_1.body)("name")
        .trim()
        .notEmpty()
        .withMessage("Employment type name is required")
        .isLength({ min: 2, max: 50 })
        .withMessage("Employment type name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z0-9\s\-]+$/)
        .withMessage("Employment type name can only contain letters, numbers, spaces, and hyphens"),
    (0, express_validator_1.body)("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
];
exports.updateEmploymentTypeValidation = [
    (0, express_validator_1.body)("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Employment type name cannot be empty")
        .isLength({ min: 2, max: 50 })
        .withMessage("Employment type name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z0-9\s\-]+$/)
        .withMessage("Employment type name can only contain letters, numbers, spaces, and hyphens"),
    (0, express_validator_1.body)("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
