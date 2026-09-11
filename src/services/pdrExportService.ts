// services/pdrExportService.ts
//
// HR/Admin PDR Excel export — concise HR performance report.
//
// Answers one question: "How did each employee perform in Part 1, Part 2
// and overall?" The workbook contains performance results only — no workflow
// phases, approvals, comments or other PDR process internals.
//
//   Sheet 1  PDR Results      — one row per PDR: employee info, Part 1/Part 2
//                               self scores, manager scores, overall result
//   Sheet 2  Rating Details   — one row per PDR × rating item with the
//                               employee self rating and manager rating
//   Sheet 3  Rating Scale     — the 1-7 scale, performance bands and formulas
//
// All scores come from `utils/pdrCalculations.ts`, the shared calculation
// module that reproduces the PDR details page formulas exactly.

import ExcelJS from "exceljs";
import { PdrOverallStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  PDR_PART1_MAX_SCORE,
  PDR_PART1_WEIGHT,
  PDR_PART2_WEIGHT,
  PDR_PERFORMANCE_FACTORS,
  PDR_RATING_MAX,
  calculatePdrResults,
  getRatingLabel,
} from "../utils/pdrCalculations";

const HR_LIKE_ROLES = ["HR", "ADMIN", "SUPERADMIN"];

export interface PdrExportFilters {
  /** Company IDs. Empty/omitted = all companies. */
  companyIds?: string[];
  /** Department names (matches the `user.department` value shown in the app). */
  departments?: string[];
  /** PdrCycle IDs; legacy records without pdrCycleId are matched by cycle name. */
  cycleIds?: number[];
  /** Explicit employee (user) IDs. Empty/omitted = everyone matching other filters. */
  userIds?: string[];
  /** PDR overall statuses (export scope filter only — not shown in the report). */
  statuses?: string[];
}

export interface PdrExportPreview {
  pdrCount: number;
  employeeCount: number;
  completedCount: number;
  /** Employee IDs with at least one matching PDR (for dependent UI filtering). */
  availableUserIds: string[];
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function getFullName(user?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!user) return "—";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || "—";
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── Filter validation + query building ──────────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()))];
}

function toIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
}

export function parseExportFilters(body: Record<string, unknown>): PdrExportFilters {
  const validStatuses = new Set<string>(Object.values(PdrOverallStatus));
  return {
    companyIds: toStringArray(body?.companyIds),
    departments: toStringArray(body?.departments),
    cycleIds: toIntArray(body?.cycleIds),
    userIds: toStringArray(body?.userIds),
    statuses: toStringArray(body?.statuses).filter((s) => validStatuses.has(s)),
  };
}

/**
 * Builds the Prisma WHERE clause for export/preview queries.
 * Cycle filtering also matches legacy PDR rows that carry only the cycle
 * name (`pdr.pdr_cycle`) without a `pdrCycleId` foreign key.
 */
async function buildExportWhereAsync(filters: PdrExportFilters): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = {};
  const AND: Record<string, unknown>[] = [];

  if (filters.companyIds?.length) {
    AND.push({ companyId: { in: filters.companyIds } });
  }

  if (filters.departments?.length) {
    AND.push({ user: { department: { in: filters.departments } } });
  }

  if (filters.cycleIds?.length) {
    const selectedCycles = await prisma.pdrCycle.findMany({
      where: { id: { in: filters.cycleIds } },
      select: { id: true, name: true },
    });
    const cycleIds = selectedCycles.map((c) => c.id);
    const cycleNames = selectedCycles.map((c) => c.name);
    AND.push({
      OR: [
        { pdrCycleId: { in: cycleIds } },
        { pdrCycleId: null, pdr_cycle: { in: cycleNames } },
      ],
    });
  }

  if (filters.userIds?.length) {
    AND.push({ userId: { in: filters.userIds } });
  }

  if (filters.statuses?.length) {
    AND.push({ overallStatus: { in: filters.statuses } });
  }

  if (AND.length) where.AND = AND;
  return where;
}

// ─── Preview (record counts for the export dialog) ───────────────────────────

