import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JwtPayload, RefreshTokenPayload, TokenPair } from "../types/auth";
// import { Role } from "../generated/prisma";
import { Role } from "@prisma/client";

export class JwtUtils {
  /**
   * Generate access token for user authentication
   */
  static generateAccessToken(payload: {
    userId: string;
    email: string;
    role: Role;
    employeeId?: string;
  }): string {
    const tokenPayload: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
    };

    return jwt.sign(tokenPayload, config.JWT_SECRET as string, {
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: config.COMPANY_DOMAIN,
      audience: config.COMPANY_DOMAIN,
    });
  }

  /**
   * Generate refresh token for token renewal
   */
  static generateRefreshToken(payload: {
    userId: string;
    tokenVersion?: number;
  }): string {
    const tokenPayload: RefreshTokenPayload = {
      userId: payload.userId,
      tokenVersion: payload.tokenVersion || 1,
    };

    return jwt.sign(tokenPayload, config.JWT_SECRET as string, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
      issuer: config.COMPANY_DOMAIN,
      audience: config.COMPANY_DOMAIN,
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(payload: {
    userId: string;
    email: string;
    role: Role;
    employeeId?: string;
    tokenVersion?: number;
  }): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Get expiration time in seconds
    const decoded = jwt.decode(accessToken) as any;
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
  static verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET, {
        issuer: config.COMPANY_DOMAIN,
        audience: config.COMPANY_DOMAIN,
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Access token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid access token");
      }
      throw new Error("Token verification failed");
    }
  }

  /**
   * Verify and decode refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET, {
        issuer: config.COMPANY_DOMAIN,
        audience: config.COMPANY_DOMAIN,
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Refresh token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid refresh token");
      }
      throw new Error("Token verification failed");
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader?: string): string | null {
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
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    getUserData: (userId: string) => Promise<{
      id: string;
      email: string;
      role: Role;
      employee?: { employeeId: string };
    } | null>
  ): Promise<TokenPair | null> {
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
    } catch {
      return null;
    }
  }
}

export default JwtUtils;
