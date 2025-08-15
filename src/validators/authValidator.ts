import { body, ValidationChain } from "express-validator";
import { AuthService } from "../services/authService";

/**
 * Validation rules for login endpoint
 */
export const loginValidation: ValidationChain[] = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .custom((email) => {
      if (!AuthService.isValidEmail(email)) {
        throw new Error("Invalid email format");
      }
      return true;
    }),

  body("password")
    .isLength({ min: 1 })
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("rememberMe")
    .optional()
    .isBoolean()
    .withMessage("Remember me must be a boolean value"),
];

/**
 * Validation rules for refresh token endpoint
 */
export const refreshTokenValidation: ValidationChain[] = [
  body("refreshToken")
    .notEmpty()
    .withMessage("Refresh token is required")
    .isString()
    .withMessage("Refresh token must be a string"),
];

/**
 * Validation rules for password reset request
 */
export const forgotPasswordValidation: ValidationChain[] = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
];

/**
 * Validation rules for password reset
 */
export const resetPasswordValidation: ValidationChain[] = [
  body("token").notEmpty().withMessage("Reset token is required"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),
];

/**
 * Validation rules for password change
 */
export const changePasswordValidation: ValidationChain[] = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("confirmNewPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("New password confirmation does not match new password");
    }
    return true;
  }),
];

export default {
  loginValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
};
