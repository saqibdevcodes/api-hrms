import { body, param, query } from "express-validator";

export const createPdrValidator = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isString()
    .withMessage("User ID must be a string"),
  body("pdrCycle")
    .notEmpty()
    .withMessage("PDR cycle is required")
    .isString()
    .withMessage("PDR cycle must be a string"),
  body("linemanagerId")
    .optional()
    .isString()
    .withMessage("Line manager ID must be a string"),
  body("directorId")
    .optional()
    .isString()
    .withMessage("Director ID must be a string"),
];

export const createBulkPdrValidator = [
  body("pdrCycle")
    .notEmpty()
    .withMessage("PDR cycle is required")
    .isString()
    .withMessage("PDR cycle must be a string"),
  body("departmentId")
    .optional()
    .isString()
    .withMessage("Department ID must be a string"),
];

export const pdrIdValidator = [
  param("id")
    .notEmpty()
    .withMessage("PDR ID is required")
    .isInt({ min: 1 })
    .withMessage("PDR ID must be a positive integer"),
];

export const submitPdrValidator = [
  ...pdrIdValidator,
  body("comment")
    .optional()
    .isString()
    .withMessage("Comment must be a string"),
];

export const revertPdrValidator = [
  ...pdrIdValidator,
  body("message")
    .notEmpty()
    .withMessage("Revert message is required")
    .isString()
    .withMessage("Message must be a string")
    .isLength({ min: 10 })
    .withMessage("Message must be at least 10 characters long"),
  body("comment")
    .optional()
    .isString()
    .withMessage("Comment must be a string"),
];

export const acknowledgePdrValidator = [
  ...pdrIdValidator,
  body("disagree")
    .optional()
    .isBoolean()
    .withMessage("Disagree must be a boolean"),
  body("comment")
    .optional()
    .isString()
    .withMessage("Comment must be a string"),
];

export const directorReviewValidator = [
  ...pdrIdValidator,
  body("comment")
    .optional()
    .isString()
    .withMessage("Comment must be a string"),
];

export const getPdrsQueryValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isString()
    .withMessage("Status must be a string"),
  query("cycle")
    .optional()
    .isString()
    .withMessage("Cycle must be a string"),
];

export const updatePdrContentValidator = [
  ...pdrIdValidator,
  body("personalQualities")
    .optional()
    .isObject()
    .withMessage("Personal qualities must be an object"),
  body("goalsTasks")
    .optional()
    .isArray()
    .withMessage("Goals/tasks must be an array"),
  body("comments")
    .optional()
    .isString()
    .withMessage("Comments must be a string"),
  body("overallComments")
    .optional()
    .isString()
    .withMessage("Overall comments must be a string"),
];

