"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.employeeOnly = exports.hrAndAdmin = exports.adminOnly = exports.SuperAdmin = exports.optionalAuth = exports.authorizeEmployeeAccess = exports.authorize = exports.authenticate = exports.validateRequest = void 0;
const express_validator_1 = require("express-validator");
const jwt_1 = require("../utils/jwt");
const authService_1 = require("../services/authService");
const auth_1 = require("../types/auth");
/**
 * Middleware to validate request using express-validator
 */
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const fieldErrors = errors.array().map((error) => ({
            field: error.type === "field" ? error.path : "unknown",
            message: error.msg,
        }));
        const response = {
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
exports.validateRequest = validateRequest;
/**
 * Middleware to authenticate JWT tokens
 */
const authenticate = async (req, res, next) => {
    try {
        // Extract token from Authorization header or cookies
        let token = jwt_1.JwtUtils.extractTokenFromHeader(req.headers.authorization);
        // If no token in header, check cookies
        if (!token && req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        }
        if (!token) {
            throw new auth_1.AuthenticationError("No authentication token provided");
        }
        // Verify and decode token
        const decoded = jwt_1.JwtUtils.verifyAccessToken(token);
        // Get user profile
        const userProfile = await authService_1.AuthService.getUserProfile(decoded.userId);
        if (!userProfile) {
            throw new auth_1.AuthenticationError("User not found or inactive");
        }
        // Attach user data to request
        req.user = userProfile;
        // Log successful authentication for audit
        await authService_1.AuthService.logSecurityEvent(userProfile.id, "AUTHENTICATION_SUCCESS", { method: req.method, path: req.path }, req.ip);
        next();
    }
    catch (error) {
        // Log failed authentication attempt
        await authService_1.AuthService.logSecurityEvent(null, "AUTHENTICATION_FAILED", {
            method: req.method,
            path: req.path,
            error: error instanceof Error ? error.message : "Unknown error",
        }, req.ip);
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
            message: "Authentication failed",
            meta: {
                timestamp: new Date().toISOString(),
            },
        };
        res.status(401).json(response);
    }
};
exports.authenticate = authenticate;
/**
 * Middleware to check user roles
 */
const authorize = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            console.log("User Role:", req.user.role, "Allowed Roles:", allowedRoles);
            const hasPermission = authService_1.AuthService.hasRole(req.user.role, allowedRoles);
            if (!hasPermission) {
                throw new auth_1.AuthorizationError(`Access denied. Required roles: ${allowedRoles.join(", ")}`);
            }
            // Log successful authorization
            await authService_1.AuthService.logSecurityEvent(req.user.id, "AUTHORIZATION_SUCCESS", {
                method: req.method,
                path: req.path,
                userRole: req.user.role,
                allowedRoles,
            }, req.ip);
            next();
        }
        catch (error) {
            // Log failed authorization attempt
            await authService_1.AuthService.logSecurityEvent(req.user?.id || null, "AUTHORIZATION_FAILED", {
                method: req.method,
                path: req.path,
                userRole: req.user?.role,
                allowedRoles,
                error: error instanceof Error ? error.message : "Unknown error",
            }, req.ip);
            if (error instanceof auth_1.AuthorizationError) {
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
                message: "Authorization failed",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(403).json(response);
        }
    };
};
exports.authorize = authorize;
/**
 * Middleware to check if user can access employee data
 */
const authorizeEmployeeAccess = (getEmployeeIdFromParams) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                throw new auth_1.AuthenticationError("User not authenticated");
            }
            const targetEmployeeId = getEmployeeIdFromParams(req);
            const canAccess = authService_1.AuthService.canAccessEmployeeData(req.user, targetEmployeeId);
            if (!canAccess) {
                throw new auth_1.AuthorizationError("Access denied to employee data");
            }
            next();
        }
        catch (error) {
            if (error instanceof auth_1.AuthorizationError ||
                error instanceof auth_1.AuthenticationError) {
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
                message: "Access authorization failed",
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
            res.status(403).json(response);
        }
    };
};
exports.authorizeEmployeeAccess = authorizeEmployeeAccess;
/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = jwt_1.JwtUtils.extractTokenFromHeader(req.headers.authorization);
        if (!token && req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        }
        if (token) {
            try {
                const decoded = jwt_1.JwtUtils.verifyAccessToken(token);
                const userProfile = await authService_1.AuthService.getUserProfile(decoded.userId);
                if (userProfile) {
                    req.user = userProfile;
                }
            }
            catch {
                // Ignore token errors for optional auth
            }
        }
        next();
    }
    catch (error) {
        // Continue without authentication for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
/**
 * Admin-only middleware
 */
exports.SuperAdmin = (0, exports.authorize)(["SUPERADMIN"]);
/**
 * Admin-only middleware
 */
exports.adminOnly = (0, exports.authorize)(["ADMIN", "SUPERADMIN"]);
/**
 * HR and Admin middleware (HR role can do HR tasks, ADMIN retained for backward compatibility)
 */
exports.hrAndAdmin = (0, exports.authorize)(["HR", "ADMIN", "SUPERADMIN"]);
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
exports.employeeOnly = (0, exports.authorize)(["EMPLOYEE", "ADMIN"]);
/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
    console.error("Global error handler:", error);
    if (error instanceof auth_1.AuthenticationError ||
        error instanceof auth_1.AuthorizationError) {
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
    // Default server error
    const response = {
        success: false,
        message: "Internal server error",
        meta: {
            timestamp: new Date().toISOString(),
        },
    };
    res.status(500).json(response);
};
exports.errorHandler = errorHandler;
exports.default = {
    authenticate: exports.authenticate,
    authorize: exports.authorize,
    authorizeEmployeeAccess: exports.authorizeEmployeeAccess,
    optionalAuth: exports.optionalAuth,
    adminOnly: exports.adminOnly,
    hrAndAdmin: exports.hrAndAdmin,
    employeeOnly: exports.employeeOnly,
    validateRequest: exports.validateRequest,
    errorHandler: exports.errorHandler,
};
