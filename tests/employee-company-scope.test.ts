import assert from "node:assert/strict";
import { isAvailableForCompanies } from "../../hrms/src/utils/employeeCompanyScope";
import { assertEmploymentResourcesInCompanies } from "../src/utils/employeeCompanyScope";

const options = [
  { id: "only-a", companyAssignments: [{ companyId: "a" }] },
  { id: "only-b", companyAssignments: [{ companyId: "b" }] },
  { id: "shared", companyAssignments: [{ companyId: "a" }, { companyId: "b" }] },
  { id: "outside", companyAssignments: [{ companyId: "c" }] },
  { id: "unassigned", companyAssignments: [] },
];

const resources = [
  ["departmentId", "companyDepartment", "Department"],
  ["employmentTypeId", "companyEmploymentType", "Employment type"],
  ["contractTypeId", "companyContractType", "Contract type"],
  ["shiftId", "companyShift", "Shift"],
  ["leaveId", "companyLeavePolicy", "Leave policy"],
] as const;

const db = Object.fromEntries(resources.map(([field, model]) => [model, {
  count: async ({ where }: any) => {
    const resourceId = where[field === "leaveId" ? "leavePolicyId" : field];
    const option = options.find((option) => option.id === resourceId);
    return option?.companyAssignments.filter(({ companyId }) => where.companyId.in.includes(companyId)).length ?? 0;
  },
}])) as unknown as Parameters<typeof assertEmploymentResourcesInCompanies>[0];

async function main() {
  // Selecting A and B shows their union once, including options exclusive to either.
  assert.deepEqual(options.filter((option) => isAvailableForCompanies(option, ["a", "b"]))
    .map((option) => option.id), ["only-a", "only-b", "shared"]);
  // Removing A retains shared/B options but excludes A-only options.
  assert.deepEqual(options.filter((option) => isAvailableForCompanies(option, ["b"]))
    .map((option) => option.id), ["only-b", "shared"]);
  assert.deepEqual(options.filter((option) => isAvailableForCompanies(option, [])), []);
  assert.equal(isAvailableForCompanies(null, ["a"]), false);
  assert.equal(isAvailableForCompanies({}, ["a"]), false);

  for (const [field, , label] of resources) {
    for (const option of options) {
      for (const selected of [["a", "b"], ["a"], ["b"], []]) {
        const validate = () => assertEmploymentResourcesInCompanies(db, selected, { [field]: option.id });
        if (isAvailableForCompanies(option, selected)) {
          await assert.doesNotReject(validate, `${label}: ${option.id} for ${selected}`);
        } else {
          await assert.rejects(validate, { message: `${label} is not assigned to any selected company` });
        }
      }
    }
  }
  // One employee may use different employment options from different selected companies.
  await assertEmploymentResourcesInCompanies(db, ["a", "b"], {
    departmentId: "only-a", employmentTypeId: "only-b", contractTypeId: "shared",
    shiftId: "only-b", leaveId: "only-a",
  });
  console.log("Company scope regressions passed for all 5 employment options, frontend/backend parity, and mixed-company selections.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
