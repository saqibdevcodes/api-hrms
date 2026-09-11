// tests/pdr-export-workbook.test.ts
//
// Workbook + calculation tests for the HR/Admin PDR Excel export.
// Runs against fixture PDR records (no database required):
//   npx tsx tests/pdr-export-workbook.test.ts
//
// Expected values are hand-computed from the PDR details page formulas:
//   Part 1: weight 30, max 91   Part 2: weight 70, max = goals × 7
//   Overall = part1 weighted + part2 weighted

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";

import {
  calculatePdrResults,
  getRatingLabel,
} from "../src/utils/pdrCalculations";
import {
  buildPdrWorkbook,
  parseExportFilters,
} from "../src/services/pdrExportService";
import { PDR_PERFORMANCE_FACTORS } from "../src/utils/pdrCalculations";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CYCLE_2026 = { id: 1, name: "Annual Review 2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") };
const CYCLE_2025 = { id: 2, name: "Annual Review 2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") };

const QUALITY_FIELDS = [
  "communication", "innovation", "work_ethics", "teamwork", "maturity",
  "initiative", "self_management", "customer_focus", "sense_of_responsibilities",
  "accountability", "work_knowledge", "attendance", "leadership",
] as const;

function qualities(employeeType: string, employeeRating: number, managerRating: number, comment: string) {
  const ratings: any = { employee_type: employeeType, comment, datetime: new Date("2026-02-01") };
  for (const field of QUALITY_FIELDS) {
    ratings[field] = employeeType === "MANAGER" ? managerRating : employeeRating;
  }
  return ratings;
}

/** Fully assessed PDR: employee rates all 5s (65/91, 7 goals 40/49), manager all 6s (78/91, 45/49). */
const PDR_ALICE_2026 = {
  id: 101,
  creation_date: new Date("2026-01-15T09:00:00Z"),
  pdr_cycle: "Annual Review 2026",
  pdr_timeline: "Jan 2026 - Dec 2026",
  companyId: "company_iriscommunications",
  company: { id: "company_iriscommunications", name: "iriscommunications" },
  pdrCycle: CYCLE_2026,
  user: {
    id: "user_alice", employeeId: "IC-EMP001", firstName: "Alice", lastName: "Khan",
    officialEmail: "alice.khan@iris.example", email: "alice.khan@iris.example",
    position: "Senior Engineer", department: "Technology", dateOfJoining: new Date("2023-03-01"),
  },
  linemanager: { id: "user_bob", firstName: "Bob", lastName: "Ahmed" },
  director: { id: "user_carol", firstName: "Carol", lastName: "Iqbal" },
  overallStatus: "COMPLETED" as const,
  emp_status: "COMPLETED" as const,
  linemanager_status: "COMPLETED" as const,
  director_status: "COMPLETED" as const,
  hr_status: "COMPLETED" as const,
  isCompleted: true,
  completedAt: new Date("2026-03-10T14:30:00Z"),
  lastModifiedAt: new Date("2026-03-10T14:30:00Z"),
  training_required: true,
  training_description: "Advanced leadership program",
  promotion_recommended: true,
  promotion_description: "Promote to Team Lead in Q3",
  director_overall_comment: "Consistently strong performer; ready for the next level.",
  personalQualities: [
    qualities("EMPLOYEE", 5, 0, "I believe I delivered solid work across all factors."),
    qualities("MANAGER", 0, 6, "Alice exceeds expectations in every area."),
  ],
  goalsTasks: [
    { id: 1, task: "Deliver API migration", employee_self_rating: 6, linemanager_rating: 6, datetime: new Date("2026-02-01T10:00:00Z") },
    { id: 2, task: "Reduce page load time", employee_self_rating: 5, linemanager_rating: 6, datetime: new Date("2026-02-01T10:00:01Z") },
    { id: 3, task: "Mentor juniors", employee_self_rating: 6, linemanager_rating: 7, datetime: new Date("2026-02-01T10:00:02Z") },
    { id: 4, task: "Documentation", employee_self_rating: 6, linemanager_rating: 6, datetime: new Date("2026-02-01T10:00:03Z") },
    { id: 5, task: "Customer interviews", employee_self_rating: 5, linemanager_rating: 6, datetime: new Date("2026-02-01T10:00:04Z") },
    { id: 6, task: "Security audit", employee_self_rating: 6, linemanager_rating: 7, datetime: new Date("2026-02-01T10:00:05Z") },
    { id: 7, task: "Hiring support", employee_self_rating: 6, linemanager_rating: 7, datetime: new Date("2026-02-01T10:00:06Z") },
  ],
  overallComments: [
    { employee_type: "EMPLOYEE", comment: "Proud of the API migration outcome.", datetime: new Date("2026-02-02T08:00:00Z") },
    { employee_type: "MANAGER", comment: "Excellent year overall.", datetime: new Date("2026-02-05T08:00:00Z") },
  ],
  comments: [
    {
      employee_type: "EMPLOYEE", pdr_status_type: "EMPLOYEE_SUBMITTED_TO_HR",
      description: "Submitting my self-assessment for review.", datetime: new Date("2026-02-02T09:00:00Z"),
      commentType: "GENERAL", sentTo: null, isResolved: false,
    },
    {
      employee_type: "HR", pdr_status_type: "HR_REVIEWING_EMPLOYEE",
      description: "Please add more evidence for goal 3.", datetime: new Date("2026-02-03T09:00:00Z"),
      commentType: "REVERT", sentTo: "EMPLOYEE", isResolved: true,
    },
    {
      employee_type: "HR", pdr_status_type: "HR_REVIEWING_MANAGER",
      description: "Manager section approved.", datetime: new Date("2026-02-20T09:00:00Z"),
      commentType: "APPROVAL", sentTo: null, isResolved: false,
    },
  ],
};

