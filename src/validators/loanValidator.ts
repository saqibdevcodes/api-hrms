import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

export const loanValidation = [
  body("amount")
    .not()
    .isEmpty()
    .withMessage("Amount is required")
    .isNumeric()
    .withMessage("Amount must be a number")
    .trim(),
  body("duration")
    .not()
    .isEmpty()
    .withMessage("Duration is required")
    .isNumeric()
    .withMessage("Duration must be a number")
    .trim(),
];

export const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors) {
      return res.status(400).send({ errors });
    }

    return next();
  };
};