export async function getExportPreview(filters: PdrExportFilters): Promise<PdrExportPreview> {
  const where = await buildExportWhereAsync(filters);

  const [pdrCount, completedCount, matchedUserIds] = await Promise.all([
    prisma.pdr.count({ where }),
    prisma.pdr.count({ where: { ...where, isCompleted: true } }),
    prisma.pdr.findMany({ where, select: { userId: true }, distinct: ["userId"] }),
  ]);

  const distinctUserIds = [...new Set(matchedUserIds.map((r) => r.userId))];

  return {
    pdrCount,
    employeeCount: distinctUserIds.length,
    completedCount,
    availableUserIds: distinctUserIds,
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

interface PdrExportRecord {
  id: number;
  pdr_cycle: string | null;
  pdrCycle: { id: number; name: string } | null;
  user: {
    id: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
    position: string | null;
    department: string | null;
  } | null;
  personalQualities: {
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
    comment: string; // present on the DB row; deliberately not rendered
  }[];
  goalsTasks: {
    id: number;
    task: string;
    employee_self_rating: number;
    linemanager_rating: number;
  }[];
}

/**
 * Loads every PDR matching the filters with only the fields the performance
 * report renders — one query, no workflow/comment relations.
 */
async function loadExportRecords(filters: PdrExportFilters): Promise<PdrExportRecord[]> {
  const where = await buildExportWhereAsync(filters);

  const records = await prisma.pdr.findMany({
    where,
    orderBy: [{ pdr_cycle: "asc" }, { user: { firstName: "asc" } }, { id: "asc" }],
    select: {
      id: true,
      pdr_cycle: true,
      pdrCycle: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          position: true,
          department: true,
        },
      },
      personalQualities: {
        orderBy: { datetime: "desc" },
        select: {
          employee_type: true,
          communication: true,
          innovation: true,
          work_ethics: true,
          teamwork: true,
          maturity: true,
          initiative: true,
          self_management: true,
          customer_focus: true,
          sense_of_responsibilities: true,
          accountability: true,
          work_knowledge: true,
          attendance: true,
          leadership: true,
        },
      },
      goalsTasks: {
        orderBy: [{ datetime: "desc" }, { id: "desc" }],
        select: {
          id: true,
          task: true,
          employee_self_rating: true,
          linemanager_rating: true,
        },
      },
    },
  });

  return records as unknown as PdrExportRecord[];
}

// ─── Workbook styling (premium corporate HR report) ──────────────────────────
//
// The report uses ONE restrained palette organised as section tones: each
// major section (Employee, Part 1, Part 2, Manager, Final Result) gets a
// saturated "band" colour for its section header, a light tint of the same
// hue for its column headers, and matching emphasis on its total cells.
// Color establishes hierarchy — it is never decoration.

const BRAND = {
  titleBg: "FF1E1B4B", // indigo-950 — report title band
  sectionBorder: "FF94A3B8", // slate-400 — section boundaries in data rows
  border: "FFE2E8F0", // hair borders inside the table
  separator: "FFFFFFFF", // crisp separators between coloured section bands
  zebra: "FFF8FAFC",
  subText: "FF64748B",
  white: "FFFFFFFF",
  dark: "FF1F2937",
  body: "FF334155",
};

type SectionTone = {
  /** Section header band — saturated fill with white bold text. */
  band: string;
  /** Column-header tint of the same hue. */
  header: string;
  /** Dark-on-light header text (readable on the tint). */
  headerText: string;
};

const TONES = {
  // Employee information — neutral slate (professional, colourless)
  neutral: { band: "FF475569", header: "FFE2E8F0", headerText: "FF334155" },
  // Part 1 employee self — indigo
  part1: { band: "FF4F46E5", header: "FFC7D2FE", headerText: "FF312E81" },
  empTotal: { band: "FF4338CA", header: "FFA5B4FC", headerText: "FF1E1B4B" },
  // Part 2 employee self — teal (complementary accent)
  part2: { band: "FF0D9488", header: "FF99F6E4", headerText: "FF115E59" },
  // Manager assessment — violet (distinct professional accent)
  manager: { band: "FF6D28D9", header: "FFDDD6FE", headerText: "FF5B21B6" },
  mgrTotal: { band: "FF5B21B6", header: "FFC4B5FD", headerText: "FF4C1D95" },
  // Final result — emerald: the strongest treatment on the sheet
  final: { band: "FF047857", header: "FFA7F3D0", headerText: "FF065F46" },
  finalResult: { band: "FF065F46", header: "FF6EE7B7", headerText: "FF022C22" },
} satisfies Record<string, SectionTone>;

