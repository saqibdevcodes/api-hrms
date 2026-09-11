// tests/pdr-calculation-parity.test.ts
//
// Parity test: the ORIGINAL inline formulas from PerformanceTable.vue /
// GoalsList.vue / PDRSummaryCard.vue (copied verbatim below as the reference
// implementation) must produce identical results to:
//   - the shared frontend module  (hrms/src/utils/pdrCalculations.ts)
//   - the shared backend module   (api-hrms/src/utils/pdrCalculations.ts)
//
//   npx tsx tests/pdr-calculation-parity.test.ts

import assert from "node:assert/strict";

// Frontend shared module (TS, no Vue dependencies — safe to import directly)
import {
  calculateQualitySectionScores as feQuality,
  calculateGoalsSectionScores as feGoals,
  getPerformanceRating as feBand,
  getRatingLabel as feRatingLabel,
} from "../../hrms/src/utils/pdrCalculations";

// Backend shared module
import {
  calculatePdrResults as beResults,
  getPerformanceBand as beBand,
  getRatingLabel as beRatingLabel,
} from "../src/utils/pdrCalculations";

// ─── Reference implementation: original component code (verbatim) ────────────

const isFilledRating = (value: number | string | null | undefined) =>
  value !== "" && value !== null && value !== undefined;

/** Original PerformanceTable.vue computeds (weight 30, 13 fixed factors). */
function refPerformance(ratings: { employeeRating: any; managerRating: any }[]) {
  const maxScore = 13 * 7;
  const employeeTotalScore = ratings.reduce(
    (sum, r) => sum + (Number(r.employeeRating) || 0),
    0,
  );
  const employeePercentage = (employeeTotalScore / maxScore) * 100;
  const employeeWeightedScore = (employeeTotalScore / maxScore) * 30;
  const hasManagerRatings = ratings.some((r) => isFilledRating(r.managerRating));
  const managerTotalScore = ratings.reduce(
    (sum, r) => sum + (Number(r.managerRating) || 0),
    0,
  );
  const managerPercentage = (managerTotalScore / maxScore) * 100;
  const managerWeightedScore = (managerTotalScore / maxScore) * 30;
  const combinedPercentage = hasManagerRatings
    ? ((employeeTotalScore + managerTotalScore) / (maxScore * 2)) * 100
    : 0;
  const combinedWeightedScore = hasManagerRatings
    ? (combinedPercentage / 100) * 30
    : 0;
  return {
    maxScore,
    employeeTotalScore,
    employeePercentage,
    employeeWeightedScore,
    hasManagerRatings,
    managerTotalScore,
    managerPercentage,
    managerWeightedScore,
    combinedPercentage,
    combinedWeightedScore,
  };
}

/** Original GoalsList.vue computeds (weight 70, dynamic goal count; 0 loads as empty). */
function refGoals(goals: { employeeRating: any; managerRating: any }[]) {
  const maxScore = goals.length * 7;
  const employeeTotalScore = goals.reduce(
    (sum, g) => sum + (Number(g.employeeRating) || 0),
    0,
  );
  const employeePercentage = maxScore > 0 ? (employeeTotalScore / maxScore) * 100 : 0;
  const employeeWeightedScore = maxScore > 0 ? (employeeTotalScore / maxScore) * 70 : 0;
  const hasManagerRatings = goals.some((g) => isFilledRating(g.managerRating));
  const managerTotalScore = goals.reduce(
    (sum, g) => sum + (Number(g.managerRating) || 0),
    0,
  );
  const managerPercentage = maxScore > 0 ? (managerTotalScore / maxScore) * 100 : 0;
  const managerWeightedScore = maxScore > 0 ? (managerTotalScore / maxScore) * 70 : 0;
  const combinedPercentage =
    hasManagerRatings && maxScore > 0
      ? ((employeeTotalScore + managerTotalScore) / (maxScore * 2)) * 100
      : 0;
  const combinedWeightedScore = hasManagerRatings
    ? (combinedPercentage / 100) * 70
    : 0;
  return {
    maxScore,
    employeeTotalScore,
    employeePercentage,
    employeeWeightedScore,
    hasManagerRatings,
    managerTotalScore,
    managerPercentage,
    managerWeightedScore,
    combinedPercentage,
    combinedWeightedScore,
  };
}

