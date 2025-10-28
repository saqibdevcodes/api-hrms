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
import loanRoutes from "./loans";
import ASRoutes from "./advanceSalaryRoutes";
import pdrRoutes from "./pdrRoutes";

const router = Router();


router.use("/pdr", pdrRoutes);

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
router.get("/dashboard", authenticate, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    message: "Dashboard data retrieved successfully",
    data: {
      user: req.user,
      stats: {
        totalEmployees: 156,
        presentToday: 142,
        onLeave: 8,
        pendingRequests: 12,
      },
      recentActivities: [
        {
          id: 1,
          type: "leave_request",
          message: "John Doe submitted a leave request",
          timestamp: new Date().toISOString(),
        },
        {
          id: 2,
          type: "attendance",
          message: "Sarah Johnson checked in",
          timestamp: new Date().toISOString(),
        },
      ],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

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