/** Data-cell emphasis per section, echoing the header tints. */
const CELL_TONES = {
  empTotal: { fill: "FFE0E7FF", text: "FF312E81" }, // indigo-100
  mgrTotal: { fill: "FFEDE9FE", text: "FF4C1D95" }, // violet-100
  finalResult: { fill: "FFD1FAE5", text: "FF065F46" }, // emerald-100
  part1: { fill: "FFC7D2FE", text: "FF312E81" },
  part2: { fill: "FF99F6E4", text: "FF115E59" },
};

const RATING_FILLS = {
  high: { bg: "FFDCFCE7", text: "FF166534" }, // 6-7  (green)
  mid: { bg: "FFFEF9C3", text: "FF854D0E" }, // 4-5  (yellow)
  low: { bg: "FFFEE2E2", text: "FF991B1B" }, // 1-3  (red)
};

const BAND_FILLS: Record<string, { bg: string; text: string }> = {
  Outstanding: { bg: "FFD1FAE5", text: "FF065F46" },
  Excellent: { bg: "FFDCFCE7", text: "FF166534" },
  "Very Good": { bg: "FFECFCCB", text: "FF3F6212" },
  Good: { bg: "FFFEF9C3", text: "FF854D0E" },
  Satisfactory: { bg: "FFFEF3C7", text: "FF92400E" },
  "Needs Improvement": { bg: "FFFFEDD5", text: "FF9A3412" },
  Unsatisfactory: { bg: "FFFEE2E2", text: "FF991B1B" },
};

type SheetSpec = {
  /** In-sheet report title (row 1 masthead). */
  title: string;
  /** Worksheet tab name (defaults to `title`). */
  sheetName?: string;
  subtitle: string;
  /** Section bands: merged group headers above the column headers. */
  groups?: { label: string; span: number; tone: SectionTone }[];
  columns: { header: string; width: number; tone: SectionTone }[];
  /** Columns kept visible while scrolling horizontally (employee identity). */
  freezeCols?: number;
};

const SECTION_BORDER = { style: "medium", color: { argb: BRAND.sectionBorder } } as const;
const BAND_SEPARATOR = { style: "medium", color: { argb: BRAND.separator } } as const;
const HAIR_BORDER = { style: "hair", color: { argb: BRAND.border } } as const;

