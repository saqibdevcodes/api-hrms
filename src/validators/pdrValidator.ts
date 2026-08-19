import { body, param, query } from "express-validator";

export const createPdrValidator = [
  body("companyId")
    .notEmpty()
    .withMessage("Company ID is required")
    .isString()
    .withMessage("Company ID must be a string"),
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
  body("pdrCycleId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("PDR cycle ID must be a positive integer"),
  body("phaseDeadlines")
    .optional()
    .isObject()
    .withMessage("Phase deadlines must be an object"),
];

export const createBulkPdrValidator = [
  body("companyId")
    .notEmpty()
    .withMessage("Company ID is required")
    .isString()
    .withMessage("Company ID must be a string"),
  body("pdrCycle")
    .notEmpty()
    .withMessage("PDR cycle is required")
    .isString()
    .withMessage("PDR cycle must be a string"),
  body("departmentId")
    .optional()
    .isString()
    .withMessage("Department ID must be a string"),
  body("pdrCycleId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("PDR cycle ID must be a positive integer"),
  body("userIds")
    .optional()
    .isArray()
    .withMessage("Selected employees must be an array"),
  body("userIds.*")
    .optional()
    .isString()
    .withMessage("Employee IDs must be strings"),
  body("phaseDeadlines")
    .optional()
    .isObject()
    .withMessage("Phase deadlines must be an object"),
];

export const createPdrCycleValidator = [
  body("name")
    .notEmpty()
    .withMessage("Cycle name is required")
    .isString()
    .withMessage("Cycle name must be a string")
    .isLength({ max: 100 })
    .withMessage("Cycle name must be 100 characters or fewer"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  body("startDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Start date must be a valid date"),
  body("endDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("End date must be a valid date"),
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
    .custom((value) => {
        if (parseInt(value) === -1) return true;
        const num = Number(value);
        if (Number.isInteger(num) && num >= 1 && num <= 100) {
            return true;
        }
        throw new Error("Limit must be between 1 and 100, or -1 for all records");
    }),
  query("status")
    .optional()
    .isString()
    .withMessage("Status must be a string"),
  query("cycle")
    .optional()
    .isString()
    .withMessage("Cycle must be a string"),
  query("companyId")
    .optional()
    .isString()
    .withMessage("Company ID must be a string"),
];

export const bulkClosePdrEmployeePortalValidator = [
  body("pdrIds")
    .isArray({ min: 1, max: 200 })
    .withMessage("Select between 1 and 200 PDRs"),
  body("pdrIds.*")
    .isInt({ min: 1 })
    .withMessage("Every PDR ID must be a positive integer"),
  body("closeMode")
    .isIn(["NOW", "SCHEDULED"])
    .withMessage("Close mode must be NOW or SCHEDULED"),
  body("closesAt").custom((value, { req }) => {
    if (req.body.closeMode === "NOW") return true;
    if (!value) throw new Error("Closing time is required for scheduled closing");

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Closing time must be a valid date");
    }
    if (date.getTime() <= Date.now()) {
      throw new Error("Scheduled closing time must be in the future");
    }
    return true;
  }),
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


export const updatePdrDeadlinesValidator = [
  ...pdrIdValidator,
  body("phaseDeadlines")
    .optional()
    .isObject()
    .withMessage("Phase deadlines must be an object"),
  body("phaseDeadlines.employeeAccess.noRestriction").optional().isBoolean(),
  body("phaseDeadlines.employeeAccess.deadline").optional({ nullable: true }).isISO8601().withMessage("Invalid date"),
  body("phaseDeadlines.hrEmployeeApproval.noRestriction").optional().isBoolean(),
  body("phaseDeadlines.hrEmployeeApproval.deadline").optional({ nullable: true }).isISO8601().withMessage("Invalid date"),
  body("phaseDeadlines.managerAccess.noRestriction").optional().isBoolean(),
  body("phaseDeadlines.managerAccess.deadline").optional({ nullable: true }).isISO8601().withMessage("Invalid date"),
  body("phaseDeadlines.hrManagerApproval.noRestriction").optional().isBoolean(),
  body("phaseDeadlines.hrManagerApproval.deadline").optional({ nullable: true }).isISO8601().withMessage("Invalid date"),
  body("phaseDeadlines.directorReview.noRestriction").optional().isBoolean(),
  body("phaseDeadlines.directorReview.deadline").optional({ nullable: true }).isISO8601().withMessage("Invalid date"),
  body("phaseDeadlines.employeeAcknowledgement.noRestriction").optional().isBoolean(),
  body("phaseDeadlines.employeeAcknowledgement.deadline").optional({ nullable: true }).isISO8601().withMessage("Invalid date"),
  body("pdr_timeline").optional({ nullable: true }).isString().withMessage("Timeline must be a string"),
];
