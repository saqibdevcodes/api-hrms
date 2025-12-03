"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRoutes_1 = __importDefault(require("./authRoutes"));
const employeeRoutes_1 = __importDefault(require("./employeeRoutes"));
const departmentRoutes_1 = __importDefault(require("./departmentRoutes"));
const designationRoutes_1 = __importDefault(require("./designationRoutes"));
const employmentTypeRoutes_1 = __importDefault(require("./employmentTypeRoutes"));
const contractTypeRoutes_1 = __importDefault(require("./contractTypeRoutes"));
const shiftRoutes_1 = __importDefault(require("./shiftRoutes"));
const leavePolicyRoutes_1 = __importDefault(require("./leavePolicyRoutes"));
const employeeLeaveRoutes_1 = __importDefault(require("./employeeLeaveRoutes"));
const leaveRequestRoutes_1 = __importDefault(require("./leaveRequestRoutes"));
const notificationRoutes_1 = __importDefault(require("./notificationRoutes"));
const offDays_1 = __importDefault(require("./offDays"));
const zktecoRoutes_1 = __importDefault(require("./zktecoRoutes"));
const auth_1 = require("../middleware/auth");
const loans_1 = __importDefault(require("./loans"));
const advanceSalaryRoutes_1 = __importDefault(require("./advanceSalaryRoutes"));
const pdrRoutes_1 = __importDefault(require("./pdrRoutes"));
const router = (0, express_1.Router)();
router.use("/pdr", pdrRoutes_1.default);
// Authentication routes (public)
router.use("/auth", authRoutes_1.default);
// Employee management routes (protected)
router.use("/employees", employeeRoutes_1.default);
// Department management routes (protected)
router.use("/departments", departmentRoutes_1.default);
// Designation management routes (protected)
router.use("/designations", designationRoutes_1.default);
// Employment type management routes (protected)
router.use("/employment-types", employmentTypeRoutes_1.default);
// Contract type management routes (protected)
router.use("/contract-types", contractTypeRoutes_1.default);
// Shift management routes (protected)
router.use("/shifts", shiftRoutes_1.default);
// Leave policy management routes (protected)
router.use("/leave-policies", leavePolicyRoutes_1.default);
// Employee leave management routes (protected)
router.use("/employee-leaves", employeeLeaveRoutes_1.default);
// Leave request management routes (protected)
router.use("/leave-requests", leaveRequestRoutes_1.default);
// Notification management routes (protected)
router.use("/notifications", notificationRoutes_1.default);
// Off days management routes (protected)
router.use("/off-days", offDays_1.default);
// ZKTeco device management routes (protected)
router.use("/zkteco", zktecoRoutes_1.default);
// Loan management routes (protected)
router.use("/loans", loans_1.default);
// Advancae Salary management routes (protected)
router.use("/advanceSalary", advanceSalaryRoutes_1.default);
// Example protected routes (for demonstration)
/**
 * @route   GET /api/v1/dashboard
 * @desc    Get dashboard data
 * @access  Private
 */
router.get("/dashboard", auth_1.authenticate, (req, res) => {
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
router.get("/admin/users", auth_1.authenticate, auth_1.adminOnly, (req, res) => {
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
router.get("/hr/reports", auth_1.authenticate, auth_1.hrAndAdmin, (req, res) => {
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
exports.default = router;
