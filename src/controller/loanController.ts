import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export class LoanController {
  static async createLoan(req: Request, res: Response) {
    try {
      console.log(req.body);

      const { employeeId, amount, tenure, reason } = req.body;
      const loan = await prisma.loan.create({
        data: {
          user: {
            connect: {
              id: employeeId,
            },
          },
          amount,
          reason,
          tenure,
          status: "PENDING",
        },
      });
      res.status(201).json(loan);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getLoans(req: Request, res: Response) {
    try {
      const loans = await prisma.loan.findMany({});
      res.json(loans);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
