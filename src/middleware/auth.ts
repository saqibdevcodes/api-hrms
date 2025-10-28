import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { JwtUtils } from "../utils/jwt";
import { AuthService } from "../services/authService";
import {
  AuthenticatedRequest,
  AuthenticationError,
  AuthorizationError,
  ApiResponse,
  FieldError,
} from "../types/auth";
import { Role } from "../generated/prisma";

/**
 * Middleware to validate request using express-validator
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const fieldErrors: FieldError[] = errors.array().map((error) => ({
      field: error.type === "field" ? error.path : "unknown",
      message: error.msg,
    }));

    const response: ApiResponse = {
      success: false,
      message: "Validation failed",
      errors: fieldErrors,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    res.status(400).json(response);
    return;
  }

  next();
};

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or cookies
    let token = JwtUtils.extractTokenFromHeader(req.headers.authorization);

    // If no token in header, check cookies
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      throw new AuthenticationError("No authentication token provided");
    }

    // Verify and decode token
    const decoded = JwtUtils.verifyAccessToken(token);

    // Get user profile
    const userProfile = await AuthService.getUserProfile(decoded.userId);

    if (!userProfile) {
      throw new AuthenticationError("User not found or inactive");
    }

    // Attach user data to request
    req.user = userProfile;

    // Log successful authentication for audit
    await AuthService.logSecurityEvent(
      userProfile.id,
      "AUTHENTICATION_SUCCESS",
      { method: req.method, path: req.path },
      req.ip
    );

    next();
  } catch (error) {
    // Log failed authentication attempt
    await AuthService.logSecurityEvent(
      null,
      "AUTHENTICATION_FAILED",
      {
        method: req.method,
        path: req.path,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      req.ip
    );

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
      message: "Authentication failed",
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
    res.status(401).json(response);
  }
};

/**
 * Middleware to check user roles
 */
export const authorize = (allowedRoles: Role[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError("User not authenticated");
      }
      console.log("User Role:", req.user.role, "Allowed Roles:", allowedRoles);

      const hasPermission = AuthService.hasRole(req.user.role, allowedRoles);

      if (!hasPermission) {
        throw new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(", ")}`
        );
      }

      // Log successful authorization
      await AuthService.logSecurityEvent(
        req.user.id,
        "AUTHORIZATION_SUCCESS",
        {
          method: req.method,
          path: req.path,
          userRole: req.user.role,
          allowedRoles,
        },
        req.ip
      );

      next();
    } catch (error) {
      // Log failed authorization attempt
      await AuthService.logSecurityEvent(
        req.user?.id || null,
        "AUTHORIZATION_FAILED",
        {
          method: req.method,
          path: req.path,
          userRole: req.user?.role,
          allowedRoles,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        req.ip
      );

      if (error instanceof AuthorizationError) {
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
        message: "Authorization failed",
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(403).json(response);
    }
  };
};

/**
 * Middleware to check if user can access employee data
 */
export const authorizeEmployeeAccess = (
  getEmployeeIdFromParams: (req: Request) => string
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError("User not authenticated");
      }

      const targetEmployeeId = getEmployeeIdFromParams(req);
      const canAccess = AuthService.canAccessEmployeeData(
        req.user,
        targetEmployeeId
      );

      if (!canAccess) {
        throw new AuthorizationError("Access denied to employee data");
      }

      next();
    } catch (error) {
      if (
        error instanceof AuthorizationError ||
        error instanceof AuthenticationError
      ) {
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
        message: "Access authorization failed",
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(403).json(response);
    }
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = JwtUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (token) {
      try {
        const decoded = JwtUtils.verifyAccessToken(token);
        const userProfile = await AuthService.getUserProfile(decoded.userId);

        if (userProfile) {
          req.user = userProfile;
        }
      } catch {
        // Ignore token errors for optional auth
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Admin-only middleware
 */
export const SuperAdmin = authorize(["SUPERADMIN"]);

/**
 * Admin-only middleware
 */
export const adminOnly = authorize(["ADMIN", "SUPERADMIN"]);

/**
 * HR and Admin middleware
 */
export const hrAndAdmin = authorize(["ADMIN", "SUPERADMIN"]);

/**
 * Manager and above middleware
 */
// export const managerAndAbove = authorize(["MANAGER", "HR", "ADMIN"]);

/**
 * HR-only middleware
 */
// export const hrOnly = authorize(["HR"]);

/**
 * Manager-only middleware
 */
// export const managerOnly = authorize(["MANAGER"]);

/**
 * Employee-only middleware (all authenticated users)
 */
export const employeeOnly = authorize(["EMPLOYEE", "ADMIN"]);

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Global error handler:", error);

  if (
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError
  ) {
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

  // Default server error
  const response: ApiResponse = {
    success: false,
    message: "Internal server error",
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  res.status(500).json(response);
};

export default {
  authenticate,
  authorize,
  authorizeEmployeeAccess,
  optionalAuth,
  adminOnly,
  hrAndAdmin,
  employeeOnly,
  validateRequest,
  errorHandler,
};
