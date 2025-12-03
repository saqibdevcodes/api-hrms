"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const express_validator_1 = require("express-validator");
const authService_1 = require("../services/authService");
const auth_1 = require("../types/auth");
const env_1 = require("../config/env");
class AuthController {
    /**
     * User login endpoint
     */
    static async login(req, res) {
        try {
            // Check validation errors
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                const response = {
                    success: false,
                    message: "Validation failed",
                    errors: errors.array().map((error) => ({
                        field: error.type === "field" ? error.path : "unknown",
                        message: error.msg,
                    })),
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                };
                res.status(400).json(response);
                return;
            }
            const loginData = req.body;
            // Use real database authentication
            const result = await authService_1.AuthService.login(loginData);
            // Set secure cookies
            const cookieOptions = {
                httpOnly: true,
                secure: env_1.config.COOKIE_SECURE,
                sameSite: env_1.config.COOKIE_SAME_SITE,
                domain: env_1.config.COOKIE_DOMAIN,
                maxAge: loginData.rememberMe
                    ? 30 * 24 * 60 * 60 * 1000
                    : 7 * 24 * 60 * 60 * 1000, // 30 days or 7 days
            };
            res.cookie("auth_token", result.token, cookieOptions);
            res.cookie("refresh_token", result.refreshToken, {
                ...cookieOptions,
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            });
            const response = {
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                    token: result.token,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Login error:", error);
            if (error instanceof auth_1.AuthenticationError) {
                const response = {
                    success: false,
                    message: error.message,
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                };
                res.status(error.statusCode).json(response);
                return;
            }
            const response = {
                success: false,
                message: "Internal server error",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * User logout endpoint
     */
    static async logout(req, res) {
        try {
            // Clear authentication cookies
            res.clearCookie("auth_token", {
                httpOnly: true,
                secure: env_1.config.COOKIE_SECURE,
                sameSite: env_1.config.COOKIE_SAME_SITE,
                domain: env_1.config.COOKIE_DOMAIN,
            });
            res.clearCookie("refresh_token", {
                httpOnly: true,
                secure: env_1.config.COOKIE_SECURE,
                sameSite: env_1.config.COOKIE_SAME_SITE,
                domain: env_1.config.COOKIE_DOMAIN,
            });
            // Log logout event
            if (req.user) {
                await authService_1.AuthService.logSecurityEvent(req.user.id, "LOGOUT_SUCCESS", { method: req.method, path: req.path }, req.ip);
            }
            const response = {
                success: true,
                message: "Logout successful",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Logout error:", error);
            const response = {
                success: false,
                message: "Logout failed",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Token refresh endpoint
     */
    static async refreshToken(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                const response = {
                    success: false,
                    message: "Validation failed",
                    errors: errors.array().map((error) => ({
                        field: error.type === "field" ? error.path : "unknown",
                        message: error.msg,
                    })),
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                };
                res.status(400).json(response);
                return;
            }
            let refreshToken = req.body.refreshToken;
            // If no token in body, check cookies
            if (!refreshToken && req.cookies && req.cookies.refresh_token) {
                refreshToken = req.cookies.refresh_token;
            }
            if (!refreshToken) {
                throw new auth_1.AuthenticationError("Refresh token is required");
            }
            const tokenPair = await authService_1.AuthService.refreshToken(refreshToken);
            if (!tokenPair) {
                throw new auth_1.AuthenticationError("Invalid or expired refresh token");
            }
            // Update cookies with new tokens
            const cookieOptions = {
                httpOnly: true,
                secure: env_1.config.COOKIE_SECURE,
                sameSite: env_1.config.COOKIE_SAME_SITE,
                domain: env_1.config.COOKIE_DOMAIN,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            };
            res.cookie("auth_token", tokenPair.accessToken, cookieOptions);
            res.cookie("refresh_token", tokenPair.refreshToken, {
                ...cookieOptions,
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            });
            const response = {
                success: true,
                message: "Token refreshed successfully",
                data: {
                    token: tokenPair.accessToken,
                    expiresIn: tokenPair.expiresIn,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Token refresh error:", error);
            if (error instanceof auth_1.AuthenticationError) {
                const response = {
                    success: false,
                    message: error.message,
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                };
                res.status(error.statusCode).json(response);
                return;
            }
            const response = {
                success: false,
                message: "Token refresh failed",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Get current user profile
     */
    static async getProfile(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            const response = {
                success: true,
                message: "Profile retrieved successfully",
                data: req.user,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Get profile error:", error);
            const response = {
                success: false,
                message: "Failed to retrieve profile",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Verify authentication status
     */
    static async verifyAuth(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            const response = {
                success: true,
                message: "Authentication verified",
                data: {
                    authenticated: true,
                    user: {
                        id: req.user.id,
                        email: req.user.email,
                        role: req.user.role,
                    },
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: "Authentication verification failed",
                data: {
                    authenticated: false,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(401).json(response);
        }
    }
    /**
     * Health check endpoint
     */
    static async health(req, res) {
        try {
            const response = {
                success: true,
                message: "Iris Communications HRMS API is healthy",
                data: {
                    timestamp: new Date().toISOString(),
                    environment: env_1.config.NODE_ENV,
                    company: env_1.config.COMPANY_NAME,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: "Health check failed",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
}
exports.AuthController = AuthController;
exports.default = AuthController;
