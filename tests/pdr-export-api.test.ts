// tests/pdr-export-api.test.ts
//
// API-level test for the HR/Admin PDR export endpoints.
// The real Express router, auth middleware, validators, controller and export
// service run end-to-end; only the Prisma client is replaced with a
// fixture-backed stub (no database required):
//   npx tsx tests/pdr-export-api.test.ts

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import ExcelJS from "exceljs";

// ─── Fixture data (mirrors records produced by loadExportRecords) ─────────────

const QUALITY_FIELDS = [
  "communication", "innovation", "work_ethics", "teamwork", "maturity",
  "initiative", "self_management", "customer_focus", "sense_of_responsibilities",
  "accountability", "work_knowledge", "attendance", "leadership",
];

function qualities(employeeType: string, rating: number, comment: string) {
  const row: any = { employee_type: employeeType, comment, datetime: new Date("2026-02-01") };
  for (const field of QUALITY_FIELDS) row[field] = rating;
  return row;
}

const USER_HR = {
  id: "user_hr", email: "hr@iris.example", role: "HR", userRank: null,
  isActive: true, hasSystemAccess: true, employeeId: "IC-HR001",
  firstName: "Helen", lastName: "Rao", position: "HR Manager", department: "Human Resources",
  officialEmail: "hr@iris.example",
};

const USER_EMPLOYEE = {
  id: "user_ben", email: "ben.raza@iris.example", role: "EMPLOYEE", userRank: null,
  isActive: true, hasSystemAccess: true, employeeId: "IC-EMP002",
  firstName: "Ben", lastName: "Raza", position: "Support Officer", department: "Customer Service",
  officialEmail: "ben.raza@iris.example",
};

