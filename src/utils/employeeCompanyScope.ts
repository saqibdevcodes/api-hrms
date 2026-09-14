import type { Prisma } from "@prisma/client";

export const assertEmploymentResourcesInCompanies = async (
  db: Pick<Prisma.TransactionClient,
    "companyDepartment" | "companyContractType" | "companyShift" | "companyLeavePolicy" | "companyEmploymentType"
  >,
  companyIds: string[],
  resources: {
    departmentId?: string | null;
    contractTypeId?: string | null;
    shiftId?: string | null;
    leaveId?: string | null;
    employmentTypeId?: string | null;
  },
) => {
  const checks = [
    resources.departmentId && {
      label: "Department",
      count: db.companyDepartment.count({
        where: { departmentId: resources.departmentId, companyId: { in: companyIds } },
      }),
    },
    resources.contractTypeId && {
      label: "Contract type",
      count: db.companyContractType.count({
        where: { contractTypeId: resources.contractTypeId, companyId: { in: companyIds } },
      }),
    },
    resources.shiftId && {
      label: "Shift",
      count: db.companyShift.count({
        where: { shiftId: resources.shiftId, companyId: { in: companyIds } },
      }),
    },
    resources.leaveId && {
      label: "Leave policy",
      count: db.companyLeavePolicy.count({
        where: { leavePolicyId: resources.leaveId, companyId: { in: companyIds } },
      }),
    },
    resources.employmentTypeId && {
      label: "Employment type",
      count: db.companyEmploymentType.count({
        where: { employmentTypeId: resources.employmentTypeId, companyId: { in: companyIds } },
      }),
    },
  ].filter(Boolean) as Array<{ label: string; count: Promise<number> }>;

  for (const check of checks) {
    if ((await check.count) === 0) {
      throw new Error(`${check.label} is not assigned to any selected company`);
    }
  }
};

