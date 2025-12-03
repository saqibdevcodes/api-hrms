"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const database_1 = require("../config/database");
const jwt_1 = require("../utils/jwt");
const password_1 = require("../utils/password");
const auth_1 = require("../types/auth");
class AuthService {
    /**
     * Authenticate user with email and password
     */
    static async login(loginData) {
        try {
            const { email, password, rememberMe } = loginData;
            // Validate input
            if (!email || !password) {
                throw new auth_1.AuthenticationError("Email and password are required");
            }
            console.log("loginData= ", loginData);
            // Find user by email with employee data
            const user = await database_1.prisma.user.findUnique({
                where: {
                    email: email.toLowerCase(),
                    isActive: true,
                },
            });
            console.log("user fetched= ", user);
            if (!user) {
                throw new auth_1.AuthenticationError("Invalid email or password");
            }
            // Verify password
            const isPasswordValid = await password_1.PasswordUtils.verifyPassword(password, user.password);
            if (!isPasswordValid) {
                throw new auth_1.AuthenticationError("Invalid email or password");
            }
            // Update last login
            await database_1.prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() },
            });
            console.log("user= ", user);
            const designation = await database_1.prisma.designation.findUnique({
                where: { id: user.designationId || "" },
            });
            if (designation) {
                console.log("designation= ", designation.title);
            }
            // Create user profile
            const userProfile = {
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
                        designation: designation ? designation.title : undefined,
                        userRank: user.userRank,
                        phone: user.phone,
                        personalMobile: user.personalMobile,
                    }
                    : undefined,
            };
            // Generate tokens
            const tokenPair = jwt_1.JwtUtils.generateTokenPair({
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
        }
        catch (error) {
            if (error instanceof auth_1.AuthenticationError) {
                throw error;
            }
            console.error("Login error:", error);
            throw new auth_1.AuthenticationError("Login failed");
        }
    }
    /**
     * Refresh access token using refresh token
     */
    static async refreshToken(refreshToken) {
        try {
            return await jwt_1.JwtUtils.refreshAccessToken(refreshToken, async (userId) => {
                const user = await database_1.prisma.user.findUnique({
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
        }
        catch (error) {
            console.error("Token refresh error:", error);
            return null;
        }
    }
    /**
     * Get user profile by ID
     */
    static async getUserProfile(userId) {
        try {
            const user = await database_1.prisma.user.findUnique({
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
        }
        catch (error) {
            console.error("Get user profile error:", error);
            return null;
        }
    }
    /**
     * Verify user credentials for demo purposes
     */
    static async verifyDemoCredentials(email, password) {
        // Demo credentials for Iris Communications
        const demoUsers = [
            {
                email: "admin@iriscommunications.com",
                password: "admin123",
                profile: {
                    id: "demo-admin-001",
                    email: "admin@iriscommunications.com",
                    role: "ADMIN",
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
                    role: "EMPLOYEE",
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
        const demoUser = demoUsers.find((user) => user.email === email.toLowerCase() && user.password === password);
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
    static async demoLogin(loginData) {
        try {
            const { email, password } = loginData;
            // Verify demo credentials
            const userProfile = await this.verifyDemoCredentials(email, password);
            if (!userProfile) {
                throw new auth_1.AuthenticationError("Invalid demo credentials");
            }
            // Generate tokens for demo user
            const tokenPair = jwt_1.JwtUtils.generateTokenPair({
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
        }
        catch (error) {
            if (error instanceof auth_1.AuthenticationError) {
                throw error;
            }
            console.error("Demo login error:", error);
            throw new auth_1.AuthenticationError("Demo login failed");
        }
    }
    /**
     * Validate email format
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Check if user has required role
     */
    static hasRole(userRole, requiredRoles) {
        return requiredRoles.includes(userRole);
    }
    /**
     * Check if user can access employee data
     */
    static canAccessEmployeeData(currentUser, targetEmployeeId) {
        // Admins and HR can access all employee data
        if (["ADMIN", "HR", "SUPERADMIN"].includes(currentUser.role)) {
            return true;
        }
        // Users can only access their own data
        return currentUser.employee?.employeeId === targetEmployeeId;
    }
    /**
     * Log security event (for audit purposes)
     */
    static async logSecurityEvent(userId, event, details, ipAddress) {
        try {
            // In a real application, you would log to a security audit table
            console.log(`Security Event: ${event}`, {
                userId,
                timestamp: new Date().toISOString(),
                ipAddress,
                details,
            });
        }
        catch (error) {
            console.error("Failed to log security event:", error);
        }
    }
}
exports.AuthService = AuthService;
exports.default = AuthService;
