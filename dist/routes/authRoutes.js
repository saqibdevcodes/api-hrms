"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const authController_1 = require("../controller/authController");
const auth_1 = require("../middleware/auth");
const authValidator_1 = require("../validators/authValidator");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
// Determine if Cloudinary is configured
const isCloudinaryConfigured = !!(env_1.config.CLOUDINARY_CLOUD_NAME &&
    env_1.config.CLOUDINARY_API_KEY &&
    env_1.config.CLOUDINARY_API_SECRET);
// Configure storage based on environment
const storage = isCloudinaryConfigured
    ? new multer_storage_cloudinary_1.CloudinaryStorage({
        cloudinary: cloudinary_1.default,
        params: async (req, file) => {
            return {
                folder: "hrms/profile-pictures",
                allowed_formats: ["jpg", "jpeg", "png", "gif"],
                public_id: `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
                resource_type: "image",
                transformation: [{ width: 400, height: 400, crop: "limit" }],
            };
        },
    })
    : multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = path_1.default.join(process.cwd(), "uploads", "profile-pictures");
            if (!fs_1.default.existsSync(uploadPath)) {
                fs_1.default.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            const extension = path_1.default.extname(file.originalname);
            cb(null, "profile-" + uniqueSuffix + extension);
        },
    });
// File filter for profile pictures
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    }
    else {
        cb(new Error("Profile picture must be an image"), false);
    }
};
// Configure multer upload
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});
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
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post("/forgot-password", authRateLimit, authController_1.AuthController.forgotPassword);
/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post("/reset-password", authRateLimit, authController_1.AuthController.resetPassword);
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
/**
 * @route   POST /api/v1/auth/upload-profile-picture
 * @desc    Upload profile picture
 * @access  Private
 */
router.post("/upload-profile-picture", auth_1.authenticate, upload.single("profilePicture"), authController_1.AuthController.uploadProfilePicture);
/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile", auth_1.authenticate, authController_1.AuthController.updateProfile);
/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put("/change-password", auth_1.authenticate, authController_1.AuthController.changePassword);
/**
 * @route   POST /api/v1/auth/send-email-otp
 * @desc    Send OTP to email for verification
 * @access  Private
 */
router.post("/send-email-otp", auth_1.authenticate, authController_1.AuthController.sendEmailOTP);
/**
 * @route   POST /api/v1/auth/verify-email-otp
 * @desc    Verify email OTP
 * @access  Private
 */
router.post("/verify-email-otp", auth_1.authenticate, authController_1.AuthController.verifyEmailOTP);
exports.default = router;