/** Original PDRSummaryCard.vue performance rating. */
function refPerformanceRating(score: number) {
  if (score >= 90) return "Outstanding";
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 50) return "Good";
  if (score >= 40) return "Satisfactory";
  if (score >= 25) return "Needs Improvement";
  return "Unsatisfactory";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function close(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

const RATING_FIELDS = [
  "communication", "innovation", "work_ethics", "teamwork", "maturity",
  "initiative", "self_management", "customer_focus", "sense_of_responsibilities",
  "accountability", "work_knowledge", "attendance", "leadership",
];

function randomScenario(rng: () => number) {
  const roll = () => {
    // Ratings 1-7, or empty (""), or 0 (backend default when never rated)
    const draw = rng();
    if (draw < 0.15) return "";
    if (draw < 0.3) return 0;
    return 1 + Math.floor(rng() * 7);
  };
  const employeeRatings = Array.from({ length: 13 }, roll);
  const managerRatings = Array.from({ length: 13 }, roll);
  const goalCount = 1 + Math.floor(rng() * 8);
  const goalEmployee = Array.from({ length: goalCount }, roll);
  const goalManager = Array.from({ length: goalCount }, roll);
  return { employeeRatings, managerRatings, goalEmployee, goalManager };
}

/** Convert a scenario to the PDR-shaped records the backend module consumes. */
function toBackendRecord(scenario: ReturnType<typeof randomScenario>, hasManagerRow: boolean) {
  const build = (fields: number[], employeeType: string) => {
    const row: any = { employee_type: employeeType, comment: "remarks", datetime: new Date() };
    RATING_FIELDS.forEach((field, index) => {
      row[field] = fields[index] === "" ? 0 : fields[index];
    });
    return row;
  };
  const personalQualities: any[] = [build(scenario.employeeRatings, "EMPLOYEE")];
  if (hasManagerRow) {
    personalQualities.push(build(scenario.managerRatings, "MANAGER"));
  }
  return {
    personalQualities,
    goalsTasks: scenario.goalEmployee.map((rating, index) => ({
      task: `Goal ${index + 1}`,
      employee_self_rating: rating === "" ? 0 : rating,
      // Manager goal ratings only exist once the manager has assessed
      linemanager_rating: hasManagerRow && scenario.goalManager[index] !== "" ? scenario.goalManager[index] : 0,
    })),
  };
}

// ─── Deterministic PRNG (mulberry32) so failures are reproducible ─────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Test ─────────────────────────────────────────────────────────────────────

let failures = 0;

async function main() {
  console.log("Calculation parity: original component formulas ↔ shared frontend ↔ shared backend");

  // The details page maps employee_type EMPLOYEE/MANAGER rows directly.
  // When a MANAGER quality row exists, ratings load as strings (incl. "0").
  // When absent, manager ratings stay "".
  const rng = mulberry32(20260911);
  let compared = 0;

  for (let i = 0; i < 500; i++) {
    const scenario = randomScenario(rng);
    const hasManagerRow = rng() < 0.7;

    // Frontend-shaped inputs (as produced by loadExistingData in PdrFill.vue)
    const feRatings = scenario.employeeRatings.map((rating, index) => ({
      employeeRating: String(rating),
      managerRating: hasManagerRow ? String(scenario.managerRatings[index]) : "",
    }));
    const feGoalInputs = scenario.goalEmployee.map((rating, index) => ({
      employeeRating: rating === "" ? "" : rating,
      managerRating:
        hasManagerRow && scenario.goalManager[index] !== "" && scenario.goalManager[index] !== 0
          ? scenario.goalManager[index]
          : "",
    }));

    const ref1 = refPerformance(feRatings);
    const ref2 = refGoals(feGoalInputs);

    // Frontend shared module
    const fe1 = feQuality(feRatings);
    const fe2 = feGoals(feGoalInputs);

    // Backend shared module
    const be = beResults(toBackendRecord(scenario, hasManagerRow));

    const sectionsEqual = (
      a: Record<string, number | boolean>,
      b: Record<string, number | boolean>,
    ) => Object.keys(a).every((key) => {
      const x = a[key];
      const y = b[key];
      return typeof x === "number" && typeof y === "number" ? close(x, y) : x === y;
    });

    if (!sectionsEqual(ref1 as any, fe1 as any)) {
      failures++;
      console.error(`  ✘ Part 1 mismatch (frontend) at scenario ${i}`, { ref1, fe1 });
      break;
    }
    if (!sectionsEqual(ref2 as any, fe2 as any)) {
      failures++;
      console.error(`  ✘ Part 2 mismatch (frontend) at scenario ${i}`, { ref2, fe2 });
      break;
    }
    if (!sectionsEqual(ref1 as any, be.part1 as any)) {
      failures++;
      console.error(`  ✘ Part 1 mismatch (backend) at scenario ${i}`, { ref1, be1: be.part1 });
      break;
    }
    if (!sectionsEqual(ref2 as any, be.part2 as any)) {
      failures++;
      console.error(`  ✘ Part 2 mismatch (backend) at scenario ${i}`, { ref2, be2: be.part2 });
      break;
    }

    // Overall scores
    const refEmployeeOverall = ref1.employeeWeightedScore + ref2.employeeWeightedScore;
    const refManagerOverall = ref1.managerWeightedScore + ref2.managerWeightedScore;
    const refCombinedOverall = ref1.combinedWeightedScore + ref2.combinedWeightedScore;

    if (
      !close(refEmployeeOverall, be.employeeOverallScore) ||
      !close(refManagerOverall, be.managerOverallScore) ||
      !close(refCombinedOverall, be.combinedOverallScore)
    ) {
      failures++;
      console.error(`  ✘ Overall mismatch at scenario ${i}`);
      break;
    }

    // Band labels (only when the page actually shows the combined result)
    if (ref1.hasManagerRatings || ref2.hasManagerRatings) {
      const refLabel = refPerformanceRating(refCombinedOverall);
      if (feBand(refCombinedOverall) !== refLabel || beBand(be.combinedOverallScore).label !== refLabel) {
        failures++;
        console.error(`  ✘ Band mismatch at scenario ${i}: ${refLabel}`);
        break;
      }
    }

    compared++;
  }

  assert.equal(failures, 0, "parity failures detected");
  console.log(`  ✔ 500 randomized scenarios identical across reference, frontend and backend (${compared} full comparisons)`);

  // Edge cases
  const emptyGoalBackend = beResults({ personalQualities: [], goalsTasks: [] });
  assert.equal(emptyGoalBackend.part2.maxScore, 0);
  assert.equal(emptyGoalBackend.part2.employeeWeightedScore, 0);
  assert.equal(emptyGoalBackend.combinedOverallScore, 0);

  const zeroOnlyManager = feQuality(
    Array.from({ length: 13 }, () => ({ employeeRating: "5", managerRating: "0" })),
  );
  // A stored manager row (even all zeros) counts as manager-rated — matches the page
  assert.equal(zeroOnlyManager.hasManagerRatings, true);
  assert.equal(zeroOnlyManager.managerWeightedScore, 0);

  const zeroGoalManager = feGoals([{ employeeRating: 5, managerRating: 0 }]);
  // Goal ratings of 0 load back as empty on the page
  assert.equal(zeroGoalManager.hasManagerRatings, false);

  // Rating labels identical on both sides
  for (const rating of [1, 2, 3, 4, 5, 6, 7]) {
    assert.equal(feRatingLabel(rating), beRatingLabel(rating));
  }
  console.log("  ✔ edge cases passed (empty PDR, zero-only manager row, 0 goal ratings, rating labels)");

  console.log(failures === 0 ? "\nParity test passed ✅" : "\nParity test failed ❌");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
