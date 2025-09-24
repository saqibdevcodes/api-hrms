import { body } from "express-validator";

const createAdvanceSalaryRequest = [
  body("daysCount")
    .not()
    .isEmpty()
    .withMessage("The day count should not be empty")
    .isNumeric()
    .withMessage("The day count must be a numeric notation"),
  body("reason")
    .not()
    .isEmpty()
    .withMessage(
      "The reason for the advance Salary Request should not be empty"
    )
    .isString()
    .isLength({ min: 5 })
    .withMessage("The given reason should be characters more than 5"),
];

export { createAdvanceSalaryRequest as createAsrValidator };
