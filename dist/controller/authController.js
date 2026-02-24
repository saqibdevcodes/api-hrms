"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const express_validator_1 = require("express-validator");
const authService_1 = require("../services/authService");
const auth_1 = require("../types/auth");
const env_1 = require("../config/env");
class AuthController {
    /**
     * Request password reset
     */
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                res.status(400).json({
                    success: false,
                    message: "Email is required",
                });
                return;
            }
            await authService_1.AuthService.forgotPassword(email);
            res.status(200).json({
                success: true,
                message: "If an account with that email exists, a password reset link has been sent.",
            });
        }
        catch (error) {
            console.error("Forgot password error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to process request",
            });
        }
    }
    /**
     * Reset password
     */
    static async resetPassword(req, res) {
        try {
            const { token, password } = req.body;
            if (!token || !password) {
                res.status(400).json({
                    success: false,
                    message: "Token and password are required",
                });
                return;
            }
            await authService_1.AuthService.resetPassword(token, password);
            res.status(200).json({
                success: true,
                message: "Password reset successful",
            });
        }
        catch (error) {
            console.error("Reset password error:", error);
            if (error instanceof auth_1.AuthenticationError) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: "Failed to reset password",
            });
        }
    }
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
     * Upload profile picture
     */
    static async uploadProfilePicture(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    message: "No profile picture file provided",
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }
            // Get the file URL based on storage type (Cloudinary or local)
            let profilePictureUrl;
            // Check if it's a Cloudinary upload (has secure_url or starts with http)
            if (req.file.secure_url) {
                // Cloudinary upload - use the secure_url
                profilePictureUrl = req.file.secure_url;
            }
            else if (req.file.path && req.file.path.startsWith('http')) {
                // Cloudinary upload - use path if it's a URL
                profilePictureUrl = req.file.path;
            }
            else {
                // Local storage - construct the URL
                profilePictureUrl = `/uploads/profile-pictures/${req.file.filename}`;
            }
            // Update user's profile picture in database
            const updatedUser = await authService_1.AuthService.updateProfilePicture(req.user.id, profilePictureUrl);
            const response = {
                success: true,
                message: "Profile picture uploaded successfully",
                data: {
                    profilePicture: profilePictureUrl,
                    user: updatedUser,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Upload profile picture error:", error);
            const response = {
                success: false,
                message: "Failed to upload profile picture",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Update user profile
     */
    static async updateProfile(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            // Extract and remove verification fields that shouldn't be saved to database
            const { emailOtp, emailType, personalPhoneNumber, officialPhoneNumber, personalEmail, officialEmail, personalAddress, ...restData } = req.body;
            // Map frontend field names to database schema field names
            const updateData = {
                ...restData,
            };
            // Map phone numbers
            if (personalPhoneNumber !== undefined) {
                updateData.personalMobile = personalPhoneNumber;
            }
            if (officialPhoneNumber !== undefined) {
                updateData.officialMobile = officialPhoneNumber;
            }
            // Map emails - only update if email was changed and OTP verified
            if (emailType && emailOtp) {
                // Email was changed and OTP verified
                if (emailType === 'official' && officialEmail !== undefined) {
                    updateData.email = officialEmail;
                }
                else if (emailType === 'personal' && personalEmail !== undefined) {
                    // Note: personalEmail doesn't have a separate field in current schema
                    // For now, also update the main email field
                    updateData.email = personalEmail;
                }
            }
            // If no emailType/emailOtp, don't update email at all (prevents unique constraint errors)
            // Map address
            if (personalAddress !== undefined) {
                updateData.address = personalAddress;
            }
            // Update user profile in database
            const updatedUser = await authService_1.AuthService.updateProfile(req.user.id, updateData);
            const response = {
                success: true,
                message: "Profile updated successfully",
                data: updatedUser,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Update profile error:", error);
            const response = {
                success: false,
                message: "Failed to update profile",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Change password
     */
    static async changePassword(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                res.status(400).json({
                    success: false,
                    message: "Current password and new password are required",
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }
            // Change password
            await authService_1.AuthService.changePassword(req.user.id, currentPassword, newPassword);
            const response = {
                success: true,
                message: "Password changed successfully",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Change password error:", error);
            if (error instanceof auth_1.AuthenticationError) {
                const response = {
                    success: false,
                    message: error.message,
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                };
                res.status(400).json(response);
                return;
            }
            const response = {
                success: false,
                message: "Failed to change password",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Send OTP to email for verification
     */
    static async sendEmailOTP(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            const { email, emailType } = req.body;
            if (!email || !emailType) {
                res.status(400).json({
                    success: false,
                    message: "Email and email type are required",
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }
            // Send OTP
            await authService_1.AuthService.sendEmailOTP(email, emailType);
            const response = {
                success: true,
                message: "OTP sent successfully",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Send email OTP error:", error);
            const response = {
                success: false,
                message: "Failed to send OTP",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
        }
    }
    /**
     * Verify email OTP
     */
    static async verifyEmailOTP(req, res) {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            const { email, otp, emailType } = req.body;
            if (!email || !otp || !emailType) {
                res.status(400).json({
                    success: false,
                    message: "Email, OTP, and email type are required",
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }
            // Verify OTP
            const isValid = await authService_1.AuthService.verifyEmailOTP(email, otp, emailType);
            if (!isValid) {
                res.status(400).json({
                    success: false,
                    message: "Invalid or expired OTP",
                    meta: {
                        timestamp: new Date().toISOString(),
                    },
                });
                return;
            }
            const response = {
                success: true,
                message: "OTP verified successfully",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error("Verify email OTP error:", error);
            const response = {
                success: false,
                message: "Failed to verify OTP",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(500).json(response);
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
