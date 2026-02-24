"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.loanValidation = void 0;
const express_validator_1 = require("express-validator");
exports.loanValidation = [
    (0, express_validator_1.body)("amount")
        .not()
        .isEmpty()
        .withMessage("Amount is required")
        .isNumeric()
        .withMessage("Amount must be a number")
        .trim(),
    (0, express_validator_1.body)("duration")
        .not()
        .isEmpty()
        .withMessage("Duration is required")
        .isNumeric()
        .withMessage("Duration must be a number")
        .trim(),
];
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map((validation) => validation.run(req)));
        const errors = (0, express_validator_1.validationResult)(req);
        if (errors) {
            return res.status(400).send({ errors });
        }
        return next();
    };
};
exports.validate = validate;
