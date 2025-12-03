"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOffDayValidation = exports.createOffDayValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createOffDayValidation = [
    (0, express_validator_1.body)("date")
        .isISO8601()
        .withMessage("Date must be a valid ISO date")
        .notEmpty()
        .withMessage("Date is required"),
    (0, express_validator_1.body)("reason")
        .isString()
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage("Reason must be between 3 and 500 characters"),
];
exports.updateOffDayValidation = [
    (0, express_validator_1.body)("date")
        .optional()
        .isISO8601()
        .withMessage("Date must be a valid ISO date"),
    (0, express_validator_1.body)("reason")
        .optional()
        .isString()
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage("Reason must be between 3 and 500 characters"),
];