function setupSheet(workbook: ExcelJS.Workbook, spec: SheetSpec, dataStartRow: number): ExcelJS.Worksheet {
  const freezeCols = spec.freezeCols || 0;
  const sheet = workbook.addWorksheet(spec.sheetName || spec.title, {
    views: [{ state: "frozen", xSplit: freezeCols, ySplit: dataStartRow - 1 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      // Repeat the header rows on every printed page.
      printTitlesRow: `1:${dataStartRow - 1}`,
    },
  });

  const tableWidth = Math.max(spec.columns.length, 2);

  // Title band — the report masthead
  sheet.mergeCells(1, 1, 1, tableWidth);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = spec.title;
  titleCell.font = { bold: true, size: 16, color: { argb: BRAND.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.titleBg } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 30;

  // Subtitle band
  sheet.mergeCells(2, 1, 2, tableWidth);
  const subCell = sheet.getCell(2, 1);
  subCell.value = spec.subtitle;
  subCell.font = { size: 9, italic: true, color: { argb: "FFC7D2FE" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.titleBg } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(2).height = 16;

  let headerRow = 3;

  // Section bands — saturated, impossible to miss, white-on-colour with
  // crisp white separators so adjacent sections never bleed together.
  if (spec.groups && spec.groups.length) {
    let col = 1;
    for (const group of spec.groups) {
      const span = Math.max(1, group.span);
      if (span > 1) sheet.mergeCells(headerRow, col, headerRow, col + span - 1);
      const cell = sheet.getCell(headerRow, col);
      cell.value = group.label;
      cell.font = { bold: true, size: 10, color: { argb: BRAND.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: group.tone.band } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      for (let c = col; c < col + span; c++) {
        sheet.getCell(headerRow, c).border = {
          top: HAIR_BORDER,
          left: c === col ? BAND_SEPARATOR : HAIR_BORDER,
          bottom: HAIR_BORDER,
          right: c === col + span - 1 ? BAND_SEPARATOR : HAIR_BORDER,
        };
      }
      col += span;
    }
    // Two-line band labels (narrow sections) need room to breathe
    sheet.getRow(headerRow).height = 30;
    headerRow += 1;
  }

  // Column headers — a light tint of their section's hue with dark text
  spec.columns.forEach((column, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = column.header;
    cell.font = { bold: true, size: 9, color: { argb: column.tone.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: column.tone.header } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: HAIR_BORDER,
      left: HAIR_BORDER,
      bottom: SECTION_BORDER,
      right: HAIR_BORDER,
    };
    sheet.getColumn(index + 1).width = column.width;
  });
  sheet.getRow(headerRow).height = 30;

  // AutoFilter across the header row
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: sheet.columnCount },
  };

  return sheet;
}

function styleDataRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  options: { zebra?: boolean; sectionStarts?: number[]; lastCol?: boolean; topBorder?: boolean } = {},
) {
  const row = sheet.getRow(rowNumber);
  row.alignment = { vertical: "top" };
  const sectionStarts = new Set(options.sectionStarts || []);
  for (let c = 1; c <= sheet.columnCount; c++) {
    const cell = row.getCell(c);
    cell.font = { size: 9, color: { argb: BRAND.dark }, bold: cell.font?.bold || false };
    cell.border = {
      top: options.topBorder ? SECTION_BORDER : HAIR_BORDER,
      left: sectionStarts.has(c) ? SECTION_BORDER : HAIR_BORDER,
      bottom: HAIR_BORDER,
      right: options.lastCol && c === sheet.columnCount ? SECTION_BORDER : HAIR_BORDER,
    };
    if (options.zebra && (rowNumber % 2 === 0)) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.zebra } };
    }
  }
}

