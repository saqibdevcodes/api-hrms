import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import path from "path";
import fs from "fs";
import cloudinary from "../config/cloudinary";
import { AuthController } from "../controller/authController";
import { authenticate, optionalAuth } from "../middleware/auth";
import {
  loginValidation,
  refreshTokenValidation,
} from "../validators/authValidator";
import { config } from "../config/env";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

// Determine if Cloudinary is configured
const isCloudinaryConfigured = !!(
  config.CLOUDINARY_CLOUD_NAME &&
  config.CLOUDINARY_API_KEY &&
  config.CLOUDINARY_API_SECRET
);

// Configure storage based on environment
const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
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
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(
          process.cwd(),
          "uploads",
          "profile-pictures",
        );
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const extension = path.extname(file.originalname);
        cb(null, "profile-" + uniqueSuffix + extension);
      },
    });

// File filter for profile pictures
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Profile picture must be an image"), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: config.RATE_LIMIT_MAX_REQUESTS, // Limit each IP to 100 requests per windowMs
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

/**
 * @route   GET /api/v1/auth/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get("/health", AuthController.health);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post("/login", loginValidation, AuthController.login);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and clear authentication cookies
 * @access  Private
 */
router.post("/logout", authenticate, AuthController.logout);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token)
 */
router.post(
  "/refresh",
  authRateLimit,
  refreshTokenValidation,
  AuthController.refreshToken,
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post("/forgot-password", authRateLimit, AuthController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post("/reset-password", authRateLimit, AuthController.resetPassword);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authenticate, AuthController.getProfile);

/**
 * @route   GET /api/v1/auth/verify
 * @desc    Verify authentication status
 * @access  Private
 */
router.get("/verify", authenticate, AuthController.verifyAuth);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get authenticated user info (optional auth)
 * @access  Public/Private
 */
router.get("/me", optionalAuth, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    res.json({
      success: true,
      message: "User authenticated",
      data: req.user,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } else {
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
router.post(
  "/upload-profile-picture",
  authenticate,
  upload.single("profilePicture"),
  AuthController.uploadProfilePicture,
);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile", authenticate, AuthController.updateProfile);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put("/change-password", authenticate, AuthController.changePassword);

/**
 * @route   POST /api/v1/auth/send-email-otp
 * @desc    Send OTP to email for verification
 * @access  Private
 */
router.post("/send-email-otp", authenticate, AuthController.sendEmailOTP);

/**
 * @route   POST /api/v1/auth/verify-email-otp
 * @desc    Verify email OTP
 * @access  Private
 */
router.post("/verify-email-otp", authenticate, AuthController.verifyEmailOTP);

export default router;
