"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordUtils = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../config/env");
class PasswordUtils {
    /**
     * Hash password using bcrypt
     */
    static async hashPassword(password) {
        try {
            const salt = await bcryptjs_1.default.genSalt(env_1.config.BCRYPT_ROUNDS);
            return await bcryptjs_1.default.hash(password, salt);
        }
        catch (error) {
            throw new Error("Failed to hash password");
        }
    }
    /**
     * Verify password against hash
     */
    static async verifyPassword(password, hashedPassword) {
        try {
            return await bcryptjs_1.default.compare(password, hashedPassword);
        }
        catch (error) {
            throw new Error("Failed to verify password");
        }
    }
    /**
     * Validate password against requirements
     */
    static validatePassword(password) {
        const errors = [];
        // Check minimum length
        if (password.length < this.requirements.minLength) {
            errors.push(`Password must be at least ${this.requirements.minLength} characters long`);
        }
        // Check for uppercase letters
        if (this.requirements.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push("Password must contain at least one uppercase letter");
        }
        // Check for lowercase letters
        if (this.requirements.requireLowercase && !/[a-z]/.test(password)) {
            errors.push("Password must contain at least one lowercase letter");
        }
        // Check for numbers
        if (this.requirements.requireNumbers && !/\d/.test(password)) {
            errors.push("Password must contain at least one number");
        }
        // Check for special characters
        if (this.requirements.requireSpecialChars &&
            !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push("Password must contain at least one special character");
        }
        // Check for common weak passwords
        const commonPasswords = [
            "password",
            "123456",
            "password123",
            "admin",
            "qwerty",
            "letmein",
            "welcome",
            "monkey",
            "dragon",
        ];
        if (commonPasswords.includes(password.toLowerCase())) {
            errors.push("Password is too common and not secure");
        }
        // Check for sequential characters
        if (this.hasSequentialChars(password)) {
            errors.push("Password should not contain sequential characters");
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    /**
     * Generate a random secure password
     */
    static generateSecurePassword(length = 12) {
        const lowercase = "abcdefghijklmnopqrstuvwxyz";
        const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
        let chars = lowercase + uppercase + numbers;
        if (this.requirements.requireSpecialChars) {
            chars += special;
        }
        let password = "";
        // Ensure at least one character from each required category
        if (this.requirements.requireLowercase) {
            password += lowercase[Math.floor(Math.random() * lowercase.length)];
        }
        if (this.requirements.requireUppercase) {
            password += uppercase[Math.floor(Math.random() * uppercase.length)];
        }
        if (this.requirements.requireNumbers) {
            password += numbers[Math.floor(Math.random() * numbers.length)];
        }
        if (this.requirements.requireSpecialChars) {
            password += special[Math.floor(Math.random() * special.length)];
        }
        // Fill the rest with random characters
        for (let i = password.length; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        // Shuffle the password
        return password
            .split("")
            .sort(() => Math.random() - 0.5)
            .join("");
    }
    /**
     * Check password strength
     */
    static getPasswordStrength(password) {
        let score = 0;
        const feedback = [];
        // Length scoring
        if (password.length >= 8)
            score += 20;
        if (password.length >= 12)
            score += 10;
        if (password.length >= 16)
            score += 10;
        // Character variety scoring
        if (/[a-z]/.test(password))
            score += 10;
        if (/[A-Z]/.test(password))
            score += 10;
        if (/\d/.test(password))
            score += 10;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password))
            score += 15;
        // Complexity scoring
        if (password.length > 8 && /[a-z]/.test(password) && /[A-Z]/.test(password))
            score += 10;
        if (/\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password))
            score += 15;
        // Deduct points for patterns
        if (this.hasSequentialChars(password))
            score -= 20;
        if (this.hasRepeatedChars(password))
            score -= 15;
        // Generate feedback
        if (password.length < 8) {
            feedback.push("Use at least 8 characters");
        }
        if (!/[a-z]/.test(password)) {
            feedback.push("Add lowercase letters");
        }
        if (!/[A-Z]/.test(password)) {
            feedback.push("Add uppercase letters");
        }
        if (!/\d/.test(password)) {
            feedback.push("Add numbers");
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            feedback.push("Add special characters for better security");
        }
        // Determine level
        let level;
        if (score < 30)
            level = "Very Weak";
        else if (score < 50)
            level = "Weak";
        else if (score < 70)
            level = "Fair";
        else if (score < 90)
            level = "Good";
        else
            level = "Strong";
        return { score: Math.min(100, Math.max(0, score)), level, feedback };
    }
    /**
     * Check if password has sequential characters
     */
    static hasSequentialChars(password) {
        const sequences = [
            "123",
            "234",
            "345",
            "456",
            "567",
            "678",
            "789",
            "abc",
            "bcd",
            "cde",
            "qwe",
            "wer",
            "ert",
        ];
        return sequences.some((seq) => password.toLowerCase().includes(seq));
    }
    /**
     * Check if password has repeated characters
     */
    static hasRepeatedChars(password) {
        return /(.)\1{2,}/.test(password);
    }
    /**
     * Get password requirements for frontend
     */
    static getRequirements() {
        return { ...this.requirements };
    }
}
exports.PasswordUtils = PasswordUtils;
PasswordUtils.requirements = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
};
exports.default = PasswordUtils;