function applyRatingStyle(cell: ExcelJS.Cell, rating: number | null | undefined) {
  if (rating === null || rating === undefined || Number(rating) <= 0) return;
  const value = Number(rating);
  const tone = value >= 6 ? RATING_FILLS.high : value >= 4 ? RATING_FILLS.mid : RATING_FILLS.low;
  cell.font = { size: 10, bold: true, color: { argb: tone.text } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

/** Renders an empty rating slot as a subtle dash. */
function applyEmptyRatingStyle(cell: ExcelJS.Cell) {
  cell.value = "—";
  cell.font = { size: 9, italic: true, color: { argb: BRAND.subText } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function applyBandStyle(cell: ExcelJS.Cell, bandLabel: string, size = 9) {
  const tone = BAND_FILLS[bandLabel];
  if (!tone) return;
  cell.font = { size, bold: true, color: { argb: tone.text } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tone.bg } };
}

const SCORE_FMT = "0.00";
const PCT_FMT = "0.00%"; // percentages as displayed on the PDR details page

// ─── Shared score computation for one record ─────────────────────────────────

interface RecordScores {
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  cycle: string;
  result: ReturnType<typeof calculatePdrResults>;
  hasManager: boolean;
}

function computeScores(record: PdrExportRecord): RecordScores {
  const result = calculatePdrResults(record);
  return {
    employeeId: record.user?.employeeId || "—",
    employeeName: getFullName(record.user),
    department: record.user?.department || "—",
    designation: record.user?.position || "—",
    cycle: record.pdrCycle?.name || record.pdr_cycle || "—",
    result,
    hasManager: result.part1.hasManagerRatings || result.part2.hasManagerRatings,
  };
}

// ─── Sheet 1 — PDR Results (one row per PDR) ─────────────────────────────────

function buildResultsSheet(
  workbook: ExcelJS.Workbook,
  records: PdrExportRecord[],
  generatedBy: string,
  generatedAt: Date,
): void {
  const spec: SheetSpec = {
    title: "PDR Performance Report",
    sheetName: "PDR Performance Results",
    subtitle: `Employee Performance Development Review • Part 1 — Personal Qualities (${PDR_PART1_WEIGHT}%) • Part 2 — Goals & Tasks (${PDR_PART2_WEIGHT}%) • Scores exactly as shown on the PDR details page • ${records.length} record${records.length === 1 ? "" : "s"} • Generated ${formatDate(generatedAt)} by ${generatedBy}`,
    freezeCols: 2,
    // Band labels use explicit line breaks sized to their merged span so no
    // heading is ever clipped (see the no-clipping test in the workbook suite).
    groups: [
      { label: "EMPLOYEE INFORMATION", span: 5, tone: TONES.neutral },
      { label: `PART 1 — EMPLOYEE\nSELF (OF ${PDR_PART1_WEIGHT})`, span: 2, tone: TONES.part1 },
      { label: `PART 2 — EMPLOYEE\nSELF (OF ${PDR_PART2_WEIGHT})`, span: 2, tone: TONES.part2 },
      { label: "EMPLOYEE\nTOTAL", span: 1, tone: TONES.empTotal },
      { label: `PART 1 — MANAGER\n(OF ${PDR_PART1_WEIGHT})`, span: 2, tone: TONES.manager },
      { label: `PART 2 — MANAGER\n(OF ${PDR_PART2_WEIGHT})`, span: 2, tone: TONES.manager },
      { label: "MANAGER\nTOTAL", span: 1, tone: TONES.mgrTotal },
      { label: "FINAL RESULT", span: 3, tone: TONES.finalResult },
    ],
    columns: [
      { header: "Employee ID", width: 13, tone: TONES.neutral },
      { header: "Employee Name", width: 22, tone: TONES.neutral },
      { header: "Department", width: 16, tone: TONES.neutral },
      { header: "Designation", width: 20, tone: TONES.neutral },
      { header: "PDR Cycle", width: 18, tone: TONES.neutral },
      { header: "Score", width: 9, tone: TONES.part1 },
      { header: "%", width: 9, tone: TONES.part1 },
      { header: "Score", width: 9, tone: TONES.part2 },
      { header: "%", width: 9, tone: TONES.part2 },
      { header: "Employee Total (/100)", width: 13, tone: TONES.empTotal },
      { header: "Score", width: 9, tone: TONES.manager },
      { header: "%", width: 9, tone: TONES.manager },
      { header: "Score", width: 9, tone: TONES.manager },
      { header: "%", width: 9, tone: TONES.manager },
      { header: "Manager Total (/100)", width: 13, tone: TONES.mgrTotal },
      { header: "Total Score (/100)", width: 11, tone: TONES.finalResult },
      { header: "Combined %", width: 11, tone: TONES.finalResult },
      { header: "Final Performance Rating", width: 21, tone: TONES.finalResult },
    ],
  };

  const sheet = setupSheet(workbook, spec, 5);
  // Columns where a new section starts — drawn as stronger vertical borders
  // through the data area so each section reads as one block.
  const sectionStartCols = [1, 6, 8, 10, 11, 13, 15, 16];

  records.forEach((record, index) => {
    const rowNumber = 5 + index;
    const scores = computeScores(record);
    const { result, hasManager } = scores;
    const row = sheet.getRow(rowNumber);

    row.getCell(1).value = scores.employeeId;
    row.getCell(2).value = scores.employeeName;
    row.getCell(3).value = scores.department;
    row.getCell(4).value = scores.designation;
    row.getCell(5).value = scores.cycle;

    // Employee self assessment
    row.getCell(6).value = round2(result.part1.employeeWeightedScore);
    row.getCell(7).value = round2(result.part1.employeePercentage) / 100;
    row.getCell(8).value = round2(result.part2.employeeWeightedScore);
    row.getCell(9).value = round2(result.part2.employeePercentage) / 100;
    row.getCell(10).value = round2(result.employeeOverallScore);

    if (hasManager) {
      row.getCell(11).value = round2(result.part1.managerWeightedScore);
      row.getCell(12).value = round2(result.part1.managerPercentage) / 100;
      row.getCell(13).value = round2(result.part2.managerWeightedScore);
      row.getCell(14).value = round2(result.part2.managerPercentage) / 100;
      row.getCell(15).value = round2(result.managerOverallScore);
      row.getCell(16).value = round2(result.combinedOverallScore);
      row.getCell(17).value = round2(result.combinedOverallScore) / 100;
      row.getCell(18).value = result.performanceBand.label;
    } else {
      // Manager assessment not started — final result pending.
      for (let c = 11; c <= 17; c++) row.getCell(c).value = null;
      row.getCell(18).value = "—";
    }

    // Number formats (percentages stored as fractions)
    [6, 8, 10, 11, 13, 15, 16].forEach((c) => (row.getCell(c).numFmt = SCORE_FMT));
    [7, 9, 12, 14, 17].forEach((c) => (row.getCell(c).numFmt = PCT_FMT));

    styleDataRow(sheet, rowNumber, { zebra: true, sectionStarts: sectionStartCols, lastCol: true });

    // Score cells read as numbers: centered under their section columns
    for (let c = 6; c <= 17; c++) {
      row.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    }

    // Total cells — tone-matched emphasis applied after base styling so it
    // survives zebra striping. Final-result cells carry the strongest fill.
    const empTotal = row.getCell(10);
    empTotal.font = { size: 10, bold: true, color: { argb: CELL_TONES.empTotal.text } };
    empTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CELL_TONES.empTotal.fill } };
    const mgrTotal = row.getCell(15);
    mgrTotal.font = { size: 10, bold: true, color: { argb: CELL_TONES.mgrTotal.text } };
    mgrTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CELL_TONES.mgrTotal.fill } };
    [16, 17].forEach((c) => {
      const cell = row.getCell(c);
      cell.font = { size: 10, bold: true, color: { argb: CELL_TONES.finalResult.text } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CELL_TONES.finalResult.fill } };
    });

    // The final rating — the single strongest cell on the sheet
    const ratingCell = row.getCell(18);
    if (hasManager) {
      applyBandStyle(ratingCell, result.performanceBand.label, 10);
      ratingCell.border = {
        top: SECTION_BORDER,
        bottom: SECTION_BORDER,
        left: SECTION_BORDER,
        right: SECTION_BORDER,
      };
    } else {
      ratingCell.font = { size: 10, italic: true, color: { argb: BRAND.subText } };
    }
    ratingCell.alignment = { horizontal: "center", vertical: "middle" };
  });
}

