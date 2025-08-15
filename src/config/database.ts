import { PrismaClient } from "../generated/prisma";
import { withAccelerate } from "@prisma/extension-accelerate";

class DatabaseConnection {
  private static instance: any;

  public static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log:
          process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
        errorFormat: "pretty",
      }).$extends(withAccelerate());
    }

    return DatabaseConnection.instance;
  }

  public static async connect(): Promise<void> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$connect();
      console.log("✅ Database connected successfully");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      process.exit(1);
    }
  }

  public static async disconnect(): Promise<void> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$disconnect();
      console.log("✅ Database disconnected successfully");
    } catch (error) {
      console.error("❌ Database disconnection failed:", error);
    }
  }

  public static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseConnection.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("❌ Database health check failed:", error);
      return false;
    }
  }
}

export const prisma = DatabaseConnection.getInstance();
export default DatabaseConnection;
