"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtUtils = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
class JwtUtils {
    /**
     * Generate access token for user authentication
     */
    static generateAccessToken(payload) {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            employeeId: payload.employeeId,
        };
        return jsonwebtoken_1.default.sign(tokenPayload, env_1.config.JWT_SECRET, {
            expiresIn: env_1.config.JWT_EXPIRES_IN,
            issuer: env_1.config.COMPANY_DOMAIN,
            audience: env_1.config.COMPANY_DOMAIN,
        });
    }
    /**
     * Generate refresh token for token renewal
     */
    static generateRefreshToken(payload) {
        const tokenPayload = {
            userId: payload.userId,
            tokenVersion: payload.tokenVersion || 1,
        };
        return jsonwebtoken_1.default.sign(tokenPayload, env_1.config.JWT_SECRET, {
            expiresIn: env_1.config.JWT_REFRESH_EXPIRES_IN,
            issuer: env_1.config.COMPANY_DOMAIN,
            audience: env_1.config.COMPANY_DOMAIN,
        });
    }
    /**
     * Generate both access and refresh tokens
     */
    static generateTokenPair(payload) {
        const accessToken = this.generateAccessToken(payload);
        const refreshToken = this.generateRefreshToken(payload);
        // Get expiration time in seconds
        const decoded = jsonwebtoken_1.default.decode(accessToken);
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        return {
            accessToken,
            refreshToken,
            expiresIn,
            tokenType: "Bearer",
        };
    }
    /**
     * Verify and decode access token
     */
    static verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.config.JWT_SECRET, {
                issuer: env_1.config.COMPANY_DOMAIN,
                audience: env_1.config.COMPANY_DOMAIN,
            });
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error("Access token has expired");
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error("Invalid access token");
            }
            throw new Error("Token verification failed");
        }
    }
    /**
     * Verify and decode refresh token
     */
    static verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.config.JWT_SECRET, {
                issuer: env_1.config.COMPANY_DOMAIN,
                audience: env_1.config.COMPANY_DOMAIN,
            });
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error("Refresh token has expired");
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error("Invalid refresh token");
            }
            throw new Error("Token verification failed");
        }
    }
    /**
     * Extract token from Authorization header
     */
    static extractTokenFromHeader(authHeader) {
        if (!authHeader) {
            return null;
        }
        const parts = authHeader.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return null;
        }
        return parts[1];
    }
    /**
     * Check if token is expired without throwing error
     */
    static isTokenExpired(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            const currentTime = Math.floor(Date.now() / 1000);
            return decoded.exp < currentTime;
        }
        catch {
            return true;
        }
    }
    /**
     * Get token expiration time
     */
    static getTokenExpiration(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp) {
                return null;
            }
            return new Date(decoded.exp * 1000);
        }
        catch {
            return null;
        }
    }
    /**
     * Refresh access token using refresh token
     */
    static async refreshAccessToken(refreshToken, getUserData) {
        try {
            const refreshPayload = this.verifyRefreshToken(refreshToken);
            const userData = await getUserData(refreshPayload.userId);
            if (!userData) {
                return null;
            }
            return this.generateTokenPair({
                userId: userData.id,
                email: userData.email,
                role: userData.role,
                employeeId: userData.employee?.employeeId,
                tokenVersion: refreshPayload.tokenVersion,
            });
        }
        catch {
            return null;
        }
    }
}
exports.JwtUtils = JwtUtils;
exports.default = JwtUtils;
