"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmployeeValidation = exports.createEmployeeValidation = void 0;
const express_validator_1 = require("express-validator");
// Custom CUID validator
const isCUID = (value) => {
    // CUID format: starts with 'c' and is 25 characters long
    return /^c[a-z0-9]{24}$/.test(value);
};
exports.createEmployeeValidation = [
    // Required fields
    (0, express_validator_1.body)("firstName")
        .notEmpty()
        .withMessage("First name is required")
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters"),
    (0, express_validator_1.body)("lastName")
        .notEmpty()
        .withMessage("Last name is required")
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters"),
    (0, express_validator_1.body)("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
    (0, express_validator_1.body)("role")
        .notEmpty()
        .withMessage("Role is required")
        .isIn(["ADMIN", "HR", "MANAGER", "EMPLOYEE"])
        .withMessage("Invalid role"),
    (0, express_validator_1.body)("position")
        .notEmpty()
        .withMessage("Position is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Position must be between 2 and 100 characters"),
    (0, express_validator_1.body)("departmentId")
        .notEmpty()
        .withMessage("Department is required")
        .custom(isCUID)
        .withMessage("Invalid department ID"),
    (0, express_validator_1.body)("designationId")
        .notEmpty()
        .withMessage("Designation is required")
        .custom(isCUID)
        .withMessage("Invalid designation ID"),
    (0, express_validator_1.body)("contractTypeId")
        .notEmpty()
        .withMessage("Contract type is required")
        .custom(isCUID)
        .withMessage("Invalid contract type ID"),
    (0, express_validator_1.body)("shiftId")
        .notEmpty()
        .withMessage("Shift is required")
        .custom(isCUID)
        .withMessage("Invalid shift ID"),
    (0, express_validator_1.body)("leaveId")
        .notEmpty()
        .withMessage("Leave policy is required")
        .custom(isCUID)
        .withMessage("Invalid leave policy ID"),
    // Optional personal fields
    (0, express_validator_1.body)("fatherHusbandName")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Father/Husband name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("cnic")
        .optional()
        .matches(/^\d{5}-\d{7}-\d{1}$/)
        .withMessage("CNIC must be in format 12345-1234567-1"),
    (0, express_validator_1.body)("cnicExpiry")
        .optional()
        .isISO8601()
        .withMessage("CNIC expiry must be a valid date"),
    (0, express_validator_1.body)("dateOfBirth")
        .optional()
        .isISO8601()
        .withMessage("Date of birth must be a valid date"),
    (0, express_validator_1.body)("gender")
        .optional()
        .isIn(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])
        .withMessage("Invalid gender"),
    (0, express_validator_1.body)("maritalStatus")
        .optional()
        .isIn(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED"])
        .withMessage("Invalid marital status"),
    (0, express_validator_1.body)("bloodGroup")
        .optional()
        .isIn([
        "A_POSITIVE",
        "A_NEGATIVE",
        "B_POSITIVE",
        "B_NEGATIVE",
        "O_POSITIVE",
        "O_NEGATIVE",
        "AB_POSITIVE",
        "AB_NEGATIVE",
    ])
        .withMessage("Invalid blood group"),
    (0, express_validator_1.body)("personalAddress")
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage("Personal address must be between 5 and 500 characters"),
    (0, express_validator_1.body)("city")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("City must be between 2 and 50 characters"),
    (0, express_validator_1.body)("state")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("State must be between 2 and 50 characters"),
    (0, express_validator_1.body)("zipCode")
        .optional()
        .isLength({ min: 3, max: 10 })
        .withMessage("Zip code must be between 3 and 10 characters"),
    (0, express_validator_1.body)("country")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("Country must be between 2 and 50 characters"),
    // Contact Information
    (0, express_validator_1.body)("personalEmail")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid personal email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("officialEmail")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid official email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("personalMobile")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Personal mobile must be in format +92-321-1234567"),
    (0, express_validator_1.body)("officialMobile")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Official mobile must be in format +92-321-1234567"),
    (0, express_validator_1.body)("phone")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Phone must be in format +92-321-1234567"),
    // Education
    (0, express_validator_1.body)("education")
        .optional()
        .isIn([
        "PRIMARY",
        "SECONDARY",
        "HIGHER_SECONDARY",
        "BACHELORS",
        "MASTERS",
        "PHD",
        "DIPLOMA",
        "CERTIFICATE",
        "PROFESSIONAL",
    ])
        .withMessage("Invalid education level"),
    (0, express_validator_1.body)("educationInstitute")
        .optional()
        .isLength({ min: 2, max: 200 })
        .withMessage("Education institute must be between 2 and 200 characters"),
    (0, express_validator_1.body)("educationGrade")
        .optional()
        .isLength({ min: 1, max: 20 })
        .withMessage("Education grade must be between 1 and 20 characters"),
    // Employment Details
    (0, express_validator_1.body)("department")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Department name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("userRank")
        .optional()
        .isIn([
        "DIRECTOR",
        "LINE_MANAGER",
        "EMPLOYEE",
        "SENIOR_MANAGER",
        "TEAM_LEAD",
        "SPECIALIST",
        "EXECUTIVE",
    ])
        .withMessage("Invalid user rank"),
    // Supervisor validation based on rank
    (0, express_validator_1.body)("supervisorId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid supervisor ID"),
    (0, express_validator_1.body)("supervisorIds")
        .optional()
        .customSanitizer((value) => {
        // If it's already an array, return as-is
        if (Array.isArray(value)) {
            return value;
        }
        // If it's a string (from multipart/form-data), try to parse it as JSON
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [value];
            }
            catch {
                // If parsing fails, return as single-item array
                return [value];
            }
        }
        return value;
    })
        .isArray()
        .withMessage("Supervisor IDs must be an array"),
    (0, express_validator_1.body)("supervisorIds.*")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid supervisor ID in array"),
    (0, express_validator_1.body)("employmentTypeId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid employment type ID"),
    (0, express_validator_1.body)("salary")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Salary must be a positive number"),
    (0, express_validator_1.body)("currency")
        .optional()
        .isIn(["PKR", "USD", "EUR", "GBP"])
        .withMessage("Invalid currency"),
    (0, express_validator_1.body)("manager")
        .optional()
        .isEmail()
        .withMessage("Manager must be a valid email address"),
    (0, express_validator_1.body)("dateOfJoining")
        .optional()
        .isISO8601()
        .withMessage("Date of joining must be a valid date"),
    (0, express_validator_1.body)("dateOfExit")
        .optional()
        .isISO8601()
        .withMessage("Date of exit must be a valid date"),
    // Emergency Contact
    (0, express_validator_1.body)("emergencyContactName")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Emergency contact name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("emergencyContactPhone")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Emergency contact phone must be in format +92-321-1234567"),
    (0, express_validator_1.body)("emergencyContactAlternatePhone")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Emergency contact alternate phone must be in format +92-321-1234567"),
    (0, express_validator_1.body)("emergencyContactRelation")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("Emergency contact relation must be between 2 and 50 characters"),
    (0, express_validator_1.body)("emergencyContactEmail")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid emergency contact email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("emergencyContactAddress")
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage("Emergency contact address must be between 5 and 500 characters"),
];
exports.updateEmployeeValidation = [
    // For updates, all fields are optional but must be valid if provided
    (0, express_validator_1.body)("firstName")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters"),
    (0, express_validator_1.body)("lastName")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters"),
    (0, express_validator_1.body)("email")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("password")
        .optional()
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
    (0, express_validator_1.body)("role")
        .optional()
        .isIn(["ADMIN", "HR", "MANAGER", "EMPLOYEE"])
        .withMessage("Invalid role"),
    (0, express_validator_1.body)("position")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Position must be between 2 and 100 characters"),
    (0, express_validator_1.body)("departmentId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid department ID"),
    (0, express_validator_1.body)("designationId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid designation ID"),
    (0, express_validator_1.body)("contractTypeId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid contract type ID"),
    (0, express_validator_1.body)("shiftId").optional().custom(isCUID).withMessage("Invalid shift ID"),
    (0, express_validator_1.body)("leaveId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid leave policy ID"),
    // Personal fields
    (0, express_validator_1.body)("fatherHusbandName")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Father/Husband name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("cnic")
        .optional()
        .matches(/^\d{5}-\d{7}-\d{1}$/)
        .withMessage("CNIC must be in format 12345-1234567-1"),
    (0, express_validator_1.body)("cnicExpiry")
        .optional()
        .isISO8601()
        .withMessage("CNIC expiry must be a valid date"),
    (0, express_validator_1.body)("dateOfBirth")
        .optional()
        .isISO8601()
        .withMessage("Date of birth must be a valid date"),
    (0, express_validator_1.body)("gender")
        .optional()
        .isIn(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])
        .withMessage("Invalid gender"),
    (0, express_validator_1.body)("maritalStatus")
        .optional()
        .isIn(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED"])
        .withMessage("Invalid marital status"),
    (0, express_validator_1.body)("bloodGroup")
        .optional()
        .isIn([
        "A_POSITIVE",
        "A_NEGATIVE",
        "B_POSITIVE",
        "B_NEGATIVE",
        "O_POSITIVE",
        "O_NEGATIVE",
        "AB_POSITIVE",
        "AB_NEGATIVE",
    ])
        .withMessage("Invalid blood group"),
    (0, express_validator_1.body)("personalAddress")
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage("Personal address must be between 5 and 500 characters"),
    (0, express_validator_1.body)("city")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("City must be between 2 and 50 characters"),
    (0, express_validator_1.body)("state")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("State must be between 2 and 50 characters"),
    (0, express_validator_1.body)("zipCode")
        .optional()
        .isLength({ min: 3, max: 10 })
        .withMessage("Zip code must be between 3 and 10 characters"),
    (0, express_validator_1.body)("country")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("Country must be between 2 and 50 characters"),
    (0, express_validator_1.body)("education")
        .optional()
        .isIn([
        "PRIMARY",
        "SECONDARY",
        "HIGHER_SECONDARY",
        "BACHELORS",
        "MASTERS",
        "PHD",
        "DIPLOMA",
        "CERTIFICATE",
        "PROFESSIONAL",
    ])
        .withMessage("Invalid education level"),
    (0, express_validator_1.body)("educationInstitute")
        .optional()
        .isLength({ min: 2, max: 200 })
        .withMessage("Education institute must be between 2 and 200 characters"),
    (0, express_validator_1.body)("educationGrade")
        .optional()
        .isLength({ min: 1, max: 20 })
        .withMessage("Education grade must be between 1 and 20 characters"),
    (0, express_validator_1.body)("department")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Department name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("userRank")
        .optional()
        .isIn([
        "DIRECTOR",
        "LINE_MANAGER",
        "EMPLOYEE",
        "SENIOR_MANAGER",
        "TEAM_LEAD",
        "SPECIALIST",
        "EXECUTIVE",
    ])
        .withMessage("Invalid user rank"),
    // Supervisor validation based on rank
    (0, express_validator_1.body)("supervisorId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid supervisor ID"),
    (0, express_validator_1.body)("supervisorIds")
        .optional()
        .customSanitizer((value) => {
        // If it's already an array, return as-is
        if (Array.isArray(value)) {
            return value;
        }
        // If it's a string (from multipart/form-data), try to parse it as JSON
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [value];
            }
            catch {
                // If parsing fails, return as single-item array
                return [value];
            }
        }
        return value;
    })
        .isArray()
        .withMessage("Supervisor IDs must be an array"),
    (0, express_validator_1.body)("supervisorIds.*")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid supervisor ID in array"),
    (0, express_validator_1.body)("employmentTypeId")
        .optional()
        .custom(isCUID)
        .withMessage("Invalid employment type ID"),
    (0, express_validator_1.body)("salary")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Salary must be a positive number"),
    (0, express_validator_1.body)("currency")
        .optional()
        .isIn(["PKR", "USD", "EUR", "GBP"])
        .withMessage("Invalid currency"),
    (0, express_validator_1.body)("manager")
        .optional()
        .isEmail()
        .withMessage("Manager must be a valid email address"),
    (0, express_validator_1.body)("dateOfJoining")
        .optional()
        .isISO8601()
        .withMessage("Date of joining must be a valid date"),
    (0, express_validator_1.body)("dateOfExit")
        .optional()
        .isISO8601()
        .withMessage("Date of exit must be a valid date"),
    (0, express_validator_1.body)("personalEmail")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid personal email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("officialEmail")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid official email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("personalMobile")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Personal mobile must be in format +92-321-1234567"),
    (0, express_validator_1.body)("officialMobile")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Official mobile must be in format +92-321-1234567"),
    (0, express_validator_1.body)("phone")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Phone must be in format +92-321-1234567"),
    (0, express_validator_1.body)("emergencyContactName")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Emergency contact name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("emergencyContactPhone")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Emergency contact phone must be in format +92-321-1234567"),
    (0, express_validator_1.body)("emergencyContactAlternatePhone")
        .optional()
        .matches(/^\+92-\d{3}-\d{7}$/)
        .withMessage("Emergency contact alternate phone must be in format +92-321-1234567"),
    (0, express_validator_1.body)("emergencyContactRelation")
        .optional()
        .isLength({ min: 2, max: 50 })
        .withMessage("Emergency contact relation must be between 2 and 50 characters"),
    (0, express_validator_1.body)("emergencyContactEmail")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid emergency contact email address")
        .normalizeEmail(),
    (0, express_validator_1.body)("emergencyContactAddress")
        .optional()
        .isLength({ min: 5, max: 500 })
        .withMessage("Emergency contact address must be between 5 and 500 characters"),
];
