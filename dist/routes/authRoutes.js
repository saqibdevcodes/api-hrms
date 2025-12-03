"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authController_1 = require("../controller/authController");
const auth_1 = require("../middleware/auth");
const authValidator_1 = require("../validators/authValidator");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
// Rate limiting for authentication endpoints
const authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: env_1.config.RATE_LIMIT_WINDOW_MS, // 15 minutes
    max: env_1.config.RATE_LIMIT_MAX_REQUESTS, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: "Too many authentication attempts, please try again later",
        meta: {
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
// Stricter rate limiting for login attempts
const loginRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per 15 minutes
    message: {
        success: false,
        message: "Too many login attempts, please try again in 15 minutes",
        meta: {
            timestamp: new Date().toISOString(),
        },
    },
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * @route   GET /api/v1/auth/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get("/health", authController_1.AuthController.health);
/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post("/login", loginRateLimit, authValidator_1.loginValidation, authController_1.AuthController.login);
/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and clear authentication cookies
 * @access  Private
 */
router.post("/logout", auth_1.authenticate, authController_1.AuthController.logout);
/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token)
 */
router.post("/refresh", authRateLimit, authValidator_1.refreshTokenValidation, authController_1.AuthController.refreshToken);
/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", auth_1.authenticate, authController_1.AuthController.getProfile);
/**
 * @route   GET /api/v1/auth/verify
 * @desc    Verify authentication status
 * @access  Private
 */
router.get("/verify", auth_1.authenticate, authController_1.AuthController.verifyAuth);
/**
 * @route   GET /api/v1/auth/me
 * @desc    Get authenticated user info (optional auth)
 * @access  Public/Private
 */
router.get("/me", auth_1.optionalAuth, (req, res) => {
    if (req.user) {
        res.json({
            success: true,
            message: "User authenticated",
            data: req.user,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
    else {
        res.json({
            success: false,
            message: "User not authenticated",
            data: null,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
});
exports.default = router;
