import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import { createEmployeeValidation, updateEmployeeValidation } from "../src/validators/employeeValidator";

async function main() {
  const defaultCompanyId = "company_iriscommunications";
  const cuidCompanyId = "cm123456789012345678901234";

  for (const validators of [createEmployeeValidation, updateEmployeeValidation]) {
    for (const companyIds of [
      [defaultCompanyId],
      [cuidCompanyId],
      [defaultCompanyId, cuidCompanyId],
      JSON.stringify([defaultCompanyId]), // Employee form's multipart field.
      JSON.stringify([defaultCompanyId, cuidCompanyId]),
    ]) {
      const req = { body: { companyIds } };
      for (const validator of validators) await validator.run(req);
      const companyErrors = validationResult(req).array().filter(
        (error) => error.type === "field" && error.path.startsWith("companyIds"),
      );
      assert.deepEqual(companyErrors, [], JSON.stringify(companyIds));
      assert.ok(Array.isArray(req.body.companyIds));
    }
  }

  for (const companyIds of [[], [""], [123], [null], [{}], ["invalid company!"], JSON.stringify(["invalid company!"])]) {
    const req = { body: { companyIds } };
    for (const validator of updateEmployeeValidation) await validator.run(req);
    assert.ok(!validationResult(req).isEmpty(), `Should reject ${JSON.stringify(companyIds)}`);
  }

  const req = { body: { firstName: "Updated" } };
  for (const validator of updateEmployeeValidation) await validator.run(req);
  assert.ok(validationResult(req).isEmpty(), "Partial updates may omit company IDs");
  console.log("Employee company validation passed for create/edit, multipart fields, invalid IDs, and partial updates.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
