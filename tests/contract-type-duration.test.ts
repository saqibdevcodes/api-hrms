import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import {
  createContractTypeValidation,
  updateContractTypeValidation,
} from "../src/validators/contractTypeValidator";

async function main() {
  for (const validators of [createContractTypeValidation, updateContractTypeValidation]) {
    for (const durationUnit of ["MONTH", "YEAR"]) {
      for (const duration of [1, 3, 120, "12", null, undefined]) {
        const req = { body: { name: "Fixed Term", duration, durationUnit } };
        for (const validator of validators) await validator.run(req);
        assert.deepEqual(validationResult(req).array(), [], JSON.stringify(req.body));
      }
    }

    for (const duration of [0, -1, 121, 1.5, "", "3 months", "1e2", "2.5", "+2", " 2 ", true, [2], {}]) {
      const req = { body: { name: "Fixed Term", duration, durationUnit: "MONTH" } };
      for (const validator of validators) await validator.run(req);
      assert.ok(!validationResult(req).isEmpty(), `Reject duration ${JSON.stringify(duration)}`);
    }

    for (const durationUnit of ["WEEK", "months", "", null, 1, ["MONTH"]]) {
      const req = { body: { name: "Fixed Term", duration: 2, durationUnit } };
      for (const validator of validators) await validator.run(req);
      assert.ok(!validationResult(req).isEmpty(), `Reject unit ${JSON.stringify(durationUnit)}`);
    }
  }

  // Exercise real controller persistence without connecting to a database.
  let saved: Record<string, any> = {};
  let writes = 0;
  const prismaStub = {
    company: { count: async () => 1 },
    contractType: {
      create: async ({ data }: any) => {
        writes++;
        saved = { id: "contract-1", ...data };
        return { ...saved };
      },
      findUnique: async () => ({ ...saved }),
      update: async ({ data }: any) => {
        writes++;
        Object.assign(saved, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
        return { ...saved };
      },
    },
  };
  const prismaPath = require.resolve("../src/lib/prisma");
  require.cache[prismaPath] = { exports: { prisma: prismaStub } } as NodeModule;
  const { ContractTypeController } = require("../src/controller/contractTypeController");

  async function invoke(action: "create" | "update" | "get", body: Record<string, unknown> = {}) {
    const req = { body, params: { id: "contract-1" } };
    const validators = action === "create" ? createContractTypeValidation : action === "update" ? updateContractTypeValidation : [];
    for (const validator of validators) await validator.run(req);
    const result = { status: 200, body: {} as any };
    const res = {
      status(code: number) { result.status = code; return this; },
      json(value: unknown) { result.body = value; return this; },
    };
    const handler = action === "create" ? "createContractType" : action === "update" ? "updateContractType" : "getContractTypeById";
    await ContractTypeController[handler](req, res);
    return result;
  }

  const created = await invoke("create", {
    name: "Fixed Term", duration: "2", durationUnit: "YEAR", companyIds: ["company-1"],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.duration, 2);
  assert.equal(created.body.data.durationUnit, "YEAR");

  const updated = await invoke("update", { duration: 6, durationUnit: "MONTH" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.duration, 6);
  assert.equal(updated.body.data.durationUnit, "MONTH");

  await invoke("update", { description: "Changed description only" });
  const reloaded = await invoke("get");
  assert.equal(reloaded.body.data.duration, 6, "Unrelated updates preserve duration");
  assert.equal(reloaded.body.data.durationUnit, "MONTH");

  await invoke("update", { duration: 1, durationUnit: "YEAR" });
  await invoke("update", { duration: 3 });
  assert.equal((await invoke("get")).body.data.durationUnit, "YEAR", "Omitted unit stays unchanged");

  const beforeInvalid = writes;
  assert.equal((await invoke("update", { duration: "2 years", durationUnit: "YEAR" })).status, 400);
  assert.equal((await invoke("update", { duration: 2, durationUnit: "WEEK" })).status, 400);
  assert.equal(writes, beforeInvalid, "Invalid durations never reach persistence");

  const legacy = await invoke("create", { name: "Legacy", duration: 6, companyIds: ["company-1"] });
  assert.equal(legacy.body.data.durationUnit, "MONTH", "Older clients default to months");
  const cleared = await invoke("update", { duration: null });
  assert.equal(cleared.body.data.duration, null, "Existing open-ended contracts remain supported");

  console.log("Contract duration validation and create/edit/reload checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
