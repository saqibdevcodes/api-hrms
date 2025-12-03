"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeavePolicyValidation = exports.createLeavePolicyValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLeavePolicyValidation = [
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("Leave policy name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Leave policy name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("annualLeaves")
        .notEmpty()
        .withMessage("Annual leaves is required")
        .isInt({ min: 0, max: 365 })
        .withMessage("Annual leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("sickLeaves")
        .notEmpty()
        .withMessage("Sick leaves is required")
        .isInt({ min: 0, max: 365 })
        .withMessage("Sick leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("casualLeaves")
        .notEmpty()
        .withMessage("Casual leaves is required")
        .isInt({ min: 0, max: 365 })
        .withMessage("Casual leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("maternityLeaves")
        .notEmpty()
        .withMessage("Maternity leaves is required")
        .isInt({ min: 0, max: 365 })
        .withMessage("Maternity leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("paternityLeaves")
        .notEmpty()
        .withMessage("Paternity leaves is required")
        .isInt({ min: 0, max: 365 })
        .withMessage("Paternity leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
exports.updateLeavePolicyValidation = [
    (0, express_validator_1.body)("name")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Leave policy name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("annualLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Annual leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("sickLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Sick leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("casualLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Casual leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("maternityLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Maternity leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("paternityLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Paternity leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean value"),
];
