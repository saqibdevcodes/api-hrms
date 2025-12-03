"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaveRequestsValidation = exports.approveRejectLeaveRequestValidation = exports.updateLeaveRequestValidation = exports.createLeaveRequestValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLeaveRequestValidation = [
    (0, express_validator_1.body)("leaveType")
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
    (0, express_validator_1.body)("startDate")
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
    (0, express_validator_1.body)("endDate")
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
    (0, express_validator_1.body)("reason")
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage("Reason must be between 10 and 500 characters"),
    (0, express_validator_1.body)("comments")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Comments cannot exceed 1000 characters"),
];
exports.updateLeaveRequestValidation = [
    (0, express_validator_1.body)("leaveType")
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
    (0, express_validator_1.body)("startDate")
        .optional()
        .isISO8601()
        .withMessage("Start date must be a valid date"),
    (0, express_validator_1.body)("endDate")
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
    (0, express_validator_1.body)("reason")
        .optional()
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage("Reason must be between 10 and 500 characters"),
    (0, express_validator_1.body)("comments")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Comments cannot exceed 1000 characters"),
];
exports.approveRejectLeaveRequestValidation = [
    (0, express_validator_1.body)("comments")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Comments cannot exceed 1000 characters"),
];
exports.getLeaveRequestsValidation = [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    (0, express_validator_1.query)("status")
        .optional()
        .isIn(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
        .withMessage("Invalid status"),
    (0, express_validator_1.query)("leaveType")
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
    (0, express_validator_1.query)("startDate")
        .optional()
        .isISO8601()
        .withMessage("Start date must be a valid date"),
    (0, express_validator_1.query)("endDate")
        .optional()
        .isISO8601()
        .withMessage("End date must be a valid date"),
    (0, express_validator_1.query)("sortBy")
        .optional()
        .isIn(["createdAt", "startDate", "endDate", "status", "leaveType"])
        .withMessage("Invalid sort field"),
    (0, express_validator_1.query)("sortOrder")
        .optional()
        .isIn(["asc", "desc"])
        .withMessage("Sort order must be 'asc' or 'desc'"),
];
