import { Router } from "express";
import authRoutes from "./authRoutes";
import employeeRoutes from "./employeeRoutes";
import departmentRoutes from "./departmentRoutes";
import designationRoutes from "./designationRoutes";
import employmentTypeRoutes from "./employmentTypeRoutes";
import contractTypeRoutes from "./contractTypeRoutes";
import shiftRoutes from "./shiftRoutes";
import leavePolicyRoutes from "./leavePolicyRoutes";
import employeeLeaveRoutes from "./employeeLeaveRoutes";
import leaveRequestRoutes from "./leaveRequestRoutes";
import notificationRoutes from "./notificationRoutes";
import offDaysRoutes from "./offDays";
import zktecoRoutes from "./zktecoRoutes";
import { authenticate, adminOnly, hrAndAdmin } from "../middleware/auth";
import { AuthenticatedRequest } from "../types/auth";
import { prisma } from "../lib/prisma";
import loanRoutes from "./loans";
import ASRoutes from "./advanceSalaryRoutes";
import pdrRoutes from "./pdrRoutes";
import documnetRoutes from "./documentRoutes";
import eventRoutes from "./eventRoutes";

const router = Router();

router.use("/pdr", pdrRoutes);
router.use("/documents", documnetRoutes);
router.use("/events", eventRoutes);

// Authentication routes (public)
router.use("/auth", authRoutes);

// Employee management routes (protected)
router.use("/employees", employeeRoutes);

// Department management routes (protected)
router.use("/departments", departmentRoutes);

// Designation management routes (protected)
router.use("/designations", designationRoutes);

// Employment type management routes (protected)
router.use("/employment-types", employmentTypeRoutes);

// Contract type management routes (protected)
router.use("/contract-types", contractTypeRoutes);

// Shift management routes (protected)
router.use("/shifts", shiftRoutes);

// Leave policy management routes (protected)
router.use("/leave-policies", leavePolicyRoutes);

// Employee leave management routes (protected)
router.use("/employee-leaves", employeeLeaveRoutes);

// Leave request management routes (protected)
router.use("/leave-requests", leaveRequestRoutes);

// Notification management routes (protected)
router.use("/notifications", notificationRoutes);

// Off days management routes (protected)
router.use("/off-days", offDaysRoutes);

// ZKTeco device management routes (protected)
router.use("/zkteco", zktecoRoutes);

// Loan management routes (protected)
router.use("/loans", loanRoutes);

// Advancae Salary management routes (protected)
router.use("/advanceSalary", ASRoutes);

// Example protected routes (for demonstration)
/**
 * @route   GET /api/v1/dashboard
 * @desc    Get dashboard data
 * @access  Private
 */
router.get(
  "/dashboard",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Get total employees
      const totalEmployees = await prisma.user.count({
        where: {
          isActive: true,
          employeeId: { not: null },
        },
      });

      // Get today's attendance stats using processed attendance records
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all attendance records for today
      const todaysAttendance = await prisma.attendance.findMany({
        where: {
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        select: {
          status: true,
        },
      });

      // Count by status
      let presentToday = 0;
      let onLeave = 0;

      todaysAttendance.forEach((record: any) => {
        if (
          [
            "PRESENT",
            "LATE",
            "HALF_DAY",
            "WORK_FROM_HOME",
            "EARLY_OUT",
          ].includes(record.status)
        ) {
          presentToday++;
        } else if (["ABSENT"].includes(record.status)) {
          // Absent is counted separately or part of total - present
        }
      });

      // Get approved leave requests for today to count 'on leave' correctly
      // This is more accurate than just attendance status which might be generated later
      const leavesToday = await prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

      onLeave = leavesToday;

      // Get pending leave requests count
      const pendingRequests = await prisma.leaveRequest.count({
        where: {
          status: "PENDING",
        },
      });

      res.json({
        success: true,
        message: "Dashboard data retrieved successfully",
        data: {
          user: req.user,
          stats: {
            totalEmployees,
            presentToday,
            onLeave,
            pendingRequests,
          },
          recentActivities: [], // Deprecated in favor of specific lists
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin only)
 */
router.get("/admin/users", authenticate, adminOnly, (req, res) => {
  res.json({
    success: true,
    message: "Users retrieved successfully",
    data: {
      users: [
        {
          id: "demo-admin-001",
          email: "admin@iriscommunications.com",
          role: "ADMIN",
          employee: {
            employeeId: "IC-ADM001",
            firstName: "Sarah",
            lastName: "Johnson",
            position: "HR Director",
            department: "Human Resources",
          },
        },
        {
          id: "demo-user-002",
          email: "user@iriscommunications.com",
          role: "EMPLOYEE",
          employee: {
            employeeId: "IC-EMP002",
            firstName: "Michael",
            lastName: "Chen",
            position: "Communications Specialist",
            department: "Communications",
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @route   GET /api/v1/hr/reports
 * @desc    Get HR reports
 * @access  Private (HR and Admin only)
 */
router.get("/hr/reports", authenticate, hrAndAdmin, (req, res) => {
  res.json({
    success: true,
    message: "HR reports retrieved successfully",
    data: {
      attendanceReport: {
        totalDays: 30,
        presentDays: 28,
        absentDays: 2,
        attendanceRate: 93.33,
      },
      leaveReport: {
        totalRequests: 24,
        approved: 18,
        pending: 4,
        rejected: 2,
      },
      payrollReport: {
        totalEmployees: 156,
        processed: 150,
        pending: 6,
        totalPayroll: 450000,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @route   GET /api/v1/company/info
 * @desc    Get company information
 * @access  Public
 */
router.get("/company/info", (req, res) => {
  res.json({
    success: true,
    message: "Company information retrieved successfully",
    data: {
      name: "Iris Communications",
      domain: "iriscommunications.com",
      description: "Leading communications solutions provider",
      founded: "2010",
      employees: 156,
      departments: [
        "Human Resources",
        "Communications",
        "Marketing",
        "Technology",
        "Operations",
        "Finance",
        "Customer Service",
        "Business Development",
      ],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
