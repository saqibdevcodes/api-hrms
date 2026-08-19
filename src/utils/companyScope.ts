import type { Response } from "express";
import { prisma } from "../lib/prisma";

export class CompanyScopeError extends Error {}

export const companyAssignmentInclude = {
  company: {
    select: {
      id: true,
      name: true,
      isDefault: true,
      isActive: true,
    },
  },
};

export function parseCompanyIds(value: unknown): string[] {
  let values: unknown[] = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      values = Array.isArray(parsed) ? parsed : value.split(",");
    } catch {
      values = value.split(",");
    }
  }

  return [
    ...new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export async function resolveActiveCompanyIds(
  value: unknown,
  options: { defaultWhenMissing?: boolean } = {},
): Promise<string[]> {
  let companyIds = parseCompanyIds(value);
  const isMissing = value === undefined || value === null || value === "";

  if (companyIds.length === 0 && options.defaultWhenMissing && isMissing) {
    const defaultCompany = await prisma.company.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });
    if (defaultCompany) companyIds = [defaultCompany.id];
  }

  if (companyIds.length === 0) {
    throw new CompanyScopeError("At least one active company is required");
  }

  const count = await prisma.company.count({
    where: { id: { in: companyIds }, isActive: true },
  });
  if (count !== companyIds.length) {
    throw new CompanyScopeError("One or more selected companies are invalid or inactive");
  }

  return companyIds;
}

export function respondToCompanyScopeError(error: unknown, res: Response): boolean {
  if (!(error instanceof CompanyScopeError)) return false;
  res.status(400).json({ success: false, message: error.message });
  return true;
}
