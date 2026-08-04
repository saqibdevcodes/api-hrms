"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePdrContentValidator = exports.getPdrsQueryValidator = exports.directorReviewValidator = exports.acknowledgePdrValidator = exports.revertPdrValidator = exports.submitPdrValidator = exports.pdrIdValidator = exports.createPdrCycleValidator = exports.createBulkPdrValidator = exports.createPdrValidator = void 0;
const express_validator_1 = require("express-validator");
exports.createPdrValidator = [
    (0, express_validator_1.body)("userId")
        .notEmpty()
        .withMessage("User ID is required")
        .isString()
        .withMessage("User ID must be a string"),
    (0, express_validator_1.body)("pdrCycle")
        .notEmpty()
        .withMessage("PDR cycle is required")
        .isString()
        .withMessage("PDR cycle must be a string"),
    (0, express_validator_1.body)("linemanagerId")
        .optional()
        .isString()
        .withMessage("Line manager ID must be a string"),
    (0, express_validator_1.body)("directorId")
        .optional()
        .isString()
        .withMessage("Director ID must be a string"),
    (0, express_validator_1.body)("pdrCycleId")
        .optional()
        .isInt({ min: 1 })
        .withMessage("PDR cycle ID must be a positive integer"),
    (0, express_validator_1.body)("phaseDeadlines")
        .optional()
        .isObject()
        .withMessage("Phase deadlines must be an object"),
];
exports.createBulkPdrValidator = [
    (0, express_validator_1.body)("pdrCycle")
        .notEmpty()
        .withMessage("PDR cycle is required")
        .isString()
        .withMessage("PDR cycle must be a string"),
    (0, express_validator_1.body)("departmentId")
        .optional()
        .isString()
        .withMessage("Department ID must be a string"),
    (0, express_validator_1.body)("pdrCycleId")
        .optional()
        .isInt({ min: 1 })
        .withMessage("PDR cycle ID must be a positive integer"),
    (0, express_validator_1.body)("userIds")
        .optional()
        .isArray()
        .withMessage("Selected employees must be an array"),
    (0, express_validator_1.body)("userIds.*")
        .optional()
        .isString()
        .withMessage("Employee IDs must be strings"),
    (0, express_validator_1.body)("phaseDeadlines")
        .optional()
        .isObject()
        .withMessage("Phase deadlines must be an object"),
];
exports.createPdrCycleValidator = [
    (0, express_validator_1.body)("name")
        .notEmpty()
        .withMessage("Cycle name is required")
        .isString()
        .withMessage("Cycle name must be a string")
        .isLength({ max: 100 })
        .withMessage("Cycle name must be 100 characters or fewer"),
    (0, express_validator_1.body)("description")
        .optional()
        .isString()
        .withMessage("Description must be a string"),
    (0, express_validator_1.body)("startDate")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Start date must be a valid date"),
    (0, express_validator_1.body)("endDate")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("End date must be a valid date"),
];
exports.pdrIdValidator = [
    (0, express_validator_1.param)("id")
        .notEmpty()
        .withMessage("PDR ID is required")
        .isInt({ min: 1 })
        .withMessage("PDR ID must be a positive integer"),
];
exports.submitPdrValidator = [
    ...exports.pdrIdValidator,
    (0, express_validator_1.body)("comment")
        .optional()
        .isString()
        .withMessage("Comment must be a string"),
];
exports.revertPdrValidator = [
    ...exports.pdrIdValidator,
    (0, express_validator_1.body)("message")
        .notEmpty()
        .withMessage("Revert message is required")
        .isString()
        .withMessage("Message must be a string")
        .isLength({ min: 10 })
        .withMessage("Message must be at least 10 characters long"),
    (0, express_validator_1.body)("comment")
        .optional()
        .isString()
        .withMessage("Comment must be a string"),
];
exports.acknowledgePdrValidator = [
    ...exports.pdrIdValidator,
    (0, express_validator_1.body)("disagree")
        .optional()
        .isBoolean()
        .withMessage("Disagree must be a boolean"),
    (0, express_validator_1.body)("comment")
        .optional()
        .isString()
        .withMessage("Comment must be a string"),
];
exports.directorReviewValidator = [
    ...exports.pdrIdValidator,
    (0, express_validator_1.body)("comment")
        .optional()
        .isString()
        .withMessage("Comment must be a string"),
];
exports.getPdrsQueryValidator = [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .custom((value) => {
        if (parseInt(value) === -1)
            return true;
        const num = Number(value);
        if (Number.isInteger(num) && num >= 1 && num <= 100) {
            return true;
        }
        throw new Error("Limit must be between 1 and 100, or -1 for all records");
    }),
    (0, express_validator_1.query)("status")
        .optional()
        .isString()
        .withMessage("Status must be a string"),
    (0, express_validator_1.query)("cycle")
        .optional()
        .isString()
        .withMessage("Cycle must be a string"),
];
exports.updatePdrContentValidator = [
    ...exports.pdrIdValidator,
    (0, express_validator_1.body)("personalQualities")
        .optional()
        .isObject()
        .withMessage("Personal qualities must be an object"),
    (0, express_validator_1.body)("goalsTasks")
        .optional()
        .isArray()
        .withMessage("Goals/tasks must be an array"),
    (0, express_validator_1.body)("comments")
        .optional()
        .isString()
        .withMessage("Comments must be a string"),
    (0, express_validator_1.body)("overallComments")
        .optional()
        .isString()
        .withMessage("Overall comments must be a string"),
];