// ─── Sheet 2 — Rating Details (one row per PDR × item) ───────────────────────

function buildRatingDetailsSheet(workbook: ExcelJS.Workbook, records: PdrExportRecord[]): void {
  const spec: SheetSpec = {
    title: "PDR Rating Details",
    subtitle: `One row per rating item • All ${PDR_PERFORMANCE_FACTORS.length} Personal Quality factors (Part 1) and every goal (Part 2) with employee self and manager ratings (scale 1-${PDR_RATING_MAX})`,
    freezeCols: 2,
    groups: [
      { label: "EMPLOYEE", span: 4, tone: TONES.neutral },
      { label: "RATING ITEM", span: 3, tone: TONES.part1 },
      { label: `RATINGS (1-${PDR_RATING_MAX})`, span: 2, tone: TONES.final },
    ],
    columns: [
      { header: "Employee ID", width: 13, tone: TONES.neutral },
      { header: "Employee Name", width: 20, tone: TONES.neutral },
      { header: "Department", width: 15, tone: TONES.neutral },
      { header: "PDR Cycle", width: 16, tone: TONES.neutral },
      { header: "Part", width: 9, tone: TONES.part1 },
      { header: "#", width: 5, tone: TONES.part1 },
      { header: "Item", width: 50, tone: TONES.part1 },
      { header: "Employee Rating", width: 11, tone: TONES.final },
      { header: "Manager Rating", width: 11, tone: TONES.final },
    ],
  };

  const sheet = setupSheet(workbook, spec, 5);
  let rowNumber = 5;

  for (const record of records) {
    const blockStartRow = rowNumber; // first item row of this PDR
    const scores = computeScores(record);
    const employeeQuality = record.personalQualities.find((pq) => pq.employee_type === "EMPLOYEE");
    const managerQuality = record.personalQualities.find((pq) => pq.employee_type === "MANAGER");

    const writeRow = (
      part: string,
      itemNumber: number,
      item: string,
      employeeRating: number | null,
      managerRating: number | null,
    ) => {
      const row = sheet.getRow(rowNumber);
      row.getCell(1).value = scores.employeeId;
      row.getCell(2).value = scores.employeeName;
      row.getCell(3).value = scores.department;
      row.getCell(4).value = scores.cycle;
      row.getCell(5).value = part;
      row.getCell(6).value = itemNumber;
      row.getCell(7).value = item;

      if (employeeRating !== null && employeeRating > 0) {
        row.getCell(8).value = employeeRating;
      } else {
        applyEmptyRatingStyle(row.getCell(8));
      }
      if (managerRating !== null && managerRating > 0) {
        row.getCell(9).value = managerRating;
      } else {
        applyEmptyRatingStyle(row.getCell(9));
      }

      styleDataRow(sheet, rowNumber, {
        zebra: true,
        sectionStarts: [1, 5, 8],
        lastCol: true,
        topBorder: rowNumber === blockStartRow,
      });
      // Rating colors re-applied after base styling
      applyRatingStyle(row.getCell(8), employeeRating);
      applyRatingStyle(row.getCell(9), managerRating);
      // Part chip — tinted with the section's hue so Part 1 / Part 2 blocks
      // are recognisable at a glance while staying filter-friendly (no merge)
      const partCell = row.getCell(5);
      const partTone = part === "Part 1" ? CELL_TONES.part1 : CELL_TONES.part2;
      partCell.font = { size: 9, bold: true, color: { argb: partTone.text } };
      partCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: partTone.fill } };
      partCell.alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).alignment = { vertical: "middle", wrapText: true };
      row.getCell(7).font = { size: 9, color: { argb: BRAND.body } };
      rowNumber += 1;
    };

    // Part 1 — Personal Qualities (fixed factor list, same as the details page)
    PDR_PERFORMANCE_FACTORS.forEach((factor, index) => {
      const employeeRating = employeeQuality
        ? Number((employeeQuality as any)[factor.field]) || null
        : null;
      const managerRating = managerQuality
        ? Number((managerQuality as any)[factor.field]) || null
        : null;
      writeRow("Part 1", index + 1, factor.name, employeeRating, managerRating);
    });

    // Part 2 — Goals & Tasks (the PDR's own goals, same ordering as the page)
    record.goalsTasks.forEach((goal, index) => {
      writeRow(
        "Part 2",
        index + 1,
        goal.task,
        Number(goal.employee_self_rating) || null,
        Number(goal.linemanager_rating) || null,
      );
    });
  }
}

