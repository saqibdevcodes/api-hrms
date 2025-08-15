import { body, query } from "express-validator";

export const createLeaveRequestValidation = [
  body("leaveType")
    .isIn([
      "ANNUAL",
      "SICK",
      "MATERNITY",
      "PATERNITY",
      "PERSONAL",
      "EMERGENCY",
      "BEREAVEMENT",
      "STUDY",
      "UNPAID",
    ])
    .withMessage("Invalid leave type"),

  body("startDate")
    .isISO8601()
    .withMessage("Start date must be a valid date")
    .custom((value) => {
      const startDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        throw new Error("Start date cannot be in the past");
      }
      return true;
    }),

  body("endDate")
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      const endDate = new Date(value);
      const startDate = new Date(req.body.startDate);

      if (endDate < startDate) {
        throw new Error("End date must be after or equal to start date");
      }
      return true;
    }),

  body("reason")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Reason must be between 10 and 500 characters"),

  body("comments")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comments cannot exceed 1000 characters"),
];

export const updateLeaveRequestValidation = [
  body("leaveType")
    .optional()
    .isIn([
      "ANNUAL",
      "SICK",
      "MATERNITY",
      "PATERNITY",
      "PERSONAL",
      "EMERGENCY",
      "BEREAVEMENT",
      "STUDY",
      "UNPAID",
    ])
    .withMessage("Invalid leave type"),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const endDate = new Date(value);
        const startDate = new Date(req.body.startDate);

        if (endDate < startDate) {
          throw new Error("End date must be after or equal to start date");
        }
      }
      return true;
    }),

  body("reason")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Reason must be between 10 and 500 characters"),

  body("comments")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comments cannot exceed 1000 characters"),
];

export const approveRejectLeaveRequestValidation = [
  body("comments")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comments cannot exceed 1000 characters"),
];

export const getLeaveRequestsValidation = [
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
    .isIn(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
    .withMessage("Invalid status"),

  query("leaveType")
    .optional()
    .isIn([
      "ANNUAL",
      "SICK",
      "MATERNITY",
      "PATERNITY",
      "PERSONAL",
      "EMERGENCY",
      "BEREAVEMENT",
      "STUDY",
      "UNPAID",
    ])
    .withMessage("Invalid leave type"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "startDate", "endDate", "status", "leaveType"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];