const PDR_FIXTURES = [
  {
    id: 101,
    creation_date: new Date("2026-01-15T09:00:00Z"),
    pdr_cycle: "Annual Review 2026",
    pdrCycleId: 1,
    pdr_timeline: "Jan - Dec 2026",
    companyId: "company_iriscommunications",
    company: { id: "company_iriscommunications", name: "iriscommunications" },
    pdrCycle: { id: 1, name: "Annual Review 2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    user: USER_EMPLOYEE,
    linemanager: { id: "user_lm", firstName: "Bob", lastName: "Ahmed" },
    director: { id: "user_dir", firstName: "Carol", lastName: "Iqbal" },
    overallStatus: "COMPLETED",
    emp_status: "COMPLETED",
    linemanager_status: "COMPLETED",
    director_status: "COMPLETED",
    hr_status: "COMPLETED",
    isCompleted: true,
    completedAt: new Date("2026-03-10T14:30:00Z"),
    lastModifiedAt: new Date("2026-03-10T14:30:00Z"),
    training_required: false,
    training_description: null,
    promotion_recommended: false,
    promotion_description: null,
    director_overall_comment: "Solid year.",
    personalQualities: [qualities("EMPLOYEE", 5, "Good year."), qualities("MANAGER", 6, "Great year.")],
    goalsTasks: [
      { id: 1, task: "Goal one", employee_self_rating: 6, linemanager_rating: 6, datetime: new Date("2026-02-01") },
    ],
    overallComments: [{ employee_type: "EMPLOYEE", comment: "Happy with progress.", datetime: new Date("2026-02-02") }],
    comments: [
      {
        employee_type: "EMPLOYEE", pdr_status_type: "EMPLOYEE_SUBMITTED_TO_HR",
        description: "Ready for review.", datetime: new Date("2026-02-02T09:00:00Z"),
        commentType: "GENERAL", sentTo: null, isResolved: false,
      },
    ],
    userId: "user_ben",
  },
  {
    ...PDR_FIXTURE_ALIAS(),
    id: 102,
    pdrCycleId: 1,
    pdr_cycle: "Annual Review 2026",
    pdrCycle: { id: 1, name: "Annual Review 2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    user: {
      id: "user_alice", email: "alice.khan@iris.example", role: "EMPLOYEE", userRank: null,
      isActive: true, hasSystemAccess: true, employeeId: "IC-EMP001",
      firstName: "Alice", lastName: "Khan", position: "Senior Engineer", department: "Technology",
      officialEmail: "alice.khan@iris.example",
    },
    userId: "user_alice",
    overallStatus: "HR_APPROVED_EMPLOYEE",
    emp_status: "APPROVED",
    linemanager_status: "PENDING",
    director_status: "PENDING",
    hr_status: "APPROVED",
    isCompleted: false,
    completedAt: null,
    personalQualities: [qualities("EMPLOYEE", 4, "Improving.")],
    goalsTasks: [{ id: 2, task: "Goal two", employee_self_rating: 4, linemanager_rating: 0, datetime: new Date("2026-02-01") }],
    director_overall_comment: null,
  },
  {
    ...PDR_FIXTURE_ALIAS(),
    id: 103,
    pdrCycleId: 2,
    pdr_cycle: "Annual Review 2025",
    pdrCycle: { id: 2, name: "Annual Review 2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
    user: USER_EMPLOYEE,
    userId: "user_ben",
    overallStatus: "EMPLOYEE_PENDING",
    emp_status: "PENDING",
    linemanager_status: "PENDING",
    director_status: "PENDING",
    hr_status: "PENDING",
    isCompleted: false,
    completedAt: null,
    personalQualities: [],
    goalsTasks: [],
    director_overall_comment: null,
  },
];

function PDR_FIXTURE_ALIAS() {
  return {
    creation_date: new Date("2026-01-20T09:00:00Z"),
    pdr_timeline: null,
    companyId: "company_iriscommunications",
    company: { id: "company_iriscommunications", name: "iriscommunications" },
    linemanager: { id: "user_lm", firstName: "Bob", lastName: "Ahmed" },
    director: null,
    lastModifiedAt: new Date("2026-02-15T10:00:00Z"),
    training_required: null,
    training_description: null,
    promotion_recommended: null,
    promotion_description: null,
    overallComments: [],
    comments: [],
  };
}

const CYCLES = [
  { id: 1, name: "Annual Review 2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
  { id: 2, name: "Annual Review 2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
];

// ─── Minimal Prisma WHERE evaluator for the export where-clause shape ─────────

function matchesCondition(record: any, condition: any): boolean {
  if (condition.AND) return condition.AND.every((c: any) => matchesCondition(record, c));
  if (condition.OR) return condition.OR.some((c: any) => matchesCondition(record, c));

  for (const [key, value] of Object.entries(condition)) {
    if (key === "AND" || key === "OR") continue;
    if (!matchesField(record, key, value)) return false;
  }
  return true;
}

function matchesField(record: any, key: string, value: any): boolean {
  if (key === "user") return matchesCondition(record.user, value);
  if (key === "pdrCycleId") {
    if (value === null) return record.pdrCycleId === null || record.pdrCycleId === undefined;
    if (typeof value === "object" && value !== null && "in" in value) {
      return value.in.includes(record.pdrCycleId);
    }
    return record.pdrCycleId === value;
  }
  if (key === "pdr_cycle") {
    if (typeof value === "object" && value !== null && "in" in value) {
      return value.in.includes(record.pdr_cycle);
    }
    return record.pdr_cycle === value;
  }
  if (key === "companyId") {
    if (typeof value === "object" && value !== null && "in" in value) return value.in.includes(record.companyId);
    return record.companyId === value;
  }
  if (key === "userId") {
    if (typeof value === "object" && value !== null && "in" in value) return value.in.includes(record.userId);
    return record.userId === value;
  }
  if (key === "overallStatus") {
    if (typeof value === "object" && value !== null && "in" in value) return value.in.includes(record.overallStatus);
    return record.overallStatus === value;
  }
  if (key === "isCompleted") return record.isCompleted === value;
  if (typeof value === "object" && value !== null && "in" in value) {
    return value.in.includes(record[key]);
  }
  return record[key] === value;
}

// ─── Prisma stub (installed via a Module._load hook before importing the router) ──

const prismaStub: any = {
  pdr: {
    count: async ({ where }: any) => PDR_FIXTURES.filter((r) => matchesCondition(r, where || {})).length,
    findMany: async ({ where }: any) =>
      PDR_FIXTURES.filter((r) => matchesCondition(r, where || {})).map((r) => ({ ...r })),
  },
  pdrCycle: {
    findMany: async ({ where }: any) => {
      const ids = where?.id?.in || [];
      return CYCLES.filter((c) => ids.includes(c.id));
    },
  },
  user: {
    findUnique: async ({ where }: any) => {
      if (where.id === USER_HR.id) return { ...USER_HR };
      if (where.id === USER_EMPLOYEE.id) return { ...USER_EMPLOYEE };
      if (where.id === "user_alice") return { ...PDR_FIXTURES[1].user };
      return null;
    },
  },
};

function installModuleStub(suffix: string, exports: unknown) {
  const Module = require("module") as any;
  const originalLoad = Module._load;
  Module._load = function (request: string, parent: any, isMain: boolean) {
    try {
      const resolved: string = Module._resolveFilename(request, parent);
      if (resolved.endsWith(suffix)) {
        return exports;
      }
    } catch {
      /* fall through to the original loader */
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

installModuleStub("src/lib/prisma.ts", { prisma: prismaStub });
installModuleStub("src/index.ts", { getSocketManager: () => ({}) });

// Real router/controller/service are required AFTER the stubs are installed
// (inside main) — static imports would hoist above the hook installation.

// ─── HTTP harness ─────────────────────────────────────────────────────────────

async function main() {
  // Requires happen here so they run after the Module._load stubs are installed
  const { default: pdrRoutes } = require("../src/routes/pdrRoutes");
  const { JwtUtils } = require("../src/utils/jwt");
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/v1/pdr", pdrRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api/v1/pdr`;

  const hrToken = JwtUtils.generateAccessToken({
    userId: USER_HR.id, email: USER_HR.email, role: "HR" as any, employeeId: USER_HR.employeeId,
  });
  const employeeToken = JwtUtils.generateAccessToken({
    userId: USER_EMPLOYEE.id, email: USER_EMPLOYEE.email, role: "EMPLOYEE" as any, employeeId: USER_EMPLOYEE.employeeId,
  });

  let failures = 0;
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  ✔ ${name}`);
    } catch (error: any) {
      failures += 1;
      console.error(`  ✘ ${name}\n      ${error.message}`);
    }
  };

  const post = async (path: string, body: unknown, token?: string) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    });

  console.log("Authorization");
  await test("unauthenticated request is rejected with 401", async () => {
    const response = await post("/export/preview", {});
    assert.equal(response.status, 401);
    const response2 = await post("/export", {});
    assert.equal(response2.status, 401);
  });

  await test("regular employee is rejected with 403 (backend enforcement)", async () => {
    const preview = await post("/export/preview", {}, employeeToken);
    assert.equal(preview.status, 403);
    const exported = await post("/export", {}, employeeToken);
    assert.equal(exported.status, 403);
    const body: any = await exported.json();
    assert.match(body.message, /(not authorized|required roles)/i);
  });

  await test("invalid filters are rejected with 400", async () => {
    const response = await post("/export/preview", { cycleIds: ["abc"] }, hrToken);
    assert.equal(response.status, 400);
    const body: any = await response.json();
    assert.equal(body.success, false);
  });

  console.log("\nPreview");
  await test("preview returns counts for all records", async () => {
    const response = await post("/export/preview", {}, hrToken);
    assert.equal(response.status, 200);
    const body: any = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.pdrCount, 3);
    assert.equal(body.data.employeeCount, 2);
    assert.equal(body.data.completedCount, 1);
    assert.deepEqual([...body.data.availableUserIds].sort(), ["user_alice", "user_ben"]);
  });

  await test("preview respects cycle, department and status filters", async () => {
    const byCycle = await (await post("/export/preview", { cycleIds: [2] }, hrToken)).json();
    assert.equal(byCycle.data.pdrCount, 1);
    assert.deepEqual(byCycle.data.availableUserIds, ["user_ben"]);

    const byDept = await (await post("/export/preview", { departments: ["Technology"] }, hrToken)).json();
    assert.equal(byDept.data.pdrCount, 1);
    assert.deepEqual(byDept.data.availableUserIds, ["user_alice"]);

    const byStatus = await (await post("/export/preview", { statuses: ["COMPLETED"] }, hrToken)).json();
    assert.equal(byStatus.data.pdrCount, 1);

    const byEmployee = await (
      await post("/export/preview", { userIds: ["user_alice"] }, hrToken)
    ).json();
    assert.equal(byEmployee.data.pdrCount, 1);

    // legacy PDR rows matched by cycle name when pdrCycleId is absent
    const byCycleName = await (
      await post("/export/preview", { cycleIds: [2], legacyNameMatch: true }, hrToken)
    ).json();
    assert.equal(byCycleName.data.pdrCount, 1);
  });

  await test("unknown status values are ignored rather than breaking the request", async () => {
    const response = await post("/export/preview", { statuses: ["NOT_A_STATUS"] }, hrToken);
    assert.equal(response.status, 200);
    const body: any = await response.json();
    assert.equal(body.data.pdrCount, 3);
  });

  console.log("\nExport");
  await test("HR export returns a valid xlsx workbook with server filename", async () => {
    const response = await post("/export", { cycleIds: [1] }, hrToken);
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const disposition = response.headers.get("content-disposition") || "";
    assert.match(disposition, /attachment; filename="PDR_Export_Annual_Review_2026_\d{4}-\d{2}-\d{2}\.xlsx"/);
    assert.equal(response.headers.get("x-export-record-count"), "2");
    assert.equal(response.headers.get("x-export-employee-count"), "2");

    const buffer = Buffer.from(await response.arrayBuffer());
    assert.ok(buffer.subarray(0, 2).toString() === "PK", "file should be a zip archive");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
      "PDR Performance Results",
      "PDR Rating Details",
      "Rating Scale",
    ]);
    const summary = workbook.getWorksheet("PDR Performance Results")!;
    assert.equal(summary.getCell(5, 1).value, "IC-EMP002"); // Ben, cycle 1
    assert.equal(summary.getCell(6, 1).value, "IC-EMP001"); // Alice, cycle 1
    assert.equal(summary.getCell(7, 1).value, null); // cycle 2 excluded
  });

  await test("export with no matching records returns 404 with a friendly message", async () => {
    const response = await post("/export", { departments: ["Nonexistent Department"] }, hrToken);
    assert.equal(response.status, 404);
    const body: any = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /No PDR records match/i);
  });

  await test("multi-cycle export keeps records independent", async () => {
    const response = await post("/export", { userIds: ["user_ben"] }, hrToken);
    assert.equal(response.status, 200);
    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const summary = workbook.getWorksheet("PDR Performance Results")!;
    assert.equal(summary.getCell(5, 2).value, "Ben Raza"); // records 101 then 103
    assert.equal(summary.getCell(6, 2).value, "Ben Raza");
    // two different cycles in one workbook, kept independent
    assert.equal(summary.getCell(5, 5).value, "Annual Review 2026");
    assert.equal(summary.getCell(6, 5).value, "Annual Review 2025");
  });

  server.close();
  console.log(failures === 0 ? "\nAll API tests passed ✅" : `\n${failures} API test(s) failed ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