/** Employee-only PDR (manager not yet assessed): manager quality row absent, goals rated 0. */
const PDR_BEN_2026 = {
  ...PDR_ALICE_2026,
  id: 102,
  user: {
    id: "user_ben", employeeId: "IC-EMP002", firstName: "Ben", lastName: "Raza",
    officialEmail: "ben.raza@iris.example", email: "ben.raza@iris.example",
    position: "Support Officer", department: "Customer Service", dateOfJoining: new Date("2024-06-15"),
  },
  overallStatus: "HR_APPROVED_EMPLOYEE" as const,
  emp_status: "APPROVED" as const,
  linemanager_status: "PENDING" as const,
  director_status: "PENDING" as const,
  hr_status: "APPROVED" as const,
  isCompleted: false,
  completedAt: null,
  training_required: null,
  training_description: null,
  promotion_recommended: null,
  promotion_description: null,
  director_overall_comment: null,
  personalQualities: [qualities("EMPLOYEE", 4, 0, "Steady performance this cycle.")],
  goalsTasks: [
    { id: 11, task: "First-response SLA", employee_self_rating: 5, linemanager_rating: 0, datetime: new Date("2026-02-01T10:00:00Z") },
    { id: 12, task: "Ticket backlog reduction", employee_self_rating: 4, linemanager_rating: 0, datetime: new Date("2026-02-01T10:00:01Z") },
  ],
  overallComments: [
    { employee_type: "EMPLOYEE", comment: "Hoping to improve backlog metrics.", datetime: new Date("2026-02-02T08:00:00Z") },
  ],
  comments: [
    {
      employee_type: "EMPLOYEE", pdr_status_type: "EMPLOYEE_SUBMITTED_TO_HR",
      description: "My self-assessment is ready.", datetime: new Date("2026-02-02T09:00:00Z"),
      commentType: "GENERAL", sentTo: null, isResolved: false,
    },
  ],
};

/** Same employee, previous cycle — proves multi-cycle records stay independent. */
const PDR_BEN_2025 = {
  ...PDR_BEN_2026,
  id: 103,
  pdr_cycle: "Annual Review 2025",
  pdrCycle: CYCLE_2025,
  personalQualities: [qualities("EMPLOYEE", 3, 0, "First year — learning the role.")],
  goalsTasks: [
    { id: 21, task: "Onboarding goals", employee_self_rating: 3, linemanager_rating: 0, datetime: new Date("2025-12-01T10:00:00Z") },
  ],
  overallComments: [],
  comments: [],
};

const RECORDS: any[] = [PDR_ALICE_2026, PDR_BEN_2026, PDR_BEN_2025];

// ─── Expected values (hand-computed) ─────────────────────────────────────────

