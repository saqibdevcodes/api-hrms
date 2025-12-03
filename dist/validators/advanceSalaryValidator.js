"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAsrValidator = void 0;
const express_validator_1 = require("express-validator");
const createAdvanceSalaryRequest = [
    (0, express_validator_1.body)("daysCount")
        .not()
        .isEmpty()
        .withMessage("The day count should not be empty")
        .isNumeric()
        .withMessage("The day count must be a numeric notation"),
    (0, express_validator_1.body)("reason")
        .not()
        .isEmpty()
        .withMessage("The reason for the advance Salary Request should not be empty")
        .isString()
        .isLength({ min: 5 })
        .withMessage("The given reason should be characters more than 5"),
];
exports.createAsrValidator = createAdvanceSalaryRequest;
