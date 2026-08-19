import { Router } from "express";
import { CompanyController } from "../controller/companyController";
import { authenticate, hrAndAdmin, validateRequest } from "../middleware/auth";
import {
  assignCompanyEmployeesValidation,
  createCompanyValidation,
  updateCompanyValidation,
} from "../validators/companyValidator";

const router = Router();

router.use(authenticate, hrAndAdmin);

router.get("/", CompanyController.getAllCompanies);
router.get("/employee-options", CompanyController.getEmployeeOptions);
router.get("/:id", CompanyController.getCompanyById);
router.post(
  "/",
  createCompanyValidation,
  validateRequest,
  CompanyController.createCompany,
);
router.put(
  "/:id",
  updateCompanyValidation,
  validateRequest,
  CompanyController.updateCompany,
);
router.put(
  "/:id/employees",
  assignCompanyEmployeesValidation,
  validateRequest,
  CompanyController.replaceCompanyEmployees,
);
router.patch("/:id/toggle", CompanyController.toggleCompanyStatus);
router.delete("/:id", CompanyController.deleteCompany);

export default router;

