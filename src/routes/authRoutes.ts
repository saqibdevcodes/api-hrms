import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controller/authController";
import { authenticate, optionalAuth } from "../middleware/auth";
import {
  loginValidation,
  refreshTokenValidation,
} from "../validators/authValidator";
import { config } from "../config/env";
import { AuthenticatedRequest } from "../types/auth";

const router = Router();

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

// Stricter rate limiting for login attempts
const loginRateLimit = rateLimit({
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
router.get("/health", AuthController.health);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post("/login", loginRateLimit, loginValidation, AuthController.login);

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
  AuthController.refreshToken
);

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

export default router;
 