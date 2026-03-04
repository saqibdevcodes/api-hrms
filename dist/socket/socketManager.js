"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketManager = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
class SocketManager {
    constructor(httpServer) {
        this.connectedUsers = new Map(); // userId -> socketId
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:5173",
                methods: ["GET", "POST"],
                credentials: true,
            },
        });
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.split(" ")[1];
                if (!token) {
                    return next(new Error("Authentication token required"));
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                console.log("🔓 JWT decoded payload:", {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role,
                });
                // Fetch user details from database
                const user = await prisma_1.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                });
                if (!user || !user.isActive) {
                    return next(new Error("User not found or inactive"));
                }
                socket.user = user;
                console.log(`✅ Socket authenticated for user: ${user.email} (${user.role})`);
                next();
            }
            catch (error) {
                console.error("Socket authentication error:", error);
                if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    next(new Error("Invalid JWT token"));
                }
                else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                    next(new Error("JWT token expired"));
                }
                else {
                    next(new Error("Authentication failed"));
                }
            }
        });
    }
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            console.log(`User ${socket.user?.email} connected with socket ID: ${socket.id}`);
            // Store user connection
            if (socket.user) {
                this.connectedUsers.set(socket.user.id, socket.id);
                // Join user to their personal room
                socket.join(`user:${socket.user.id}`);
                // Join user to role-based rooms
                socket.join(`role:${socket.user.role}`);
                // Emit connection success
                socket.emit("connected", {
                    message: "Successfully connected to notifications",
                    user: socket.user,
                });
            }
            // Handle notification acknowledgment
            socket.on("notification:read", async (notificationId) => {
                try {
                    if (!socket.user)
                        return;
                    await prisma_1.prisma.notification.update({
                        where: {
                            id: notificationId,
                            userId: socket.user.id,
                        },
                        data: {
                            isRead: true,
                            readAt: new Date(),
                        },
                    });
                    socket.emit("notification:read:success", { notificationId });
                }
                catch (error) {
                    console.error("Error marking notification as read:", error);
                    socket.emit("notification:read:error", {
                        notificationId,
                        error: "Failed to mark notification as read",
                    });
                }
            });
            // Handle bulk notification read
            socket.on("notifications:mark-all-read", async () => {
                try {
                    if (!socket.user)
                        return;
                    await prisma_1.prisma.notification.updateMany({
                        where: {
                            userId: socket.user.id,
                            isRead: false,
                        },
                        data: {
                            isRead: true,
                            readAt: new Date(),
                        },
                    });
                    socket.emit("notifications:mark-all-read:success");
                }
                catch (error) {
                    console.error("Error marking all notifications as read:", error);
                    socket.emit("notifications:mark-all-read:error", {
                        error: "Failed to mark all notifications as read",
                    });
                }
            });
            // Handle requesting unread notifications count
            socket.on("notifications:get-unread-count", async () => {
                try {
                    if (!socket.user)
                        return;
                    const count = await prisma_1.prisma.notification.count({
                        where: {
                            userId: socket.user.id,
                            isRead: false,
                        },
                    });
                    socket.emit("notifications:unread-count", { count });
                }
                catch (error) {
                    console.error("Error getting unread notifications count:", error);
                    socket.emit("notifications:unread-count:error", {
                        error: "Failed to get unread notifications count",
                    });
                }
            });
            // Handle requesting recent notifications
            socket.on("notifications:get-recent", async (limit = 10) => {
                try {
                    if (!socket.user)
                        return;
                    const notifications = await prisma_1.prisma.notification.findMany({
                        where: {
                            userId: socket.user.id,
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                        take: limit,
                    });
                    socket.emit("notifications:recent", { notifications });
                }
                catch (error) {
                    console.error("Error getting recent notifications:", error);
                    socket.emit("notifications:recent:error", {
                        error: "Failed to get recent notifications",
                    });
                }
            });
            // Handle disconnect
            socket.on("disconnect", () => {
                console.log(`User ${socket.user?.email} disconnected`);
                if (socket.user) {
                    this.connectedUsers.delete(socket.user.id);
                }
            });
        });
    }
    // Public methods for sending notifications
    async sendNotificationToUser(userId, notification) {
        try {
            // Save notification to database
            const savedNotification = await prisma_1.prisma.notification.create({
                data: {
                    userId,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    priority: notification.priority || "MEDIUM",
                    data: notification.data || null,
                },
            });
            // Send real-time notification if user is connected
            const socketId = this.connectedUsers.get(userId);
            if (socketId) {
                this.io.to(socketId).emit("notification:new", savedNotification);
            }
            // Also send to user room (in case of multiple connections)
            this.io.to(`user:${userId}`).emit("notification:new", savedNotification);
            return savedNotification;
        }
        catch (error) {
            console.error("Error sending notification to user:", error);
            throw error;
        }
    }
    async sendNotificationToRole(role, notification) {
        try {
            // Get all users with the specified role
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    role: role,
                    isActive: true,
                },
                select: {
                    id: true,
                },
            });
            // Send notification to each user
            const notifications = await Promise.all(users.map((user) => this.sendNotificationToUser(user.id, notification)));
            return notifications;
        }
        catch (error) {
            console.error("Error sending notification to role:", error);
            throw error;
        }
    }
    async sendNotificationToAll(notification) {
        try {
            // Get all active users
            const users = await prisma_1.prisma.user.findMany({
                where: {
                    isActive: true,
                },
                select: {
                    id: true,
                },
            });
            // Send notification to each user
            const notifications = await Promise.all(users.map((user) => this.sendNotificationToUser(user.id, notification)));
            return notifications;
        }
        catch (error) {
            console.error("Error sending notification to all users:", error);
            throw error;
        }
    }
    getConnectedUsers() {
        return Array.from(this.connectedUsers.keys());
    }
    isUserConnected(userId) {
        return this.connectedUsers.has(userId);
    }
    getIo() {
        return this.io;
    }
    // Emit methods for real-time updates
    emitToUser(userId, event, data) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
        // Also emit to user room in case of multiple connections
        this.io.to(`user:${userId}`).emit(event, data);
    }
    emitToRole(role, event, data) {
        this.io.to(`role:${role}`).emit(event, data);
    }
    emitToAll(event, data) {
        this.io.emit(event, data);
    }
}
exports.SocketManager = SocketManager;
