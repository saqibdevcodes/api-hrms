import { Router } from "express";
import { ContractTypeController } from "../controller/contractTypeController";
import { authenticate, hrAndAdmin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createContractTypeValidation,
  updateContractTypeValidation,
} from "../validators/contractTypeValidator";

const router = Router();

// GET /api/contract-types - Get all contract types
router.get("/", authenticate, ContractTypeController.getAllContractTypes);

// GET /api/contract-types/:id - Get contract type by ID
router.get("/:id", authenticate, ContractTypeController.getContractTypeById);

// POST /api/contract-types - Create new contract type (HR and Admin only)
router.post(
  "/",
  authenticate,
  hrAndAdmin,
  createContractTypeValidation,
  validateRequest,
  ContractTypeController.createContractType
);

// PUT /api/contract-types/:id - Update contract type (HR and Admin only)
router.put(
  "/:id",
  authenticate,
  hrAndAdmin,
  updateContractTypeValidation,
  validateRequest,
  ContractTypeController.updateContractType
);

// DELETE /api/contract-types/:id - Delete contract type (HR and Admin only)
router.delete(
  "/:id",
  authenticate,
  hrAndAdmin,
  ContractTypeController.deleteContractType
);

// PATCH /api/contract-types/:id/toggle - Toggle contract type status (HR and Admin only)
router.patch(
  "/:id/toggle",
  authenticate,
  hrAndAdmin,
  ContractTypeController.toggleContractTypeStatus
);

export default router;
