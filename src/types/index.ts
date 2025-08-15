// Authentication Types
export * from "./auth";

// Re-export Prisma types
export type {
  User,
  Employee,
  Department,
  Attendance,
  LeaveRequest,
  PayrollRecord,
  PerformanceReview,
  Role,
  Gender,
  MaritalStatus,
  EmploymentType,
  EmployeeStatus,
  AttendanceStatus,
  LeaveType,
  RequestStatus,
  PayrollStatus,
  ReviewStatus,
} from "../generated/prisma";
