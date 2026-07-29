// Authentication Types
export * from "./auth";

// Re-export Prisma types
export type {
  User,
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
  UserStatus,
  UserRank,
  BloodGroup,
  EducationLevel,
  ZKTecoCheckType,
  AttendanceStatusType,
  NotificationType,
  NotificationPriority,
  PdrStatus,
  PdrOverallStatus,
} from "@prisma/client";
