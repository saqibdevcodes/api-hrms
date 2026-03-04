"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketManager = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = require("http");
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const zktecoRoutes_1 = __importDefault(require("./routes/zktecoRoutes"));
const socketManager_1 = require("./socket/socketManager");
const finalizationService_1 = require("./services/finalizationService");
// Validate environment configuration
try {
    (0, env_1.validateConfig)();
}
catch (error) {
    console.error("❌ Environment validation failed:", error);
    process.exit(1);
}
const app = (0, express_1.default)();
// Trust proxy (important for rate limiting and IP detection)
app.set("trust proxy", 1);
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin images
}));
// CORS configuration
app.use((0, cors_1.default)({
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
        "Cache-Control",
        "Pragma",
        "Expires",
    ],
    exposedHeaders: ["Cache-Control", "Pragma", "Expires"],
}));
// Create uploads directory for local storage (only if Cloudinary not configured)
// Skip in serverless environments (Vercel) as filesystem is read-only
const isCloudinaryConfigured = env_1.config.CLOUDINARY_CLOUD_NAME &&
    env_1.config.CLOUDINARY_API_KEY &&
    env_1.config.CLOUDINARY_API_SECRET;
const isVercel = process.env.VERCEL === "1";
if (!isCloudinaryConfigured && !isVercel) {
    try {
        const uploadsDir = path_1.default.join(process.cwd(), "uploads");
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            console.log("✅ Created local uploads directory");
        }
        // Serve static files from uploads directory with CORS headers
        app.use("/uploads", (req, res, next) => {
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
            res.setHeader("Access-Control-Allow-Origin", "*");
            next();
        }, express_1.default.static(uploadsDir));
    }
    catch (error) {
        console.warn("⚠️  Could not create uploads directory:", error);
    }
}
else if (isCloudinaryConfigured) {
    console.log("✅ Using Cloudinary for file storage (no local uploads directory needed)");
}
// Global rate limiting
const globalRateLimit = (0, express_rate_limit_1.default)({
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
app.use("/iclock", express_1.default.raw({
    type: "*/*",
    limit: "10mb",
}));
app.use("/api/v1/zkteco/iclock", express_1.default.raw({
    type: "*/*",
    limit: "10mb",
}));
// Body parsing middleware
app.use(express_1.default.json({
    limit: "10mb",
    strict: true,
}));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: "10mb",
}));
// Cookie parsing middleware
app.use((0, cookie_parser_1.default)(env_1.config.COOKIE_SECRET));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});
// iClock routes at root level for ZKTeco device communication
app.use("/iclock", zktecoRoutes_1.default);
// API routes
app.use(env_1.config.API_PREFIX, routes_1.default);
// Root endpoint
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to Iris Communications HRMS API",
        data: {
            company: env_1.config.COMPANY_NAME,
            version: "1.0.0",
            environment: env_1.config.NODE_ENV,
            timestamp: new Date().toISOString(),
            endpoints: {
                health: `${env_1.config.API_PREFIX}/auth/health`,
                login: `${env_1.config.API_PREFIX}/auth/login`,
                dashboard: `${env_1.config.API_PREFIX}/dashboard`,
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
            environment: env_1.config.NODE_ENV,
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
                `${env_1.config.API_PREFIX}/auth/login`,
                `${env_1.config.API_PREFIX}/auth/logout`,
                `${env_1.config.API_PREFIX}/auth/refresh`,
                `${env_1.config.API_PREFIX}/auth/profile`,
                `${env_1.config.API_PREFIX}/dashboard`,
                `${env_1.config.API_PREFIX}/company/info`,
                `${env_1.config.API_PREFIX}/employees`,
                `${env_1.config.API_PREFIX}/advanceSalary`,
            ],
        },
        meta: {
            timestamp: new Date().toISOString(),
        },
    });
});
// Global error handler
app.use((error, req, res, next) => {
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
        ...(env_1.config.NODE_ENV === "development" && { stack: error.stack }),
        meta: {
            timestamp: new Date().toISOString(),
        },
    });
});
// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    try {
        console.log("✅ Database disconnected successfully");
        process.exit(0);
    }
    catch (error) {
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
let socketManager;
// Start server
const startServer = async () => {
    try {
        // Connect to database
        // Create HTTP server
        const httpServer = (0, http_1.createServer)(app);
        // Initialize Socket.IO
        socketManager = new socketManager_1.SocketManager(httpServer);
        // Start HTTP server
        httpServer.listen(env_1.config.PORT, () => {
            console.log("");
            console.log("🎉 ======================================");
            console.log(`🏢 ${env_1.config.COMPANY_NAME} HRMS API`);
            console.log("🎉 ======================================");
            console.log(`🚀 Server running on port ${env_1.config.PORT}`);
            console.log(`🌍 Environment: ${env_1.config.NODE_ENV}`);
            console.log(`📍 Base URL: http://localhost:${env_1.config.PORT}`);
            console.log(`🔗 API Base: http://localhost:${env_1.config.PORT}${env_1.config.API_PREFIX}`);
            console.log(`🏥 Health Check: http://localhost:${env_1.config.PORT}/health`);
            console.log(`🔔 Socket.IO: Notifications enabled`);
            console.log(`🏭 ZKTeco: iClock HTTP Server running on port 3000`);
            console.log("🎉 ======================================");
            console.log("");
            console.log("📋 Available Demo Credentials:");
            console.log("👤 Admin: admin@iris-communications.com / admin123");
            console.log("👥 HR: hr@iris-communications.com / hr123123");
            console.log("");
            // Schedule automatic attendance finalization (runs daily at 2 AM)
            // This automatically finalizes staging records that are 3+ days old
            node_cron_1.default.schedule("0 2 * * *", async () => {
                console.log("");
                console.log("🕐 ======================================");
                console.log("🔄 Running Automatic Attendance Finalization");
                console.log(`⏰ Time: ${new Date().toISOString()}`);
                console.log("🕐 ======================================");
                try {
                    const result = await finalizationService_1.finalizationService.finalizeStagingRecords();
                    console.log("📊 Finalization Results:");
                    console.log(`✅ Success: ${result.success}`);
                    console.log(`📝 Finalized: ${result.finalized} records`);
                    console.log(`❌ Errors: ${result.errors} records`);
                    console.log("🕐 ======================================");
                }
                catch (error) {
                    console.error("❌ Automatic finalization failed:", error);
                    console.error("🕐 ======================================");
                }
            }, {
                timezone: "Asia/Karachi", // Adjust to your timezone
            });
            console.log("⏰ Automatic finalization scheduled: Daily at 2:00 AM (Asia/Karachi)");
            console.log("");
            // Schedule OTP cleanup (runs every 30 minutes)
            node_cron_1.default.schedule("*/30 * * * *", async () => {
                try {
                    const { AuthService } = await Promise.resolve().then(() => __importStar(require("./services/authService")));
                    AuthService.cleanupExpiredOTPs();
                    console.log("🧹 Expired OTPs cleaned up");
                }
                catch (error) {
                    console.error("❌ OTP cleanup failed:", error);
                }
            });
            console.log("🧹 OTP cleanup scheduled: Every 30 minutes");
            console.log("");
            // Run finalization immediately on server start to process any existing old records
            console.log("🔄 Running initial finalization check...");
            finalizationService_1.finalizationService
                .finalizeStagingRecords()
                .then((result) => {
                console.log(`✅ Initial finalization: ${result.finalized} records finalized, ${result.errors} errors`);
            })
                .catch((error) => {
                console.error("❌ Initial finalization failed:", error);
            });
        });
        // Server error handling
        httpServer.on("error", (error) => {
            if (error.code === "EADDRINUSE") {
                console.error(`❌ Port ${env_1.config.PORT} is already in use`);
            }
            else {
                console.error("❌ Server error:", error);
            }
            process.exit(1);
        });
    }
    catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};
// Export socket manager for use in controllers
const getSocketManager = () => socketManager;
exports.getSocketManager = getSocketManager;
// Export the Express app for Vercel serverless
exports.default = app;
// Initialize server only if not in Vercel environment
if (process.env.VERCEL !== "1") {
    startServer();
}
