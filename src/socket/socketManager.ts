import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export class SocketManager {
  private io: Server;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // Fetch user details from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
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
        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Invalid authentication token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(
        `User ${socket.user?.email} connected with socket ID: ${socket.id}`
      );

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
      socket.on("notification:read", async (notificationId: string) => {
        try {
          if (!socket.user) return;

          await prisma.notification.update({
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
        } catch (error) {
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
          if (!socket.user) return;

          await prisma.notification.updateMany({
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
        } catch (error) {
          console.error("Error marking all notifications as read:", error);
          socket.emit("notifications:mark-all-read:error", {
            error: "Failed to mark all notifications as read",
          });
        }
      });

      // Handle requesting unread notifications count
      socket.on("notifications:get-unread-count", async () => {
        try {
          if (!socket.user) return;

          const count = await prisma.notification.count({
            where: {
              userId: socket.user.id,
              isRead: false,
            },
          });

          socket.emit("notifications:unread-count", { count });
        } catch (error) {
          console.error("Error getting unread notifications count:", error);
          socket.emit("notifications:unread-count:error", {
            error: "Failed to get unread notifications count",
          });
        }
      });

      // Handle requesting recent notifications
      socket.on("notifications:get-recent", async (limit: number = 10) => {
        try {
          if (!socket.user) return;

          const notifications = await prisma.notification.findMany({
            where: {
              userId: socket.user.id,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: limit,
          });

          socket.emit("notifications:recent", { notifications });
        } catch (error) {
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
  public async sendNotificationToUser(
    userId: string,
    notification: {
      title: string;
      message: string;
      type: string;
      priority?: string;
      data?: any;
    }
  ) {
    try {
      // Save notification to database
      const savedNotification = await prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type as any,
          priority: (notification.priority as any) || "MEDIUM",
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
    } catch (error) {
      console.error("Error sending notification to user:", error);
      throw error;
    }
  }

  public async sendNotificationToRole(
    role: string,
    notification: {
      title: string;
      message: string;
      type: string;
      priority?: string;
      data?: any;
    }
  ) {
    try {
      // Get all users with the specified role
      const users = await prisma.user.findMany({
        where: {
          role: role as any,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      // Send notification to each user
      const notifications = await Promise.all(
        users.map((user) => this.sendNotificationToUser(user.id, notification))
      );

      return notifications;
    } catch (error) {
      console.error("Error sending notification to role:", error);
      throw error;
    }
  }

  public async sendNotificationToAll(notification: {
    title: string;
    message: string;
    type: string;
    priority?: string;
    data?: any;
  }) {
    try {
      // Get all active users
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      // Send notification to each user
      const notifications = await Promise.all(
        users.map((user) => this.sendNotificationToUser(user.id, notification))
      );

      return notifications;
    } catch (error) {
      console.error("Error sending notification to all users:", error);
      throw error;
    }
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getIo(): Server {
    return this.io;
  }
}
