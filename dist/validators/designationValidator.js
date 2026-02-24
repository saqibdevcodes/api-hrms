"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDesignationValidation = exports.createDesignationValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createDesignationValidation = [
    (0, express_validator_1.body)("title")
        .trim()
        .notEmpty()
        .withMessage("Designation title is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Designation title must be between 2 and 100 characters")
        .matches(/^[a-zA-Z0-9\s&\-/()]+$/)
        .withMessage("Designation title can only contain letters, numbers, spaces, &, -, /, and ()"),
    (0, express_validator_1.body)("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    (0, express_validator_1.body)("level")
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage("Level must be a number between 1 and 20"),
    (0, express_validator_1.body)("department")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Department cannot exceed 100 characters"),
];
exports.updateDesignationValidation = [
    (0, express_validator_1.body)("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Designation title cannot be empty")
        .isLength({ min: 2, max: 100 })
        .withMessage("Designation title must be between 2 and 100 characters")
        .matches(/^[a-zA-Z0-9\s&\-/()]+$/)
        .withMessage("Designation title can only contain letters, numbers, spaces, &, -, /, and ()"),
    (0, express_validator_1.body)("description")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    (0, express_validator_1.body)("level")
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage("Level must be a number between 1 and 20"),
    (0, express_validator_1.body)("department")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Department cannot exceed 100 characters"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