// ─── Sheet 3 — Rating Scale & Method ─────────────────────────────────────────

function buildRatingScaleSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("Rating Scale", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 74;

  const sections: { header: string; rows: [string, string][] }[] = [
    {
      header: `Rating Scale (1 - ${PDR_RATING_MAX})`,
      rows: Array.from({ length: PDR_RATING_MAX }, (_, i) => {
        const rating = PDR_RATING_MAX - i;
        return [String(rating), getRatingLabel(rating)] as [string, string];
      }),
    },
    {
      header: "Final Performance Bands (Combined Overall %)",
      rows: [
        ["Outstanding", "90 - 100"],
        ["Excellent", "75 - 89.99"],
        ["Very Good", "60 - 74.99"],
        ["Good", "50 - 59.99"],
        ["Satisfactory", "40 - 49.99"],
        ["Needs Improvement", "25 - 39.99"],
        ["Unsatisfactory", "Below 25"],
      ],
    },
    {
      header: "How Scores Are Calculated (identical to the PDR details page)",
      rows: [
        [
          "Part 1 — Personal Qualities (30%)",
          `Total = sum of the ${PDR_PERFORMANCE_FACTORS.length} factor ratings (max ${PDR_PART1_MAX_SCORE}). Score = Total / ${PDR_PART1_MAX_SCORE} × ${PDR_PART1_WEIGHT}.`,
        ],
        [
          "Part 2 — Goals & Tasks (70%)",
          `Total = sum of goal ratings (max = number of goals × ${PDR_RATING_MAX}). Score = Total / Max × ${PDR_PART2_WEIGHT}.`,
        ],
        [
          "Employee / Manager Overall",
          `Part 1 score + Part 2 score, each out of 100.`,
        ],
        [
          "Combined result",
          "Combined % = (Employee total + Manager total) / (2 × section max) × 100 per section; Combined Overall = Part 1 combined + Part 2 combined (out of 100).",
        ],
      ],
    },
  ];

  let rowNumber = 1;
  sheet.mergeCells(rowNumber, 1, rowNumber, 2);
  const titleCell = sheet.getCell(rowNumber, 1);
  titleCell.value = "Rating Scale & Calculation Method";
  titleCell.font = { bold: true, size: 16, color: { argb: BRAND.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.titleBg } };
  titleCell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(rowNumber).height = 30;
  rowNumber += 2;

  for (const section of sections) {
    sheet.mergeCells(rowNumber, 1, rowNumber, 2);
    const headerCell = sheet.getCell(rowNumber, 1);
    headerCell.value = section.header;
    headerCell.font = { bold: true, size: 10.5, color: { argb: BRAND.white } };
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONES.part1.band } };
    headerCell.alignment = { vertical: "middle", indent: 1 };
    sheet.getRow(rowNumber).height = 20;
    rowNumber += 1;

    for (const [label, value] of section.rows) {
      const labelCell = sheet.getCell(rowNumber, 1);
      labelCell.value = label;
      labelCell.font = { bold: true, size: 9.5, color: { argb: BRAND.dark } };
      labelCell.alignment = { vertical: "top", wrapText: true, indent: 1 };
      labelCell.border = {
        top: { style: "hair", color: { argb: BRAND.border } },
        bottom: { style: "hair", color: { argb: BRAND.border } },
        left: { style: "hair", color: { argb: BRAND.border } },
      };
      const valueCell = sheet.getCell(rowNumber, 2);
      valueCell.value = value;
      valueCell.font = { size: 9.5, color: { argb: BRAND.body } };
      valueCell.alignment = { vertical: "top", wrapText: true };
      valueCell.border = {
        top: { style: "hair", color: { argb: BRAND.border } },
        bottom: { style: "hair", color: { argb: BRAND.border } },
        right: { style: "hair", color: { argb: BRAND.border } },
      };
      rowNumber += 1;
    }
    rowNumber += 1; // blank spacer between sections
  }

  // Color-chip the band labels using the same tones as the results sheet
  sheet.eachRow((row) => {
    const label = row.getCell(1).value;
    if (typeof label === "string" && BAND_FILLS[label]) {
      applyBandStyle(row.getCell(1), label);
    }
  });
}

