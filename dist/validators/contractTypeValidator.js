"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateContractTypeValidation = exports.createContractTypeValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createContractTypeValidation = [
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("Contract type name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Contract type name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("description")
        .optional()
        .isLength({ max: 500 })
        .withMessage("Description must be at most 500 characters"),
    (0, express_validator_1.body)("duration")
        .optional()
        .isInt({ min: 1, max: 120 })
        .withMessage("Duration must be a positive integer between 1 and 120 months"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
exports.updateContractTypeValidation = [
    (0, express_validator_1.body)("name")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Contract type name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("description")
        .optional()
        .isLength({ max: 500 })
        .withMessage("Description must be at most 500 characters"),
    (0, express_validator_1.body)("duration")
        .optional()
        .isInt({ min: 1, max: 120 })
        .withMessage("Duration must be a positive integer between 1 and 120 months"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
