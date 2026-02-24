"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_1 = require("../generated/prisma");
const extension_accelerate_1 = require("@prisma/extension-accelerate");
class DatabaseConnection {
    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new prisma_1.PrismaClient({
                log: process.env.NODE_ENV === "development"
                    ? ["query", "error", "warn"]
                    : ["error"],
                errorFormat: "pretty",
            }).$extends((0, extension_accelerate_1.withAccelerate)());
        }
        return DatabaseConnection.instance;
    }
    static async connect() {
        try {
            const prisma = DatabaseConnection.getInstance();
            await prisma.$connect();
            console.log("✅ Database connected successfully");
        }
        catch (error) {
            console.error("❌ Database connection failed:", error);
            process.exit(1);
        }
    }
    static async disconnect() {
        try {
            const prisma = DatabaseConnection.getInstance();
            await prisma.$disconnect();
            console.log("✅ Database disconnected successfully");
        }
        catch (error) {
            console.error("❌ Database disconnection failed:", error);
        }
    }
    static async healthCheck() {
        try {
            const prisma = DatabaseConnection.getInstance();
            await prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch (error) {
            console.error("❌ Database health check failed:", error);
            return false;
        }
    }
}
exports.prisma = DatabaseConnection.getInstance();
exports.default = DatabaseConnection;
