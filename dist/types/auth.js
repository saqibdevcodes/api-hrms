"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationError = exports.ValidationError = exports.AuthenticationError = void 0;
// Error Types
class AuthenticationError extends Error {
    constructor(message, statusCode = 401) {
        super(message);
        this.name = "AuthenticationError";
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AuthenticationError = AuthenticationError;
class ValidationError extends Error {
    constructor(message, errors = [], statusCode = 400) {
        super(message);
        this.name = "ValidationError";
        this.statusCode = statusCode;
        this.isOperational = true;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ValidationError = ValidationError;
class AuthorizationError extends Error {
    constructor(message, statusCode = 403) {
        super(message);
        this.name = "AuthorizationError";
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AuthorizationError = AuthorizationError;
