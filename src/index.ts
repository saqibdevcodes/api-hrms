import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer } from "http";
import { config, validateConfig } from "./config/env";
import DatabaseConnection from "./config/database";
import router from "./routes";
import { SocketManager } from "./socket/socketManager";
import { zktecoService } from "./services/zktecoService";

// Validate environment configuration
try {
  validateConfig();
} catch (error) {
  console.error("❌ Environment validation failed:", error);
  process.exit(1);
}

const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://iriscommunications.com",
      "https://www.iriscommunications.com",
      "https://hr.iriscommunications.cloud",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Company",
    ],
  })
);

// Static file serving for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Global rate limiting
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalRateLimit);

// Raw body parsing for ZKTeco iClock routes
app.use(
  "/iclock",
  express.raw({
    type: "*/*",
    limit: "10mb",
  })
);
app.use(
  "/api/v1/zkteco/iclock",
  express.raw({
    type: "*/*",
    limit: "10mb",
  })
);

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    strict: true,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// Cookie parsing middleware
app.use(cookieParser(config.COOKIE_SECRET));

// Request logging middleware
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`
  );
  next();
});

// iClock routes at root level for ZKTeco device communication
app.use("/iclock", require("./routes/zktecoRoutes").default);

// API routes
app.use(config.API_PREFIX, router);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Iris Communications HRMS API",
    data: {
      company: config.COMPANY_NAME,
      version: "1.0.0",
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      endpoints: {
        health: `${config.API_PREFIX}/auth/health`,
        login: `${config.API_PREFIX}/auth/login`,
        dashboard: `${config.API_PREFIX}/dashboard`,
        documentation: "Coming soon",
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Iris Communications HRMS API is healthy",
    data: {
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      nodeVersion: process.version,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    data: {
      path: req.originalUrl,
      method: req.method,
      availableEndpoints: [
        `${config.API_PREFIX}/auth/login`,
        `${config.API_PREFIX}/auth/logout`,
        `${config.API_PREFIX}/auth/refresh`,
        `${config.API_PREFIX}/auth/profile`,
        `${config.API_PREFIX}/dashboard`,
        `${config.API_PREFIX}/company/info`,
        `${config.API_PREFIX}/employees`,
        `${config.API_PREFIX}/advanceSalary`,
      ],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error handler:", error);

    // Handle specific error types
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON in request body",
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        message: "Request body too large",
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Default error response
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
      ...(config.NODE_ENV === "development" && { stack: error.stack }),
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await DatabaseConnection.disconnect();
    console.log("✅ Database disconnected successfully");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Global socket manager instance
let socketManager: SocketManager;

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await DatabaseConnection.connect();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    socketManager = new SocketManager(httpServer);

    // Start HTTP server
    httpServer.listen(config.PORT, () => {
      console.log("");
      console.log("🎉 ======================================");
      console.log(`🏢 ${config.COMPANY_NAME} HRMS API`);
      console.log("🎉 ======================================");
      console.log(`🚀 Server running on port ${config.PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`📍 Base URL: http://localhost:${config.PORT}`);
      console.log(
        `🔗 API Base: http://localhost:${config.PORT}${config.API_PREFIX}`
      );
      console.log(`🏥 Health Check: http://localhost:${config.PORT}/health`);
      console.log(`🔔 Socket.IO: Notifications enabled`);
      console.log(`🏭 ZKTeco: iClock HTTP Server running on port 3001`);
      console.log("🎉 ======================================");
      console.log("");
      console.log("📋 Available Demo Credentials:");
      console.log("👤 Admin: admin@iris-communications.com / admin123");
      console.log("👥 HR: hr@iris-communications.com / hr123123");
      console.log("");
    });

    // Server error handling
    httpServer.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${config.PORT} is already in use`);
      } else {
        console.error("❌ Server error:", error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Export socket manager for use in controllers
export const getSocketManager = (): SocketManager => socketManager;

// Initialize database connection for Vercel serverless
if (process.env.VERCEL === "1") {
  // Connect to database in serverless environment
  DatabaseConnection.connect()
    .then(() => {
      console.log("✅ Database connected for Vercel serverless");
    })
    .catch((error) => {
      console.error("❌ Database connection failed:", error);
    });
}

// Export the Express app for Vercel serverless
export default app;

// Initialize server only if not in Vercel environment
if (process.env.VERCEL !== "1") {
  startServer();
}
