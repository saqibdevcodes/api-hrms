import { body } from "express-validator";

// Custom CUID validator
const isCUID = (value: string) => {
  // CUID format: starts with 'c' and is 25 characters long
  return /^c[a-z0-9]{24}$/.test(value);
};


const isCUIDCompany = (value: string) => {
  if (typeof value !== "string") return false;
  return /^c[a-z0-9]{24}$/i.test(value) || /^[a-zA-Z0-9_-]{3,60}$/.test(value);
};


const parseIdArray = (value: unknown): unknown => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
};

export const createEmployeeValidation = [
  // Required fields
  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["ADMIN", "HR", "MANAGER", "EMPLOYEE"])
    .withMessage("Invalid role"),

  body("position")
    .notEmpty()
    .withMessage("Position is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Position must be between 2 and 100 characters"),

  body("departmentId")
    .notEmpty()
    .withMessage("Department is required")
    .custom(isCUID)
    .withMessage("Invalid department ID"),

  body("designationId")
    .notEmpty()
    .withMessage("Designation is required")
    .custom(isCUID)
    .withMessage("Invalid designation ID"),

  body("contractTypeId")
    .notEmpty()
    .withMessage("Contract type is required")
    .custom(isCUID)
    .withMessage("Invalid contract type ID"),

  body("shiftId")
    .notEmpty()
    .withMessage("Shift is required")
    .custom(isCUID)
    .withMessage("Invalid shift ID"),

  body("leaveId")
    .notEmpty()
    .withMessage("Leave policy is required")
    .custom(isCUID)
    .withMessage("Invalid leave policy ID"),

    body("companyIds")
    .optional()
    .customSanitizer(parseIdArray)
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),

  body("companyIds.*")
    .optional()
    .custom(isCUIDCompany)
    .withMessage("Invalid company ID"),

  // Optional personal fields
  body("fatherHusbandName")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Father/Husband name must be between 2 and 100 characters"),

  body("cnic")
    .optional()
    .matches(/^\d{5}-\d{7}-\d{1}$/)
    .withMessage("CNIC must be in format 12345-1234567-1"),

  body("cnicExpiry")
    .optional()
    .isISO8601()
    .withMessage("CNIC expiry must be a valid date"),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Date of birth must be a valid date"),

  body("gender")
    .optional()
    .isIn(["MALE", "FEMALE"])
    .withMessage("Invalid gender"),

  body("maritalStatus")
    .optional()
    .isIn(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED"])
    .withMessage("Invalid marital status"),

  body("bloodGroup")
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

  body("personalAddress")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage("Personal address must be between 5 and 500 characters"),

  body("city")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("City must be between 2 and 50 characters"),

  body("state")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("State must be between 2 and 50 characters"),

  body("zipCode")
    .optional()
    .isLength({ min: 3, max: 10 })
    .withMessage("Zip code must be between 3 and 10 characters"),

  body("country")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Country must be between 2 and 50 characters"),

  // Contact Information
  body("personalEmail")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid personal email address")
    .normalizeEmail(),

  body("officialEmail")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid official email address")
    .normalizeEmail(),

  body("personalMobile")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Personal mobile must be in format +92-321-1234567"),

  body("officialMobile")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Official mobile must be in format +92-321-1234567"),

  body("phone")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Phone must be in format +92-321-1234567"),

  // Education
  body("education")
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

  body("educationInstitute")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Education institute must be between 2 and 200 characters"),

  body("educationGrade")
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage("Education grade must be between 1 and 20 characters"),

  // Employment Details
  body("department")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Department name must be between 2 and 100 characters"),

  body("userRank")
    .optional()
    .isIn(["DIRECTOR", "LINE_MANAGER", "EMPLOYEE"])
    .withMessage("Invalid user rank"),

  // Supervisor validation based on rank
  body("supervisorId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid supervisor ID"),

  body("supervisorIds")
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
        } catch {
          // If parsing fails, return as single-item array
          return [value];
        }
      }
      return value;
    })
    .isArray()
    .withMessage("Supervisor IDs must be an array"),

  body("supervisorIds.*")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid supervisor ID in array"),

  body("employmentTypeId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid employment type ID"),

  body("salary")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Salary must be a number greater than or equal to 0"),

  body("currency")
    .optional()
    .isIn(["PKR", "USD", "EUR", "GBP"])
    .withMessage("Invalid currency"),

  body("manager")
    .optional()
    .isEmail()
    .withMessage("Manager must be a valid email address"),

  body("dateOfJoining")
    .optional()
    .isISO8601()
    .withMessage("Date of joining must be a valid date"),

  body("dateOfExit")
    .optional()
    .isISO8601()
    .withMessage("Date of exit must be a valid date"),

  // Emergency Contact
  body("emergencyContactName")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Emergency contact name must be between 2 and 100 characters"),

  body("emergencyContactPhone")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Emergency contact phone must be in format +92-321-1234567"),

  body("emergencyContactAlternatePhone")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage(
      "Emergency contact alternate phone must be in format +92-321-1234567",
    ),

  body("emergencyContactRelation")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage(
      "Emergency contact relation must be between 2 and 50 characters",
    ),

  body("emergencyContactEmail")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid emergency contact email address")
    .normalizeEmail(),

  body("emergencyContactAddress")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage(
      "Emergency contact address must be between 5 and 500 characters",
    ),
];

