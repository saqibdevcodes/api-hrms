// utils/pdrCalculations.ts
//
// Canonical PDR score calculations.
//
// The PDR details page (PdrFill.vue) renders these results through the shared
// computation helpers that live in `hrms/src/utils/pdrCalculations.ts`. Both
// modules implement the exact same formulas so an exported workbook always
// matches what users see on the PDR details page:
//
//   Part 1 — Personal Qualities/Values, weight 30/100
//     max score            = 13 factors × 7 = 91
//     percentage           = total / 91 × 100
//     weighted score       = total / 91 × 30
//     combined percentage  = (employee total + manager total) / (91 × 2) × 100
//
//   Part 2 — Goals & Tasks, weight 70/100
//     max score            = number of goals × 7
//     percentage           = total / max × 100
//     weighted score       = total / max × 70
//     combined percentage  = (employee total + manager total) / (max × 2) × 100
//
//   Overall
//     employee overall     = part1 employee weighted + part2 employee weighted (out of 100)
//     manager overall      = part1 manager weighted + part2 manager weighted  (out of 100)
//     combined overall %   = part1 combined weighted + part2 combined weighted (out of 100)
//     performance band     = getPerformanceBand(combined overall %)

export const PDR_PART1_WEIGHT = 30;
export const PDR_PART2_WEIGHT = 70;
export const PDR_RATING_MAX = 7;
export const PDR_QUALITY_FACTOR_COUNT = 13;
export const PDR_PART1_MAX_SCORE = PDR_QUALITY_FACTOR_COUNT * PDR_RATING_MAX; // 91

/** Part 1 factors in the exact order used by the PDR details page. */
export const PDR_PERFORMANCE_FACTORS: {
  field: string;
  name: string;
  description: string;
}[] = [
  { field: "communication", name: "Communication Skills", description: "Both Written & Oral Skills" },
  { field: "innovation", name: "Innovation", description: "Creative thinking and problem-solving" },
  { field: "work_ethics", name: "Work Ethics & Attitude", description: "Professional conduct and integrity" },
  { field: "teamwork", name: "Team Work", description: "Collaboration and cooperation" },
  { field: "maturity", name: "Maturity", description: "Emotional intelligence and composure" },
  { field: "initiative", name: "Initiative & Drive", description: "Proactive approach and motivation" },
  { field: "self_management", name: "Self Management", description: "Time management and organization" },
  { field: "customer_focus", name: "Customer Focus", description: "External/Internal customer service" },
  {
    field: "sense_of_responsibilities",
    name: "Sense of Responsibility",
    description: "Ownership and accountability",
  },
  { field: "accountability", name: "Accountability", description: "Taking responsibility for outcomes" },
  { field: "work_knowledge", name: "Work Knowledge", description: "Job-specific expertise and skills" },
  { field: "attendance", name: "Attendance & Punctuality", description: "Reliability and timeliness" },
  {
    field: "leadership",
    name: "Leadership & Management Skills",
    description: "If applicable to role",
  },
];

/** Rating label for the 1-7 scale (identical to the PDR details page). */
export function getRatingLabel(rating: number | null | undefined): string {
  if (rating === null || rating === undefined || Number.isNaN(Number(rating)) || Number(rating) <= 0) {
    return "";
  }
  const labels: Record<number, string> = {
    7: "Outstanding",
    6: "Excellent",
    5: "Very Good",
    4: "Good",
    3: "Satisfactory",
    2: "Needs Improvement",
    1: "Unsatisfactory",
  };
  return labels[Math.round(Number(rating))] || "";
}

export interface PdrSectionScores {
  maxScore: number;
  hasManagerRatings: boolean;
  employeeTotalScore: number;
  employeePercentage: number;
  employeeWeightedScore: number;
  managerTotalScore: number;
  managerPercentage: number;
  managerWeightedScore: number;
  combinedPercentage: number;
  combinedWeightedScore: number;
}

/**
 * Section scoring engine shared by Part 1 and Part 2.
 * Mirrors the computed properties of PerformanceTable.vue / GoalsList.vue.
 */
