import { prisma } from "../config/database";
import { JwtUtils } from "../utils/jwt";
import { PasswordUtils } from "../utils/password";
import { EmailService } from "../utils/emailService";
import crypto from "crypto";
import {
  LoginRequest,
  LoginResponse,
  UserProfile,
  EmployeeInfo,
  TokenPair,
  AuthenticationError,
} from "../types/auth";
import { Role } from "../generated/prisma";

// OTP storage interface
interface OTPData {
  otp: string;
  expiresAt: Date;
}

// In-memory OTP storage (use Redis in production)
const otpStorage = new Map<string, OTPData>();

export class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async login(loginData: LoginRequest): Promise<LoginResponse> {
    try {
      const { email, password, rememberMe } = loginData;

      // Validate input
      if (!email || !password) {
        throw new AuthenticationError("Email and password are required");
      }
      console.log("loginData= ", loginData);

      // Find user by email with employee data
      const user = await prisma.user.findUnique({
        where: {
          email: email.toLowerCase(),
          isActive: true,
        },
      });
      console.log("user fetched= ", user);

      if (!user) {
        throw new AuthenticationError("Invalid email or password");
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.verifyPassword(
        password,
        user.password
      );
      if (!isPasswordValid) {
        throw new AuthenticationError("Invalid email or password");
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
      console.log("user= ", user);

      const designation = await prisma.designation.findUnique({
        where: { id: user.designationId || "" },
      });

      if (designation) {
        console.log("designation= ", designation.title);
      }

      // Create user profile
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        role: user.role,
        userD: user,
        userRank: user.userRank || undefined,
        profilePicture: user.profilePicture || null,
        firstName: user.firstName,
        lastName: user.lastName,
        employee: user.employeeId
          ? {
              id: user.id,
              employeeId: user.employeeId,
              firstName: user.firstName,
              lastName: user.lastName,
              position: user.position,
              department: user.department,
              designation: designation ? designation.title : undefined,
              profilePicture: user.profilePicture || null,
              userRank: user.userRank,
              phone: user.phone,
              personalMobile: user.personalMobile,
            }
          : undefined,
      };

      // Generate tokens
      const tokenPair = JwtUtils.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employee?.employeeId,
      });