// Alice 2026
// Part 1: employee 13×5 = 65/91 → 71.4286% → weighted 21.43 (65/91×30)
//         manager  13×6 = 78/91 → 85.7143% → weighted 25.71
//         combined (65+78)/182×100 = 78.5714% → weighted 23.57
// Part 2: employee 6+5+6+6+5+6+6 = 40/49 → 81.6327% → weighted 57.14
//         manager  6+6+7+6+6+7+7 = 45/49 → 91.8367% → weighted 64.29
//         combined (40+45)/98×100 = 86.7347% → weighted 60.71
// Employee overall = 78.57 → Excellent; Manager overall = 90.00 → Outstanding
// Combined overall = 84.29 → Excellent
const ALICE_EXPECTED = {
  p1EmpWeighted: round2((65 / 91) * 30), // 21.43
  p1MgrWeighted: round2((78 / 91) * 30), // 25.71
  p1CombinedWeighted: round2((143 / 182) * 30), // 23.57
  p2EmpWeighted: round2((40 / 49) * 70), // 57.14
  p2MgrWeighted: round2((45 / 49) * 70), // 64.29
  p2CombinedWeighted: round2((85 / 98) * 70), // 60.71
  employeeOverall: round2((65 / 91) * 30 + (40 / 49) * 70), // 78.57
  managerOverall: round2((78 / 91) * 30 + (45 / 49) * 70), // 90.0
  combinedOverall: round2((143 / 182) * 30 + (85 / 98) * 70), // 84.29
};

