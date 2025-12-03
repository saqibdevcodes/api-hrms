"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contractTypeController_1 = require("../controller/contractTypeController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const contractTypeValidator_1 = require("../validators/contractTypeValidator");
const router = (0, express_1.Router)();
// GET /api/contract-types - Get all contract types
router.get("/", auth_1.authenticate, contractTypeController_1.ContractTypeController.getAllContractTypes);
// GET /api/contract-types/:id - Get contract type by ID
router.get("/:id", auth_1.authenticate, contractTypeController_1.ContractTypeController.getContractTypeById);
// POST /api/contract-types - Create new contract type (HR and Admin only)
router.post("/", auth_1.authenticate, auth_1.hrAndAdmin, contractTypeValidator_1.createContractTypeValidation, validateRequest_1.validateRequest, contractTypeController_1.ContractTypeController.createContractType);
// PUT /api/contract-types/:id - Update contract type (HR and Admin only)
router.put("/:id", auth_1.authenticate, auth_1.hrAndAdmin, contractTypeValidator_1.updateContractTypeValidation, validateRequest_1.validateRequest, contractTypeController_1.ContractTypeController.updateContractType);
// DELETE /api/contract-types/:id - Delete contract type (HR and Admin only)
router.delete("/:id", auth_1.authenticate, auth_1.hrAndAdmin, contractTypeController_1.ContractTypeController.deleteContractType);
// PATCH /api/contract-types/:id/toggle - Toggle contract type status (HR and Admin only)
router.patch("/:id/toggle", auth_1.authenticate, auth_1.hrAndAdmin, contractTypeController_1.ContractTypeController.toggleContractTypeStatus);
exports.default = router;
