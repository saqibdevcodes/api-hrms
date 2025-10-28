import { Request } from "express";
import { Role, UserRank } from "../generated/prisma";

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
  token?: string;
  refreshToken?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  userRank?: UserRank;
  employee?: EmployeeInfo;
}

export interface EmployeeInfo {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  avatar?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  employeeId?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

// Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
  employee?: EmployeeInfo;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: FieldError[];
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Error Types
export class AuthenticationError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors: FieldError[];

  constructor(
    message: string,
    errors: FieldError[] = [],
    statusCode: number = 400
  ) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthorizationError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Password Validation
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

// Rate Limiting
export interface RateLimitInfo {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Session Management
export interface SessionData {
  userId: string;
  email: string;
  role: Role;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}
 