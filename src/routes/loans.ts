import { Router } from "express";
import { LoanController } from "../controller/loanController";
import { authenticate } from "../middleware/auth";
import { loanValidation } from "../validators/loanValidator";

const router = Router();

router.post("/", authenticate, loanValidation, LoanController.createLoan);

router.get("/", authenticate, LoanController.getLoans);

export default router;
