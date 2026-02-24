"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeFromPolicyValidation = exports.updateEmployeeLeaveValidation = exports.createEmployeeLeaveValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createEmployeeLeaveValidation = [
    (0, express_validator_1.body)("userId")
        .notEmpty()
        .withMessage("User ID is required")
        .isString()
        .withMessage("User ID must be a string"),
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
    (0, express_validator_1.body)("compensatoryLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Compensatory leaves must be between 0 and 365 days"),
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
    (0, express_validator_1.body)("leavePolicyId")
        .optional()
        .isString()
        .withMessage("Leave policy ID must be a string"),
];
exports.updateEmployeeLeaveValidation = [
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
    (0, express_validator_1.body)("compensatoryLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Compensatory leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("maternityLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Maternity leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("paternityLeaves")
        .optional()
        .isInt({ min: 0, max: 365 })
        .withMessage("Paternity leaves must be between 0 and 365 days"),
    (0, express_validator_1.body)("leavePolicyId")
        .optional()
        .isString()
        .withMessage("Leave policy ID must be a string"),
];
exports.initializeFromPolicyValidation = [
    (0, express_validator_1.body)("userId")
        .notEmpty()
        .withMessage("User ID is required")
        .isString()
        .withMessage("User ID must be a string"),
    (0, express_validator_1.body)("leavePolicyId")
        .notEmpty()
        .withMessage("Leave policy ID is required")
        .isString()
        .withMessage("Leave policy ID must be a string"),
];