export const updateEmployeeValidation = [
  // For updates, all fields are optional but must be valid if provided
  body("firstName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("role")
    .optional()
    .isIn(["ADMIN", "HR", "MANAGER", "EMPLOYEE"])
    .withMessage("Invalid role"),

  body("position")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Position must be between 2 and 100 characters"),

  body("departmentId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid department ID"),

  body("designationId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid designation ID"),

  body("contractTypeId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid contract type ID"),

  body("shiftId").optional().custom(isCUID).withMessage("Invalid shift ID"),

  body("leaveId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid leave policy ID"),

  body("companyIds")
    .optional()
    .customSanitizer(parseIdArray)
    .isArray({ min: 1 })
    .withMessage("At least one company is required"),

  body("companyIds.*")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid company ID"),

  // Personal fields
  body("fatherHusbandName")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Father/Husband name must be between 2 and 100 characters"),

  body("cnic")
    .optional()
    .matches(/^\d{5}-\d{7}-\d{1}$/)
    .withMessage("CNIC must be in format 12345-1234567-1"),

  body("cnicExpiry")
    .optional()
    .isISO8601()
    .withMessage("CNIC expiry must be a valid date"),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage("Date of birth must be a valid date"),

  body("gender")
    .optional()
    .isIn(["MALE", "FEMALE"])
    .withMessage("Invalid gender"),

  body("maritalStatus")
    .optional()
    .isIn(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED"])
    .withMessage("Invalid marital status"),

  body("bloodGroup")
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

  body("personalAddress")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage("Personal address must be between 5 and 500 characters"),

  body("city")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("City must be between 2 and 50 characters"),

  body("state")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("State must be between 2 and 50 characters"),

  body("zipCode")
    .optional()
    .isLength({ min: 3, max: 10 })
    .withMessage("Zip code must be between 3 and 10 characters"),

  body("country")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Country must be between 2 and 50 characters"),

  body("education")
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

  body("educationInstitute")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Education institute must be between 2 and 200 characters"),

  body("educationGrade")
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage("Education grade must be between 1 and 20 characters"),

  body("department")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Department name must be between 2 and 100 characters"),

  body("userRank")
    .optional()
    .isIn(["DIRECTOR", "LINE_MANAGER", "EMPLOYEE"])
    .withMessage("Invalid user rank"),

  // Supervisor validation based on rank
  body("supervisorId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid supervisor ID"),

  body("supervisorIds")
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
        } catch {
          // If parsing fails, return as single-item array
          return [value];
        }
      }
      return value;
    })
    .isArray()
    .withMessage("Supervisor IDs must be an array"),

  body("supervisorIds.*")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid supervisor ID in array"),

  body("employmentTypeId")
    .optional()
    .custom(isCUID)
    .withMessage("Invalid employment type ID"),

  body("salary")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Salary must be a number greater than or equal to 0"),

  body("currency")
    .optional()
    .isIn(["PKR", "USD", "EUR", "GBP"])
    .withMessage("Invalid currency"),

  body("manager")
    .optional()
    .isEmail()
    .withMessage("Manager must be a valid email address"),

  body("dateOfJoining")
    .optional()
    .isISO8601()
    .withMessage("Date of joining must be a valid date"),

  body("dateOfExit")
    .optional()
    .isISO8601()
    .withMessage("Date of exit must be a valid date"),

  body("personalEmail")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid personal email address")
    .normalizeEmail(),

  body("officialEmail")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid official email address")
    .normalizeEmail(),

  body("personalMobile")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Personal mobile must be in format +92-321-1234567"),

  body("officialMobile")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Official mobile must be in format +92-321-1234567"),

  body("phone")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Phone must be in format +92-321-1234567"),

  body("emergencyContactName")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Emergency contact name must be between 2 and 100 characters"),

  body("emergencyContactPhone")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage("Emergency contact phone must be in format +92-321-1234567"),

  body("emergencyContactAlternatePhone")
    .optional()
    .matches(/^\+92-\d{3}-\d{7}$/)
    .withMessage(
      "Emergency contact alternate phone must be in format +92-321-1234567",
    ),

  body("emergencyContactRelation")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage(
      "Emergency contact relation must be between 2 and 50 characters",
    ),

  body("emergencyContactEmail")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid emergency contact email address")
    .normalizeEmail(),

  body("emergencyContactAddress")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage(
      "Emergency contact address must be between 5 and 500 characters",
    ),
];
