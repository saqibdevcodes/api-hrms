"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDepartmentValidation = exports.createDepartmentValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createDepartmentValidation = [
    (0, express_validator_1.body)("name")
        .trim()
        .notEmpty()
        .withMessage("Department name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Department name must be between 2 and 100 characters")
        .matches(/^[a-zA-Z0-9\s&-]+$/)
        .withMessage("Department name can only contain letters, numbers, spaces, & and -"),
    (0, express_validator_1.body)("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    (0, express_validator_1.body)("manager")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Manager name cannot exceed 100 characters"),
    (0, express_validator_1.body)("budget")
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
exports.updateDepartmentValidation = [
    (0, express_validator_1.body)("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Department name cannot be empty")
        .isLength({ min: 2, max: 100 })
        .withMessage("Department name must be between 2 and 100 characters")
        .matches(/^[a-zA-Z0-9\s&-]+$/)
        .withMessage("Department name can only contain letters, numbers, spaces, & and -"),
    (0, express_validator_1.body)("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    (0, express_validator_1.body)("manager")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Manager name cannot exceed 100 characters"),
    (0, express_validator_1.body)("budget")
        .optional()
        .isNumeric()
        .withMessage("Budget must be a valid number")
        .custom((value) => {
        if (value && parseFloat(value) < 0) {
            throw new Error("Budget cannot be negative");
        }
        return true;
    }),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
