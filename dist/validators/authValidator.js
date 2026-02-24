"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordValidation = exports.resetPasswordValidation = exports.forgotPasswordValidation = exports.refreshTokenValidation = exports.loginValidation = void 0;
const express_validator_1 = require("express-validator");
const authService_1 = require("../services/authService");
/**
 * Validation rules for login endpoint
 */
exports.loginValidation = [
    (0, express_validator_1.body)("email")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail()
        .custom((email) => {
        if (!authService_1.AuthService.isValidEmail(email)) {
            throw new Error("Invalid email format");
        }
        return true;
    }),
    (0, express_validator_1.body)("password")
        .isLength({ min: 1 })
        .withMessage("Password is required")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
    (0, express_validator_1.body)("rememberMe")
        .optional()
        .isBoolean()
        .withMessage("Remember me must be a boolean value"),
];
/**
 * Validation rules for refresh token endpoint
 */
exports.refreshTokenValidation = [
    (0, express_validator_1.body)("refreshToken")
        .notEmpty()
        .withMessage("Refresh token is required")
        .isString()
        .withMessage("Refresh token must be a string"),
];
/**
 * Validation rules for password reset request
 */
exports.forgotPasswordValidation = [
    (0, express_validator_1.body)("email")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),
];
/**
 * Validation rules for password reset
 */
exports.resetPasswordValidation = [
    (0, express_validator_1.body)("token").notEmpty().withMessage("Reset token is required"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage("Password must contain at least one lowercase letter, one uppercase letter, and one number"),
    (0, express_validator_1.body)("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Password confirmation does not match password");
        }
        return true;
    }),
];
/**
 * Validation rules for password change
 */
exports.changePasswordValidation = [
    (0, express_validator_1.body)("currentPassword")
        .notEmpty()
        .withMessage("Current password is required"),
    (0, express_validator_1.body)("newPassword")
        .isLength({ min: 8 })
        .withMessage("New password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage("New password must contain at least one lowercase letter, one uppercase letter, and one number"),
    (0, express_validator_1.body)("confirmNewPassword").custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error("New password confirmation does not match new password");
        }
        return true;
    }),
];
exports.default = {
    loginValidation: exports.loginValidation,
    refreshTokenValidation: exports.refreshTokenValidation,
    forgotPasswordValidation: exports.forgotPasswordValidation,
    resetPasswordValidation: exports.resetPasswordValidation,
    changePasswordValidation: exports.changePasswordValidation,
};