// ─── Public entry points ──────────────────────────────────────────────────────

export interface PdrExportFile {
  buffer: Buffer;
  filename: string;
  recordCount: number;
  employeeCount: number;
}

/**
 * Builds the workbook from already-loaded PDR records.
 * Kept separate from `generatePdrExport` so the Excel generation is
 * testable independently of the database.
 */
export async function buildPdrWorkbook(
  records: PdrExportRecord[],
  generatedBy: string,
  generatedAt: Date = new Date(),
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HRMS Portal";
  workbook.lastModifiedBy = "HRMS Portal";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  buildResultsSheet(workbook, records, generatedBy, generatedAt);
  buildRatingDetailsSheet(workbook, records);
  buildRatingScaleSheet(workbook);

  return workbook;
}

function buildExportFilename(records: PdrExportRecord[], generatedAt: Date): string {
  const datePart = generatedAt.toISOString().slice(0, 10);
  const cycles = [...new Set(records.map((r) => (r.pdrCycle?.name || r.pdr_cycle || "").trim()).filter(Boolean))];
  const contextPart =
    cycles.length === 1
      ? `_${cycles[0].replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60)}`
      : "";
  return `PDR_Export${contextPart}_${datePart}.xlsx`;
}

export async function generatePdrExport(
  filters: PdrExportFilters,
  generatedByName: string,
): Promise<PdrExportFile> {
  const records = await loadExportRecords(filters);

  if (records.length === 0) {
    const error: any = new Error(
      "No PDR records match the selected filters. Adjust the filters and try again.",
    );
    error.statusCode = 404;
    throw error;
  }

  const generatedAt = new Date();
  const workbook = await buildPdrWorkbook(records, generatedByName, generatedAt);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    buffer,
    filename: buildExportFilename(records, generatedAt),
    recordCount: records.length,
    employeeCount: new Set(records.map((r) => r.user?.id)).size,
  };
}