// Ben 2026: employee only. Part 1: 13×4 = 52/91 → weighted 17.14
//           Part 2: 5+4 = 9/14 → weighted 45.0. Overall 62.14 → Very Good.
const BEN_EXPECTED = {
  employeeOverall: round2((52 / 91) * 30 + (9 / 14) * 70), // 62.14
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function cellNumber(sheet: ExcelJS.Worksheet, row: number, col: number): number {
  const value = sheet.getCell(row, col).value;
  assert.ok(typeof value === "number", `Expected number at (${row},${col}), got ${String(value)}`);
  return value;
}

function cellText(sheet: ExcelJS.Worksheet, row: number, col: number): string {
  const value = sheet.getCell(row, col).value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in (value as any)) {
    return (value as any).richText.map((r: any) => r.text).join("");
  }
  if (typeof value === "object" && "result" in (value as any)) return String((value as any).result);
  return String(value);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  let failures = 0;
  const test = (name: string, fn: () => void | Promise<void>) =>
    Promise.resolve()
      .then(fn)
      .then(() => console.log(`  ✔ ${name}`))
      .catch((error) => {
        failures += 1;
        console.error(`  ✘ ${name}\n      ${error.message}`);
      });

  console.log("Calculation module");
  const aliceResult = calculatePdrResults(PDR_ALICE_2026);
  const benResult = calculatePdrResults(PDR_BEN_2026);

  await test("Part 1 weighted scores match the details-page formulas", () => {
    assert.equal(round2(aliceResult.part1.employeeWeightedScore), ALICE_EXPECTED.p1EmpWeighted);
    assert.equal(round2(aliceResult.part1.managerWeightedScore), ALICE_EXPECTED.p1MgrWeighted);
    assert.equal(round2(aliceResult.part1.combinedWeightedScore), ALICE_EXPECTED.p1CombinedWeighted);
  });

  await test("Part 2 weighted scores match the details-page formulas", () => {
    assert.equal(round2(aliceResult.part2.employeeWeightedScore), ALICE_EXPECTED.p2EmpWeighted);
    assert.equal(round2(aliceResult.part2.managerWeightedScore), ALICE_EXPECTED.p2MgrWeighted);
    assert.equal(round2(aliceResult.part2.combinedWeightedScore), ALICE_EXPECTED.p2CombinedWeighted);
  });

  await test("Overall scores and performance band match the details page", () => {
    assert.equal(round2(aliceResult.employeeOverallScore), ALICE_EXPECTED.employeeOverall);
    assert.equal(round2(aliceResult.managerOverallScore), ALICE_EXPECTED.managerOverall);
    assert.equal(round2(aliceResult.combinedOverallScore), ALICE_EXPECTED.combinedOverall);
    assert.equal(aliceResult.performanceBand.label, "Excellent");
  });

  await test("Manager-untouched PDR shows no combined result (pending manager)", () => {
    assert.equal(benResult.part1.hasManagerRatings, false);
    assert.equal(benResult.part2.hasManagerRatings, false);
    assert.equal(round2(benResult.employeeOverallScore), BEN_EXPECTED.employeeOverall);
    assert.equal(benResult.combinedOverallScore, 0);
    assert.equal(getRatingLabel(7), "Outstanding");
    assert.equal(getRatingLabel(1), "Unsatisfactory");
    assert.equal(getRatingLabel(0), "");
  });

  console.log("\nFilter parsing");
  await test("parseExportFilters normalizes and drops invalid values", () => {
    const filters = parseExportFilters({
      departments: ["Technology", "Technology", " "],
      cycleIds: [1, "2", "abc", -3],
      statuses: ["COMPLETED", "NOT_A_STATUS"],
      userIds: ["user_alice"],
      companyIds: ["company_iriscommunications"],
    });
    assert.deepEqual(filters.departments, ["Technology"]);
    assert.deepEqual(filters.cycleIds, [1, 2]);
    assert.deepEqual(filters.statuses, ["COMPLETED"]);
    assert.deepEqual(filters.userIds, ["user_alice"]);
  });

  console.log("\nWorkbook generation");
  const workbook = await buildPdrWorkbook(
    RECORDS,
    "hr@iris.example",
    new Date("2026-09-11T10:00:00Z"),
  );

  await test("workbook holds exactly the three performance-report sheets", () => {
    assert.deepEqual(workbook.worksheets.map((s) => s.name), [
      "PDR Performance Results",
      "PDR Rating Details",
      "Rating Scale",
    ]);
  });

  const results = workbook.getWorksheet("PDR Performance Results")!;
  await test("results sheet: 18 columns, frozen panes, autofilter, section bands", () => {
    assert.equal(results.columnCount, 18);
    // masthead
    assert.equal(cellText(results, 1, 1), "PDR Performance Report");
    // header row 4
    assert.equal(cellText(results, 4, 1), "Employee ID");
    assert.equal(cellText(results, 4, 2), "Employee Name");
    assert.equal(cellText(results, 4, 10), "Employee Total (/100)");
    assert.equal(cellText(results, 4, 15), "Manager Total (/100)");
    assert.equal(cellText(results, 4, 16), "Total Score (/100)");
    assert.equal(cellText(results, 4, 17), "Combined %");
    assert.equal(cellText(results, 4, 18), "Final Performance Rating");
    // frozen: header rows AND the two identity columns stay visible
    assert.equal(results.views[0].state, "frozen");
    assert.equal(results.views[0].xSplit, 2);
    assert.equal(results.views[0].ySplit, 4);
    assert.deepEqual(results.autoFilter, { from: { row: 4, column: 1 }, to: { row: 4, column: 18 } });
    // row heights: masthead, section bands and wrapped headers are readable
    assert.equal(results.getRow(1).height, 30);
    assert.equal(results.getRow(3).height, 30);
    assert.equal(results.getRow(4).height, 30);
  });

  await test("results sheet: strong section hierarchy with distinct colour tones", () => {
    // Section bands: saturated fills, white bold text (\n = deliberate line
    // break so two-line labels fit narrow merged spans without clipping)
    const bands: [number, string, string][] = [
      [1, "EMPLOYEE INFORMATION", "FF475569"], // neutral slate
      [6, "PART 1 — EMPLOYEE\nSELF (OF 30)", "FF4F46E5"], // indigo
      [8, "PART 2 — EMPLOYEE\nSELF (OF 70)", "FF0D9488"], // teal
      [10, "EMPLOYEE\nTOTAL", "FF4338CA"],
      [11, "PART 1 — MANAGER\n(OF 30)", "FF6D28D9"], // violet
      [13, "PART 2 — MANAGER\n(OF 70)", "FF6D28D9"],
      [15, "MANAGER\nTOTAL", "FF5B21B6"],
      [16, "FINAL RESULT", "FF065F46"], // emerald — strongest
    ];
    for (const [col, label, fill] of bands) {
      assert.equal(cellText(results, 3, col), label);
      assert.equal((results.getCell(3, col).fill as any).fgColor.argb, fill, `band fill col ${col}`);
      assert.equal((results.getCell(3, col).font as any).color.argb, "FFFFFFFF");
      assert.equal((results.getCell(3, col).font as any).bold, true);
    }
    // Column headers: light tint of the section hue with dark text
    const headerTints: [number, string, string][] = [
      [1, "FFE2E8F0", "FF334155"], // slate tint
      [6, "FFC7D2FE", "FF312E81"], // indigo tint
      [8, "FF99F6E4", "FF115E59"], // teal tint
      [10, "FFA5B4FC", "FF1E1B4B"], // employee total
      [11, "FFDDD6FE", "FF5B21B6"], // violet tint
      [16, "FF6EE7B7", "FF022C22"], // final result (deepest tint)
    ];
    for (const [col, fill, text] of headerTints) {
      assert.equal((results.getCell(4, col).fill as any).fgColor.argb, fill, `header fill col ${col}`);
      assert.equal((results.getCell(4, col).font as any).color.argb, text, `header text col ${col}`);
    }
    // section boundaries drawn through the data area
    assert.equal((results.getCell(5, 6).border as any).left.style, "medium");
    assert.equal((results.getCell(5, 16).border as any).left.style, "medium");
    assert.equal((results.getCell(5, 5).border as any).left.style, "hair");
  });

  await test("no section band is clipped: label fits its merged span", () => {
    // Conservative width model: column unit ≈ 7px (Calibri 11 digit), a bold
    // 10pt uppercase character ≈ 6.4px, plus cell padding.
    const check = (sheet: ExcelJS.Worksheet, startCol: number, span: number, label: string) => {
      const mergedPx = Array.from({ length: span }, (_, i) => sheet.getColumn(startCol + i).width || 8.43)
        .reduce((sum, w) => sum + w * 7 + 5, 0);
      const longestLine = Math.max(...label.split("\n").map((line) => line.length));
      const textPx = longestLine * 6.4 + 8;
      assert.ok(
        mergedPx >= textPx,
        `"${label.replace("\n", " / ")}" on "${sheet.name}" needs ~${Math.round(textPx)}px but its merged span is ~${Math.round(mergedPx)}px`,
      );
      if (label.includes("\n")) {
        assert.equal((sheet.getCell(3, startCol).alignment as any).wrapText, true, `wrapText missing for "${label}"`);
      }
    };
    check(results, 1, 5, "EMPLOYEE INFORMATION");
    check(results, 6, 2, "PART 1 — EMPLOYEE\nSELF (OF 30)");
    check(results, 8, 2, "PART 2 — EMPLOYEE\nSELF (OF 70)");
    check(results, 10, 1, "EMPLOYEE\nTOTAL");
    check(results, 11, 2, "PART 1 — MANAGER\n(OF 30)");
    check(results, 13, 2, "PART 2 — MANAGER\n(OF 70)");
    check(results, 15, 1, "MANAGER\nTOTAL");
    check(results, 16, 3, "FINAL RESULT");
  });

  await test("results sheet: one row per PDR, employees stay separated", () => {
    assert.deepEqual(
      [5, 6, 7].map((r) => [cellText(results, r, 1), cellText(results, r, 2), cellText(results, r, 3), cellText(results, r, 4), cellText(results, r, 5)]),
      [
        ["IC-EMP001", "Alice Khan", "Technology", "Senior Engineer", "Annual Review 2026"],
        ["IC-EMP002", "Ben Raza", "Customer Service", "Support Officer", "Annual Review 2026"],
        ["IC-EMP002", "Ben Raza", "Customer Service", "Support Officer", "Annual Review 2025"],
      ],
    );
  });

  await test("results sheet: Alice row matches the details page exactly (cols 6-18)", () => {
    assert.equal(cellNumber(results, 5, 6), ALICE_EXPECTED.p1EmpWeighted); // 21.43
    assert.ok(Math.abs(cellNumber(results, 5, 7) - 0.7143) < 1e-9); // 71.43 %
    assert.equal(cellNumber(results, 5, 8), ALICE_EXPECTED.p2EmpWeighted); // 57.14
    assert.ok(Math.abs(cellNumber(results, 5, 9) - 0.8163) < 1e-9); // 81.63 %
    assert.equal(cellNumber(results, 5, 10), ALICE_EXPECTED.employeeOverall); // 78.57
    assert.equal(cellNumber(results, 5, 11), ALICE_EXPECTED.p1MgrWeighted); // 25.71
    assert.ok(Math.abs(cellNumber(results, 5, 12) - 0.8571) < 1e-9); // 85.71 %
    assert.equal(cellNumber(results, 5, 13), ALICE_EXPECTED.p2MgrWeighted); // 64.29
    assert.ok(Math.abs(cellNumber(results, 5, 14) - 0.9184) < 1e-9); // 91.84 %
    assert.equal(cellNumber(results, 5, 15), ALICE_EXPECTED.managerOverall); // 90
    assert.equal(cellNumber(results, 5, 16), ALICE_EXPECTED.combinedOverall); // 84.29
    assert.ok(Math.abs(cellNumber(results, 5, 17) - 0.8429) < 1e-9); // 84.29 %
    assert.equal(cellText(results, 5, 18), "Excellent");
  });

  await test("results sheet: manager-pending rows show no manager result yet", () => {
    assert.equal(cellNumber(results, 6, 10), BEN_EXPECTED.employeeOverall); // 62.14
    for (let c = 11; c <= 17; c++) {
      assert.equal(results.getCell(6, c).value, null || undefined ? null : results.getCell(6, c).value, `col ${c} should be empty`);
      assert.ok(results.getCell(6, c).value === null || results.getCell(6, c).value === undefined, `col ${c} should be empty`);
    }
    assert.equal(cellText(results, 6, 18), "—");
    assert.equal(cellNumber(results, 7, 10), round2((39 / 91) * 30 + 30)); // 42.86
    assert.equal(cellText(results, 7, 18), "—");
  });

  await test("results sheet: total columns wide enough for their headers", () => {
    assert.equal(results.getColumn(10).width, 13);
    assert.equal(results.getColumn(15).width, 13);
    // score/% columns stay compact — the sheet must not balloon
    assert.equal(results.getColumn(6).width, 9);
    assert.equal(results.getColumn(7).width, 9);
  });

  await test("results sheet: number formats — % columns 0.00%, score columns 0.00", () => {
    assert.equal(results.getCell(5, 7).numFmt, "0.00%");
    assert.equal(results.getCell(5, 9).numFmt, "0.00%");
    assert.equal(results.getCell(5, 17).numFmt, "0.00%");
    assert.equal(results.getCell(5, 6).numFmt, "0.00");
    assert.equal(results.getCell(5, 10).numFmt, "0.00");
    assert.equal(results.getCell(5, 16).numFmt, "0.00");
  });

  await test("results sheet: totals highlighted per section, final rating strongest", () => {
    const excellent = { bg: "FFDCFCE7", text: "FF166534" };
    // Employee total — indigo emphasis, manager total — violet emphasis
    assert.equal((results.getCell(5, 10).fill as any).fgColor.argb, "FFE0E7FF");
    assert.equal((results.getCell(5, 10).font as any).color.argb, "FF312E81");
    assert.equal((results.getCell(5, 15).fill as any).fgColor.argb, "FFEDE9FE");
    assert.equal((results.getCell(5, 15).font as any).color.argb, "FF4C1D95");
    // Final result numerics — strongest emerald emphasis
    assert.equal((results.getCell(5, 16).fill as any).fgColor.argb, "FFD1FAE5");
    assert.equal((results.getCell(5, 17).fill as any).fgColor.argb, "FFD1FAE5");
    assert.equal((results.getCell(5, 16).font as any).color.argb, "FF065F46");
    // Final rating chip matches the Excellent band tone + framed border
    assert.equal((results.getCell(5, 18).fill as any).fgColor.argb, excellent.bg);
    assert.equal((results.getCell(5, 18).font as any).color.argb, excellent.text);
    assert.equal((results.getCell(5, 18).border as any).top.style, "medium");
    assert.equal((results.getCell(5, 18).font as any).size, 10);
  });

  await test("results sheet: zebra striping on alternate data rows", () => {
    assert.equal((results.getCell(6, 2).fill as any).fgColor.argb, "FFF8FAFC"); // row 6 (even)
    const noFill = (cell: ExcelJS.Cell) => {
      const fill = (cell.fill ?? {}) as any;
      assert.ok(fill.pattern === undefined || fill.pattern === "none", `${cell.address} should have no fill`);
    };
    noFill(results.getCell(5, 2));
    noFill(results.getCell(7, 2)); // odd row
  });

  await test("workbook leaks no workflow, comment or managing-partner data", () => {
    const forbidden = [
      "COMPLETED", "APPROVED", "PENDING", "REVERT", "Managing Partner",
      "Promotion", "promotion", "training", "Consistently strong", "Proud of",
      "self-assessment", "evidence", "Submission", "workflow", "Advanced leadership",
    ];
    for (const sheet of workbook.worksheets) {
      sheet.eachRow((row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          const text = typeof cell.value === "string" ? cell.value : "";
          for (const word of forbidden) {
            assert.ok(!text.includes(word), `forbidden "${word}" found on "${sheet.name}" cell ${cell.address}: "${text}"`);
          }
        });
      });
    }
  });

  const details = workbook.getWorksheet("PDR Rating Details")!;
  await test("rating details: section bands fit their merged spans", () => {
    const check = (sheet: ExcelJS.Worksheet, startCol: number, span: number, label: string) => {
      const mergedPx = Array.from({ length: span }, (_, i) => sheet.getColumn(startCol + i).width || 8.43)
        .reduce((sum, w) => sum + w * 7 + 5, 0);
      const longestLine = Math.max(...label.split("\n").map((line) => line.length));
      assert.ok(mergedPx >= longestLine * 6.4 + 8, `"${label}" clipped on "${sheet.name}"`);
    };
    check(details, 1, 4, "EMPLOYEE");
    check(details, 5, 3, "RATING ITEM");
    check(details, 8, 2, "RATINGS (1-7)");
  });

  await test("rating details sheet: 9 columns, header row, one row per item", () => {
    assert.equal(details.columnCount, 9);
    assert.equal(cellText(details, 3, 1), "EMPLOYEE");
    assert.equal(cellText(details, 3, 5), "RATING ITEM");
    assert.equal(cellText(details, 3, 8), "RATINGS (1-7)");
    assert.equal((details.getCell(3, 8).fill as any).fgColor.argb, "FF047857"); // emerald band
    assert.equal(cellText(details, 4, 7), "Item");
    assert.equal(cellText(details, 4, 8), "Employee Rating");
    assert.equal(cellText(details, 4, 9), "Manager Rating");
    assert.equal(details.views[0].xSplit, 2);
    assert.equal(details.views[0].ySplit, 4);
    assert.deepEqual(details.autoFilter, { from: { row: 4, column: 1 }, to: { row: 4, column: 9 } });
    // Alice 13 factors + 7 goals, Ben 2026 13 + 2, Ben 2025 13 + 1 = 49 item rows
    assert.equal(cellText(details, 53, 1), "IC-EMP002");
    assert.equal(cellText(details, 54, 1), "");
  });

  await test("rating details: part chips tinted, PDR blocks separated", () => {
    // Part 1 rows — indigo chip; Part 2 rows — teal chip
    assert.equal((details.getCell(5, 5).fill as any).fgColor.argb, "FFC7D2FE");
    assert.equal((details.getCell(5, 5).font as any).color.argb, "FF312E81");
    assert.equal((details.getCell(18, 5).fill as any).fgColor.argb, "FF99F6E4");
    assert.equal((details.getCell(18, 5).font as any).color.argb, "FF115E59");
    // every PDR block starts with a stronger top border
    assert.equal((details.getCell(5, 1).border as any).top.style, "medium");
    assert.equal((details.getCell(25, 1).border as any).top.style, "medium");
    assert.equal((details.getCell(40, 1).border as any).top.style, "medium");
    assert.equal((details.getCell(6, 1).border as any).top.style, "hair");
  });

  await test("rating details: all 13 actual Part 1 factor names with both ratings", () => {
    for (let i = 0; i < PDR_PERFORMANCE_FACTORS.length; i++) {
      const row = 5 + i;
      assert.equal(cellText(details, row, 5), "Part 1");
      assert.equal(cellNumber(details, row, 6), i + 1);
      assert.equal(cellText(details, row, 7), PDR_PERFORMANCE_FACTORS[i].name);
    }
    // Alice row 1: employee 5 (mid tone), manager 6 (high tone)
    assert.equal(cellNumber(details, 5, 8), 5);
    assert.equal(cellNumber(details, 5, 9), 6);
    assert.equal((details.getCell(5, 8).fill as any).fgColor.argb, "FFFEF9C3");
    assert.equal((details.getCell(5, 9).fill as any).fgColor.argb, "FFDCFCE7");
  });

  await test("rating details: goals rows use the actual task names", () => {
    // Alice goals: rows 18-24
    const aliceGoalRow = 5 + PDR_PERFORMANCE_FACTORS.length; // 18
    assert.equal(cellText(details, aliceGoalRow, 5), "Part 2");
    assert.equal(cellText(details, aliceGoalRow, 7), "Deliver API migration");
    assert.equal(cellNumber(details, aliceGoalRow, 8), 6);
    assert.equal(cellNumber(details, aliceGoalRow, 9), 6);
    assert.equal(cellText(details, aliceGoalRow + 6, 7), "Hiring support");
    assert.equal(cellNumber(details, aliceGoalRow + 6, 9), 7);
    // Ben 2026 goals: rows 38-39 — manager rating still empty ("—")
    const benGoalRow = 25 + PDR_PERFORMANCE_FACTORS.length; // 38
    assert.equal(cellText(details, benGoalRow, 4), "Annual Review 2026");
    assert.equal(cellText(details, benGoalRow, 7), "First-response SLA");
    assert.equal(cellNumber(details, benGoalRow, 8), 5);
    assert.equal(cellText(details, benGoalRow, 9), "—");
  });

  await test("rating details: each PDR stays a separate block per employee/cycle", () => {
    assert.equal(cellText(details, 5, 2), "Alice Khan");
    assert.equal(cellText(details, 24, 2), "Alice Khan");
    assert.equal(cellText(details, 25, 2), "Ben Raza");
    assert.equal(cellText(details, 25, 4), "Annual Review 2026");
    assert.equal(cellText(details, 39, 2), "Ben Raza");
    assert.equal(cellText(details, 40, 4), "Annual Review 2025");
    // Ben's manager rating column is empty throughout Part 1
    assert.equal(cellText(details, 25, 9), "—");
  });

  const scale = workbook.getWorksheet("Rating Scale")!;
  await test("rating scale sheet: 1-7 scale, bands and calculation method", () => {
    const rows: [string, string][] = [];
    scale.eachRow((row) => {
      const label = cellText(scale, row.number, 1);
      const value = cellText(scale, row.number, 2);
      if (label || value) rows.push([label, value]);
    });
    // full 1-7 scale with the app labels
    assert.ok(rows.some(([l, v]) => l === "7" && v === "Outstanding"));
    assert.ok(rows.some(([l, v]) => l === "1" && v === "Unsatisfactory"));
    assert.ok(rows.some(([l, v]) => l === "4" && v === "Good"));
    // all seven bands present with ranges
    assert.ok(rows.some(([l, v]) => l === "Outstanding" && v.includes("90")));
    assert.ok(rows.some(([l, v]) => l === "Unsatisfactory" && v.includes("Below 25")));
    assert.ok(rows.some(([l, v]) => l === "Needs Improvement" && v.includes("25")));
    // method references the real weights
    assert.ok(rows.some(([l, v]) => l.includes("Part 1") && v.includes("91") && v.includes("30")));
    assert.ok(rows.some(([l, v]) => l.includes("Part 2") && v.includes("70")));
  });

  console.log("\nRound-trip integrity");
  const buffer = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer as ArrayBuffer);
  await test("written .xlsx reloads with identical sheets and values", () => {
    assert.deepEqual(reloaded.worksheets.map((s) => s.name), [
      "PDR Performance Results",
      "PDR Rating Details",
      "Rating Scale",
    ]);
    const r = reloaded.getWorksheet("PDR Performance Results")!;
    // frozen panes survive serialization with the correct scroll origin
    assert.equal(r.views[0].xSplit, 2);
    assert.equal(r.views[0].ySplit, 4);
    assert.equal(r.views[0].topLeftCell, "C5");
    assert.equal(cellText(r, 5, 2), "Alice Khan");
    assert.equal(cellNumber(r, 5, 16), ALICE_EXPECTED.combinedOverall);
    assert.equal(cellText(r, 5, 18), "Excellent");
    assert.equal(cellNumber(r, 6, 10), BEN_EXPECTED.employeeOverall);
    const d = reloaded.getWorksheet("PDR Rating Details")!;
    assert.equal(cellText(d, 5, 7), "Communication Skills");
    assert.equal(cellNumber(d, 5, 9), 6);
  });

  // keep a sample file on disk for manual inspection
  fs.mkdirSync(os.tmpdir(), { recursive: true });

  console.log(failures === 0 ? "\nAll workbook tests passed." : `\n${failures} test(s) FAILED.`);
  if (failures > 0) process.exitCode = 1;
}

main();
