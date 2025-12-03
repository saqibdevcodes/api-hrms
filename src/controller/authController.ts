import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { AuthService } from "../services/authService";
import {
  LoginRequest,
  AuthenticatedRequest,
  ApiResponse,
  AuthenticationError,
  ValidationError as CustomValidationError,
} from "../types/auth";
import { config } from "../config/env";

export class AuthController {
  /**
   * Request password reset
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email is required",
        });
        return;
      }

      await AuthService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
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
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        res.status(400).json({
          success: false,
          message: "Token and password are required",
        });
        return;
      }

      await AuthService.resetPassword(token, password);

      res.status(200).json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      console.error("Reset password error:", error);

      if (error instanceof AuthenticationError) {
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
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
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

      const loginData: LoginRequest = req.body;

      // Use real database authentication
      const result = await AuthService.login(loginData);

      // Set secure cookies
      const cookieOptions = {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE as "strict" | "lax" | "none",
        domain: config.COOKIE_DOMAIN,
        maxAge: loginData.rememberMe
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000, // 30 days or 7 days
      };

      res.cookie("auth_token", result.token, cookieOptions);
      res.cookie("refresh_token", result.refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const response: ApiResponse = {
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
    } catch (error) {
      console.error("Login error:", error);

      if (error instanceof AuthenticationError) {
        const response: ApiResponse = {
          success: false,
          message: error.message,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
        res.status(error.statusCode).json(response);
        return;
      }

      const response: ApiResponse = {
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
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Clear authentication cookies
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE as "strict" | "lax" | "none",
        domain: config.COOKIE_DOMAIN,
      });

      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE as "strict" | "lax" | "none",
        domain: config.COOKIE_DOMAIN,
      });

      // Log logout event
      if (req.user) {
        await AuthService.logSecurityEvent(
          req.user.id,
          "LOGOUT_SUCCESS",
          { method: req.method, path: req.path },
          req.ip
        );
      }

      const response: ApiResponse = {
        success: true,
        message: "Logout successful",
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Logout error:", error);

      const response: ApiResponse = {
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
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
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
        throw new AuthenticationError("Refresh token is required");
      }

      const tokenPair = await AuthService.refreshToken(refreshToken);

      if (!tokenPair) {
        throw new AuthenticationError("Invalid or expired refresh token");
      }

      // Update cookies with new tokens
      const cookieOptions = {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE as "strict" | "lax" | "none",
        domain: config.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      res.cookie("auth_token", tokenPair.accessToken, cookieOptions);
      res.cookie("refresh_token", tokenPair.refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const response: ApiResponse = {
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
    } catch (error) {
      console.error("Token refresh error:", error);

      if (error instanceof AuthenticationError) {
        const response: ApiResponse = {
          success: false,
          message: error.message,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
        res.status(error.statusCode).json(response);
        return;
      }

      const response: ApiResponse = {
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
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("User not authenticated");
      }

      const response: ApiResponse = {
        success: true,
        message: "Profile retrieved successfully",
        data: req.user,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Get profile error:", error);

      const response: ApiResponse = {
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
  static async verifyAuth(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("User not authenticated");
      }

      const response: ApiResponse = {
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
    } catch (error) {
      const response: ApiResponse = {
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
  static async health(req: Request, res: Response): Promise<void> {
    try {
      const response: ApiResponse = {
        success: true,
        message: "Iris Communications HRMS API is healthy",
        data: {
          timestamp: new Date().toISOString(),
          environment: config.NODE_ENV,
          company: config.COMPANY_NAME,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
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

export default AuthController;
