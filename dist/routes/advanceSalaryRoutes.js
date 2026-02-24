"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const advanceSalaryController_1 = require("../controller/advanceSalaryController");
const auth_1 = require("../middleware/auth");
const validateRequest_1 = require("../middleware/validateRequest");
const advanceSalaryValidator_1 = require("../validators/advanceSalaryValidator");
const router = (0, express_1.Router)();
router.post("/", auth_1.authenticate, advanceSalaryValidator_1.createAsrValidator, validateRequest_1.validateRequest, advanceSalaryController_1.createAdvanceSalaryRequest);
//fetch all
router.get("/", auth_1.authenticate, advanceSalaryController_1.fetchAllAdvanceSalary);
// fetch by uid
router.get("/:id", auth_1.authenticate, advanceSalaryController_1.fetchAdvanceSalaryByUserId);
//delete
// router.delete('/:id')
// updated
router.put("/:id", auth_1.authenticate, advanceSalaryController_1.updateAdvaceSalaryStatus);
exports.default = router;