export function calculateSectionScores(
  items: { employeeRating: number | null; managerRating: number | null }[],
  weight: number,
): PdrSectionScores {
  const maxScore = items.length * PDR_RATING_MAX;

  const employeeTotalScore = items.reduce(
    (sum, item) => sum + (Number(item.employeeRating) || 0),
    0,
  );

  // "Filled" mirrors the details page: Part 1 counts any persisted manager
  // record (even a 0), while Part 2 loads a 0 rating back as empty (null).
  const hasManagerRatings = items.some(
    (item) => item.managerRating !== null && item.managerRating !== undefined,
  );

  const managerTotalScore = items.reduce(
    (sum, item) => sum + (Number(item.managerRating) || 0),
    0,
  );

  const employeePercentage = maxScore > 0 ? (employeeTotalScore / maxScore) * 100 : 0;
  const employeeWeightedScore = maxScore > 0 ? (employeeTotalScore / maxScore) * weight : 0;
  const managerPercentage = maxScore > 0 ? (managerTotalScore / maxScore) * 100 : 0;
  const managerWeightedScore = maxScore > 0 ? (managerTotalScore / maxScore) * weight : 0;

  const combinedPercentage =
    hasManagerRatings && maxScore > 0
      ? ((employeeTotalScore + managerTotalScore) / (maxScore * 2)) * 100
      : 0;
  const combinedWeightedScore = hasManagerRatings ? (combinedPercentage / 100) * weight : 0;

  return {
    maxScore,
    hasManagerRatings,
    employeeTotalScore,
    employeePercentage,
    employeeWeightedScore,
    managerTotalScore,
    managerPercentage,
    managerWeightedScore,
    combinedPercentage,
    combinedWeightedScore,
  };
}

export interface PdrPerformanceBand {
  label: string;
  range: string;
}

/** Performance bands from the PDR details page (RatingScaleDialog / PDRSummaryCard). */
export function getPerformanceBand(score: number): PdrPerformanceBand {
  if (score >= 90) return { label: "Outstanding", range: "90 - 100" };
  if (score >= 75) return { label: "Excellent", range: "75 - 89.99" };
  if (score >= 60) return { label: "Very Good", range: "60 - 74.99" };
  if (score >= 50) return { label: "Good", range: "50 - 59.99" };
  if (score >= 40) return { label: "Satisfactory", range: "40 - 49.99" };
  if (score >= 25) return { label: "Needs Improvement", range: "25 - 39.99" };
  return { label: "Unsatisfactory", range: "Below 25" };
}

/** A single PDR with the raw records required for scoring. */
export interface PdrScorableRecord {
  personalQualities?: {
    employee_type: string;
    communication: number;
    innovation: number;
    work_ethics: number;
    teamwork: number;
    maturity: number;
    initiative: number;
    self_management: number;
    customer_focus: number;
    sense_of_responsibilities: number;
    accountability: number;
    work_knowledge: number;
    attendance: number;
    leadership: number;
    comment: string;
  }[];
  goalsTasks?: {
    task: string;
    employee_self_rating: number;
    linemanager_rating: number;
  }[];
}

export interface PdrComputedResult {
  part1: PdrSectionScores;
  part2: PdrSectionScores;
  employeeOverallScore: number;
  managerOverallScore: number;
  combinedOverallScore: number;
  performanceBand: PdrPerformanceBand;
}

/**
 * Computes every derived score for one PDR, exactly as displayed on the
 * PDR details page (PdrFill.vue -> PDRSummaryCard.vue).
 */
export function calculatePdrResults(pdr: PdrScorableRecord): PdrComputedResult {
  // The details page maps `employee_type === "EMPLOYEE"` to employee ratings
  // and `employee_type === "MANAGER"` to manager ratings.
  const employeeQuality = pdr.personalQualities?.find((pq) => pq.employee_type === "EMPLOYEE");
  const managerQuality = pdr.personalQualities?.find((pq) => pq.employee_type === "MANAGER");

  const part1Items = PDR_PERFORMANCE_FACTORS.map((factor) => ({
    employeeRating: employeeQuality ? Number((employeeQuality as any)[factor.field]) || 0 : null,
    managerRating: managerQuality ? Number((managerQuality as any)[factor.field]) || 0 : null,
  }));

  const part2Items = (pdr.goalsTasks || []).map((goal) => ({
    // The details page treats a 0 goal rating as "not rated".
    employeeRating: Number(goal.employee_self_rating) || null,
    managerRating: Number(goal.linemanager_rating) || null,
  }));

  const part1 = calculateSectionScores(part1Items, PDR_PART1_WEIGHT);
  const part2 = calculateSectionScores(part2Items, PDR_PART2_WEIGHT);

  const employeeOverallScore = part1.employeeWeightedScore + part2.employeeWeightedScore;
  const managerOverallScore = part1.managerWeightedScore + part2.managerWeightedScore;
  const combinedOverallScore = part1.combinedWeightedScore + part2.combinedWeightedScore;

  return {
    part1,
    part2,
    employeeOverallScore,
    managerOverallScore,
    combinedOverallScore,
    performanceBand: getPerformanceBand(combinedOverallScore),
  };
}
