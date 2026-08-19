import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const optionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

export class CompanyController {
  static async getAllCompanies(req: Request, res: Response) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const rawLimit = Number(req.query.limit) || 10;
      const isUnlimited = rawLimit === -1;
      const limit = isUnlimited ? undefined : Math.min(100, Math.max(1, rawLimit));
      const search = String(req.query.search || "").trim();
      const isActive = req.query.isActive;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { email: { contains: search } },
        ];
      }
      if (isActive !== undefined && isActive !== "") {
        where.isActive = isActive === "true";
      }

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          ...(limit !== undefined && { skip: (page - 1) * limit, take: limit }),
          include: {
            _count: {
              select: {
                employees: true,
                departments: true,
                contractTypes: true,
                shifts: true,
                leavePolicies: true,
                employmentTypes: true,
                pdrs: true,
              },
            },
          },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        }),
        prisma.company.count({ where }),
      ]);

      res.json({
        success: true,
        message: "Companies retrieved successfully",
        data: {
          companies,
          pagination: {
            page: isUnlimited ? 1 : page,
            limit: isUnlimited ? total : limit,
            total,
            pages: isUnlimited ? 1 : Math.max(1, Math.ceil(total / limit!)),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ success: false, message: "Failed to fetch companies" });
    }
  }

  static async getCompanyById(req: Request, res: Response) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: {
          employees: {
            orderBy: { assignedAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  employeeId: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  position: true,
                  department: true,
                  status: true,
                  isActive: true,
                },
              },
            },
          },
          departments: { include: { department: true }, orderBy: { assignedAt: "asc" } },
          contractTypes: { include: { contractType: true }, orderBy: { assignedAt: "asc" } },
          shifts: { include: { shift: true }, orderBy: { assignedAt: "asc" } },
          leavePolicies: { include: { leavePolicy: true }, orderBy: { assignedAt: "asc" } },
          employmentTypes: { include: { employmentType: true }, orderBy: { assignedAt: "asc" } },
          _count: { select: { employees: true, pdrs: true } },
        },
      });

      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      res.json({ success: true, data: { company } });
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ success: false, message: "Failed to fetch company" });
    }
  }

  static async getEmployeeOptions(req: Request, res: Response) {
    try {
      const search = String(req.query.search || "").trim();
      const companyId = String(req.query.companyId || "").trim();
      const where: any = { employeeId: { not: null } };

      if (search) {
        where.OR = [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { employeeId: { contains: search } },
          { email: { contains: search } },
          { department: { contains: search } },
        ];
      }

      const employees = await prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          department: true,
          status: true,
          isActive: true,
          companyMemberships: companyId
            ? { where: { companyId }, select: { companyId: true } }
            : { select: { companyId: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      });

      res.json({
        success: true,
        data: {
          employees: employees.map((employee) => ({
            ...employee,
            assigned: companyId
              ? employee.companyMemberships.some(
                  (membership) => membership.companyId === companyId,
                )
              : false,
          })),
        },
      });
    } catch (error) {
      console.error("Error fetching company employee options:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch employee options",
      });
    }
  }

  static async createCompany(req: Request, res: Response) {
    try {
      const name = String(req.body.name).trim();
      const existing = await prisma.company.findUnique({ where: { name } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "A company with this name already exists",
        });
      }

      const company = await prisma.company.create({
        data: {
          name,
          description: optionalString(req.body.description),
          email: optionalString(req.body.email),
          phone: optionalString(req.body.phone),
          website: optionalString(req.body.website),
          address: optionalString(req.body.address),
        },
        include: { _count: { select: { employees: true } } },
      });

      res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: { company },
      });
    } catch (error: any) {
      console.error("Error creating company:", error);
      res.status(error?.code === "P2002" ? 409 : 500).json({
        success: false,
        message:
          error?.code === "P2002"
            ? "A company with this name already exists"
            : "Failed to create company",
      });
    }
  }

  static async updateCompany(req: Request, res: Response) {
    try {
      const existing = await prisma.company.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      const name = req.body.name ? String(req.body.name).trim() : existing.name;
      if (name !== existing.name) {
        const conflict = await prisma.company.findUnique({ where: { name } });
        if (conflict) {
          return res.status(409).json({
            success: false,
            message: "A company with this name already exists",
          });
        }
      }

      if (existing.isDefault && req.body.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "The default company cannot be deactivated",
        });
      }

      const company = await prisma.company.update({
        where: { id: existing.id },
        data: {
          name,
          ...(req.body.description !== undefined && {
            description: optionalString(req.body.description),
          }),
          ...(req.body.email !== undefined && { email: optionalString(req.body.email) }),
          ...(req.body.phone !== undefined && { phone: optionalString(req.body.phone) }),
          ...(req.body.website !== undefined && {
            website: optionalString(req.body.website),
          }),
          ...(req.body.address !== undefined && {
            address: optionalString(req.body.address),
          }),
          ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
        },
        include: { _count: { select: { employees: true } } },
      });

      res.json({
        success: true,
        message: "Company updated successfully",
        data: { company },
      });
    } catch (error: any) {
      console.error("Error updating company:", error);
      res.status(error?.code === "P2002" ? 409 : 500).json({
        success: false,
        message:
          error?.code === "P2002"
            ? "A company with this name already exists"
            : "Failed to update company",
      });
    }
  }

  static async replaceCompanyEmployees(req: Request, res: Response) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
      });
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      const employeeIds = Array.from(new Set(req.body.employeeIds as string[]));
      const validEmployees = await prisma.user.findMany({
        where: { id: { in: employeeIds }, employeeId: { not: null } },
        select: { id: true },
      });

      if (validEmployees.length !== employeeIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more selected employees are invalid",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.companyEmployee.deleteMany({ where: { companyId: company.id } });
        if (employeeIds.length > 0) {
          await tx.companyEmployee.createMany({
            data: employeeIds.map((userId) => ({ companyId: company.id, userId })),
          });
        }
      });

      res.json({
        success: true,
        message: `${employeeIds.length} employee(s) assigned to ${company.name}`,
        data: { assignedCount: employeeIds.length },
      });
    } catch (error) {
      console.error("Error assigning company employees:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update company employees",
      });
    }
  }

  static async toggleCompanyStatus(req: Request, res: Response) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
      });
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }
      if (company.isDefault && company.isActive) {
        return res.status(400).json({
          success: false,
          message: "The default company cannot be deactivated",
        });
      }

      const updated = await prisma.company.update({
        where: { id: company.id },
        data: { isActive: !company.isActive },
        include: { _count: { select: { employees: true } } },
      });
      res.json({
        success: true,
        message: `Company ${updated.isActive ? "activated" : "deactivated"} successfully`,
        data: { company: updated },
      });
    } catch (error) {
      console.error("Error toggling company status:", error);
      res.status(500).json({ success: false, message: "Failed to update company status" });
    }
  }

  static async deleteCompany(req: Request, res: Response) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { pdrs: true } } },
      });
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }
      if (company.isDefault) {
        return res.status(400).json({
          success: false,
          message: "The default company cannot be deleted",
        });
      }
      if (company._count.pdrs > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete company while it has ${company._count.pdrs} PDR record(s)`,
        });
      }

      await prisma.company.delete({ where: { id: company.id } });
      res.json({
        success: true,
        message: "Company deleted; employee records were kept",
      });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ success: false, message: "Failed to delete company" });
    }
  }
}
