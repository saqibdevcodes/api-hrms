"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanController = void 0;
const prisma_1 = require("../lib/prisma");
class LoanController {
    static async createLoan(req, res) {
        try {
            console.log(req.body);
            const { employeeId, amount, tenure, reason } = req.body;
            const loan = await prisma_1.prisma.loan.create({
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
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
    static async getLoans(req, res) {
        try {
            const loans = await prisma_1.prisma.loan.findMany({});
            res.json(loans);
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
exports.LoanController = LoanController;