      return {
        success: true,
        message: "Login successful",
        user: userProfile,
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      console.error("Login error:", error);
      throw new AuthenticationError("Login failed");
    }
  }

  /**
   * Request password reset
   */
  static async forgotPassword(email: string): Promise<boolean> {
    try {
      console.log(`Attempting password reset for: ${email}`);
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        console.log(`User not found for email: ${email}`);
        // Don't reveal that user doesn't exist
        return true;
      }

      console.log(`User found: ${user.id}. Generating reset token...`);

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

      // Save token to user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires,
        },
      });

      console.log(`Sending reset email to ${user.email}...`);
      // Send email
      await EmailService.sendPasswordResetEmail(user.email, resetToken);
      console.log("Reset email sent successfully.");

      return true;
    } catch (error) {
      console.error("Forgot password error:", error);
      throw new Error("Failed to process password reset request");
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(
    token: string,
    password: string
  ): Promise<boolean> {
    try {
      // Find user with valid token
      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw new AuthenticationError("Invalid or expired reset token");
      }

      // Hash new password
      const hashedPassword = await PasswordUtils.hashPassword(password);

      // Update user password and clear token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });

      return true;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error("Reset password error:", error);
      throw new Error("Failed to reset password");
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<TokenPair | null> {
    try {
      return await JwtUtils.refreshAccessToken(refreshToken, async (userId) => {
        const user = await prisma.user.findUnique({
          where: {
            id: userId,
            isActive: true,
          },
        });

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          employee: user.employeeId
            ? { employeeId: user.employeeId }
            : undefined,
        };
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      return null;
    }
  }

  /**
   * Get user profile by ID
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
          isActive: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        userD: user,
        userRank: user.userRank || undefined,
        employee: user.employeeId
          ? {
              id: user.id,
              employeeId: user.employeeId,
              firstName: user.firstName,
              lastName: user.lastName,
              position: user.position,
              department: user.department,
            }
          : undefined,
      };
    } catch (error) {
      console.error("Get user profile error:", error);
      return null;
    }
  }

  /**
   * Verify user credentials for demo purposes
   */
  static async verifyDemoCredentials(
    email: string,
    password: string
  ): Promise<UserProfile | null> {
    // Demo credentials for Iris Communications
    const demoUsers = [
      {
        email: "admin@iriscommunications.com",
        password: "admin123",
        profile: {
          id: "demo-admin-001",
          email: "admin@iriscommunications.com",
          role: "ADMIN" as Role,
          employee: {
            id: "emp-admin-001",
            employeeId: "IC-ADM001",
            firstName: "Sarah",
            lastName: "Johnson",
            position: "HR Director",
            department: "Human Resources",
          },
        },
      },
      {
        email: "user@iriscommunications.com",
        password: "user123",
        profile: {
          id: "demo-user-002",
          email: "user@iriscommunications.com",
          role: "EMPLOYEE" as Role,
          employee: {
            id: "emp-user-002",
            employeeId: "IC-EMP002",
            firstName: "Michael",
            lastName: "Chen",
            position: "Communications Specialist",
            department: "Communications",
          },
        },
      },
    ];

    const demoUser = demoUsers.find(
      (user) => user.email === email.toLowerCase() && user.password === password
    );

    return demoUser
      ? {
          ...demoUser.profile,
          userD: {
            id: demoUser.profile.id,
            email: demoUser.profile.email,
            firstName: demoUser.profile.employee.firstName,
            lastName: demoUser.profile.employee.lastName,
            role: demoUser.profile.role,
            employeeId: demoUser.profile.employee.employeeId,
            // 👇 fill the rest with defaults or nulls
            fatherHusbandName: "",
            cnic: "",
            cnicExpiry: new Date(),
            maritalStatus: "",
            dateOfBirth: new Date(),
            bloodGroup: "",
            gender: "",
            education: "",
            educationInstitute: "",
            educationGrade: "",
            personalEmail: "",
            personalMobile: "",
            officialMobile: "",
            officialEmail: demoUser.profile.email,
            phone: "",
            personalAddress: "",
            address: "",
            city: "",
            state: "",
            zipCode: "",
            country: "",
            userRank: "",
            password: "",
            status: "ACTIVE",
            position: demoUser.profile.employee.position,
            department: demoUser.profile.employee.department,
            manager: "",
            salary: 0,
            currency: "PKR",
            dateOfJoining: new Date(),
            dateOfExit: null,
            hireDate: new Date(),
            endDate: null,
            employmentTypeId: "",
            degreePicture: null,
            cnicPictureFront: null,
            cnicPictureBack: null,
            isActive: true,
            lastLogin: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            emergencyDetailId: "",
            departmentId: "",
            contractTypeId: "",
            designationId: "",
            shiftId: "",
            leaveId: "",
            createdBy: null,
            updatedBy: null,
            educationalDetailId: null,
          },
        }
      : null;
  }

  /**
   * Demo login for development/testing purposes
   */
  static async demoLogin(loginData: LoginRequest): Promise<LoginResponse> {
    try {
      const { email, password } = loginData;

      // Verify demo credentials
      const userProfile = await this.verifyDemoCredentials(email, password);

      if (!userProfile) {
        throw new AuthenticationError("Invalid demo credentials");
      }

      // Generate tokens for demo user
      const tokenPair = JwtUtils.generateTokenPair({
        userId: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        employeeId: userProfile.employee?.employeeId,
      });

      return {
        success: true,
        message: "Demo login successful",
        user: userProfile,
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      console.error("Demo login error:", error);
      throw new AuthenticationError("Demo login failed");
    }
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if user has required role
   */
  static hasRole(userRole: Role, requiredRoles: Role[]): boolean {
    return requiredRoles.includes(userRole);
  }

  /**
   * Check if user can access employee data
   */
  static canAccessEmployeeData(
    currentUser: UserProfile,
    targetEmployeeId: string
  ): boolean {
    // Admins and HR can access all employee data
    if (["ADMIN", "HR", "SUPERADMIN"].includes(currentUser.role)) {
      return true;
    }

    // Users can only access their own data
    return currentUser.employee?.employeeId === targetEmployeeId;
  }

  /**
   * Update profile picture
   */
  static async updateProfilePicture(
    userId: string,
    profilePictureUrl: string
  ): Promise<UserProfile> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { profilePicture: profilePictureUrl },
      });

      const designation = await prisma.designation.findUnique({
        where: { id: user.designationId || "" },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        userD: user,
        userRank: user.userRank || undefined,
        profilePicture: user.profilePicture || null,
        firstName: user.firstName,
        lastName: user.lastName,
        employee: user.employeeId
          ? {
              id: user.id,
              employeeId: user.employeeId,
              firstName: user.firstName,
              lastName: user.lastName,
              position: user.position,
              department: user.department,
              designation: designation ? designation.title : undefined,
              profilePicture: user.profilePicture || null,
              userRank: user.userRank,
              phone: user.phone,
              personalMobile: user.personalMobile,
            }
          : undefined,
      };
    } catch (error) {
      console.error("Update profile picture error:", error);
      throw new Error("Failed to update profile picture");
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    userId: string,
    updateData: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      personalEmail: string;
      personalMobile: string;
      dateOfBirth: string;
      cnic: string;
      personalAddress: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    }>
  ): Promise<UserProfile> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      const designation = await prisma.designation.findUnique({
        where: { id: user.designationId || "" },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        userD: user,
        userRank: user.userRank || undefined,
        profilePicture: user.profilePicture || null,
        firstName: user.firstName,
        lastName: user.lastName,
        employee: user.employeeId
          ? {
              id: user.id,
              employeeId: user.employeeId,
              firstName: user.firstName,
              lastName: user.lastName,
              position: user.position,
              department: user.department,
              designation: designation ? designation.title : undefined,
              profilePicture: user.profilePicture || null,
              userRank: user.userRank,
              phone: user.phone,
              personalMobile: user.personalMobile,
            }
          : undefined,
      };
    } catch (error) {
      console.error("Update profile error:", error);
      throw new Error("Failed to update profile");
    }
  }

  /**
   * Change user password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AuthenticationError("User not found");
      }

      // Verify current password
      const isPasswordValid = await PasswordUtils.verifyPassword(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        throw new AuthenticationError("Current password is incorrect");
      }

      // Hash new password
      const hashedPassword = await PasswordUtils.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error("Change password error:", error);
      throw new Error("Failed to change password");
    }
  }

  /**
   * Send OTP to email for verification
   */
  static async sendEmailOTP(email: string, emailType: string): Promise<void> {
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in memory (use Redis in production)
      const otpKey = `${email.toLowerCase()}-${emailType}`;
      otpStorage.set(otpKey, { otp, expiresAt });

      // Send OTP email
      await EmailService.sendEmailOTP(email, otp, emailType);

      console.log(`OTP sent to ${email}: ${otp} (expires at ${expiresAt})`);
    } catch (error) {
      console.error("Send email OTP error:", error);
      throw new Error("Failed to send OTP");
    }
  }

  /**
   * Verify email OTP
   */
  static async verifyEmailOTP(
    email: string,
    otp: string,
    emailType: string
  ): Promise<boolean> {
    try {
      const otpKey = `${email.toLowerCase()}-${emailType}`;
      const storedOTP = otpStorage.get(otpKey);

      if (!storedOTP) {
        console.log(`No OTP found for key: ${otpKey}`);
        return false;
      }

      // Check if OTP expired
      if (new Date() > storedOTP.expiresAt) {
        console.log(`OTP expired for ${email}`);
        otpStorage.delete(otpKey);
        return false;
      }

      // Verify OTP
      if (storedOTP.otp !== otp) {
        console.log(`Invalid OTP for ${email}. Expected: ${storedOTP.otp}, Got: ${otp}`);
        return false;
      }

      // Clear OTP after successful verification
      otpStorage.delete(otpKey);
      console.log(`OTP verified successfully for ${email}`);

      return true;
    } catch (error) {
      console.error("Verify email OTP error:", error);
      return false;
    }
  }

  /**
   * Clean up expired OTPs periodically
   */
  static cleanupExpiredOTPs(): void {
    const now = new Date();
    for (const [key, value] of otpStorage.entries()) {
      if (now > value.expiresAt) {
        otpStorage.delete(key);
      }
    }
  }

  /**
   * Log security event (for audit purposes)
   */
  static async logSecurityEvent(
    userId: string | null,
    event: string,
    details: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    try {
      // In a real application, you would log to a security audit table
      console.log(`Security Event: ${event}`, {
        userId,
        timestamp: new Date().toISOString(),
        ipAddress,
        details,
      });
    } catch (error) {
      console.error("Failed to log security event:", error);
    }
  }
}

export default AuthService;
