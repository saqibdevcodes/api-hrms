import { Router } from "express";
import {
  fetchAllAdvanceSalary,
  createAdvanceSalaryRequest,
  fetchAdvanceSalaryByUserId,
  updateAdvaceSalaryStatus,
} from "../controller/advanceSalaryController";
import { authenticate } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { createAsrValidator } from "../validators/advanceSalaryValidator";

const router = Router();

router.post(
  "/",
  authenticate,
  createAsrValidator,
  validateRequest,
  createAdvanceSalaryRequest
);

//fetch all
router.get("/", authenticate, fetchAllAdvanceSalary);

// fetch by uid
router.get("/:id", authenticate, fetchAdvanceSalaryByUserId);

//delete
// router.delete('/:id')

// updated
router.put("/:id", authenticate, updateAdvaceSalaryStatus);

export default router;
