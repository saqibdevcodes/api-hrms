-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `fatherHusbandName` VARCHAR(191) NULL,
    `cnic` VARCHAR(191) NULL,
    `cnicExpiry` DATETIME(3) NULL,
    `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED') NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `bloodGroup` ENUM('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE') NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `education` ENUM('PRIMARY', 'SECONDARY', 'HIGHER_SECONDARY', 'BACHELORS', 'MASTERS', 'PHD', 'DIPLOMA', 'CERTIFICATE', 'PROFESSIONAL') NULL,
    `educationInstitute` VARCHAR(191) NULL,
    `educationGrade` VARCHAR(191) NULL,
    `personalEmail` VARCHAR(191) NULL,
    `personalMobile` VARCHAR(191) NULL,
    `officialMobile` VARCHAR(191) NULL,
    `officialEmail` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `personalAddress` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zipCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    `employeeId` VARCHAR(191) NULL,
    `userRank` ENUM('DIRECTOR_LEVEL', 'LINE_MANAGER', 'EMPLOYEE') NULL,
    `password` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `role` ENUM('ADMIN', 'EMPLOYEE', 'HR', 'SUPERADMIN') NOT NULL DEFAULT 'EMPLOYEE',
    `position` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `manager` VARCHAR(191) NULL,
    `salary` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR',
    `dateOfJoining` DATETIME(3) NULL,
    `dateOfExit` DATETIME(3) NULL,
    `hireDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `employmentTypeId` VARCHAR(191) NULL,
    `profilePicture` VARCHAR(191) NULL,
    `degreePicture` VARCHAR(191) NULL,
    `cnicPictureFront` VARCHAR(191) NULL,
    `cnicPictureBack` VARCHAR(191) NULL,
    `hasInsurance` BOOLEAN NULL DEFAULT false,
    `insuranceCardNo` VARCHAR(191) NULL,
    `insuranceInsuredName` VARCHAR(191) NULL,
    `insuranceEmployeeNo` VARCHAR(191) NULL,
    `insuranceValidUpto` DATETIME(3) NULL,
    `insuranceSpouseChildren` VARCHAR(191) NULL,
    `insuranceHospitalization` VARCHAR(191) NULL,
    `insuranceRoomLimit` VARCHAR(191) NULL,
    `insuranceNormalDelivery` VARCHAR(191) NULL,
    `insuranceComplicatedDelivery` VARCHAR(191) NULL,
    `insuranceCardPicture` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLogin` DATETIME(3) NULL,
    `resetPasswordToken` VARCHAR(191) NULL,
    `resetPasswordExpires` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `emergencyDetailId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `contractTypeId` VARCHAR(191) NULL,
    `designationId` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `leaveId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `educationalDetailId` INTEGER NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_cnic_key`(`cnic`),
    UNIQUE INDEX `users_employeeId_key`(`employeeId`),
    UNIQUE INDEX `users_resetPasswordToken_key`(`resetPasswordToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emergency_details` (
    `id` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `contactPhone` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `contactAddress` VARCHAR(191) NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_types` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contract_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designations` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `level` INTEGER NULL,
    `department` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `designations_title_key`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `breakTime` INTEGER NULL,
    `halfDayStart` DATETIME(3) NULL,
    `fullDayStart` DATETIME(3) NULL,
    `earlyOut` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `off_days` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_policies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `annualLeaves` INTEGER NOT NULL DEFAULT 21,
    `sickLeaves` INTEGER NOT NULL DEFAULT 10,
    `casualLeaves` INTEGER NOT NULL DEFAULT 5,
    `maternityLeaves` INTEGER NOT NULL DEFAULT 90,
    `paternityLeaves` INTEGER NOT NULL DEFAULT 15,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_policies_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_leaves` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `annualLeaves` INTEGER NOT NULL,
    `sickLeaves` INTEGER NOT NULL,
    `casualLeaves` INTEGER NOT NULL,
    `compensatoryLeaves` INTEGER NOT NULL,
    `maternityLeaves` INTEGER NOT NULL,
    `paternityLeaves` INTEGER NOT NULL,
    `leavePolicyId` VARCHAR(191) NULL,
    `datetime` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_leaves_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employment_types` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employment_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `educational_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `picture` VARCHAR(191) NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `manager` VARCHAR(191) NULL,
    `budget` DECIMAL(65, 30) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME') NOT NULL DEFAULT 'PRESENT',
    `reason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `deviceCheckIns` INTEGER NOT NULL DEFAULT 0,
    `deviceCheckOuts` INTEGER NOT NULL DEFAULT 0,
    `lastDeviceSync` DATETIME(3) NULL,
    `totalHours` DECIMAL(5, 2) NULL,
    `overtimeHours` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `attendanceReasonId` VARCHAR(191) NULL,
    `attendanceDeductionId` VARCHAR(191) NULL,

    UNIQUE INDEX `attendances_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `zkteco_attendance_staging` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `checkType` ENUM('check_in', 'check_out', 'break_out', 'break_in', 'overtime_in', 'overtime_out') NOT NULL,
    `verifyType` INTEGER NOT NULL,
    `workCode` VARCHAR(191) NULL,
    `overallStatus` ENUM('ON_TIME_ARRIVAL', 'LATE', 'HALF_DAY_LEAVE', 'FULL_DAY_LEAVE_POTENTIAL', 'FULL_DAY_LEAVE', 'EARLY_OUT', 'ON_TIME_LEAVE', 'ABSENT') NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `processingError` VARCHAR(191) NULL,
    `isFinalized` BOOLEAN NOT NULL DEFAULT false,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NULL,

    INDEX `zkteco_attendance_staging_employeeId_idx`(`employeeId`),
    INDEX `zkteco_attendance_staging_deviceId_idx`(`deviceId`),
    INDEX `zkteco_attendance_staging_timestamp_idx`(`timestamp`),
    INDEX `zkteco_attendance_staging_isFinalized_idx`(`isFinalized`),
    INDEX `zkteco_attendance_staging_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `zkteco_attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `checkType` ENUM('check_in', 'check_out', 'break_out', 'break_in', 'overtime_in', 'overtime_out') NOT NULL,
    `verifyType` INTEGER NOT NULL,
    `workCode` VARCHAR(191) NULL,
    `overallStatus` ENUM('ON_TIME_ARRIVAL', 'LATE', 'HALF_DAY_LEAVE', 'FULL_DAY_LEAVE_POTENTIAL', 'FULL_DAY_LEAVE', 'EARLY_OUT', 'ON_TIME_LEAVE', 'ABSENT') NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `processingError` VARCHAR(191) NULL,
    `usedForDeduction` BOOLEAN NOT NULL DEFAULT false,
    `deductionAppliedAt` DATETIME(3) NULL,
    `finalizedFrom` VARCHAR(191) NULL,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `attendanceId` VARCHAR(191) NULL,

    INDEX `zkteco_attendance_records_employeeId_idx`(`employeeId`),
    INDEX `zkteco_attendance_records_deviceId_idx`(`deviceId`),
    INDEX `zkteco_attendance_records_timestamp_idx`(`timestamp`),
    INDEX `zkteco_attendance_records_processed_idx`(`processed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_reasons` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `reasonDetails` VARCHAR(191) NULL,
    `projectName` VARCHAR(191) NULL,
    `projectManager` VARCHAR(191) NULL,
    `projectDepartment` VARCHAR(191) NULL,
    `taskAsignedBy` VARCHAR(191) NULL,
    `taskDetail` VARCHAR(191) NULL,
    `fieldAddress` VARCHAR(191) NULL,
    `reasonComment` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_reason_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceReasonId` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NOT NULL,
    `image` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_deductions` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `deductionReason` VARCHAR(191) NOT NULL,
    `deductValue` DOUBLE NOT NULL,
    `leaveId` INTEGER NULL,
    `datetime` DATETIME(3) NOT NULL,
    `zktecoRecordIds` VARCHAR(191) NULL,
    `deductionType` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` VARCHAR(191) NOT NULL,
    `leaveType` ENUM('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'PERSONAL', 'EMERGENCY', 'BEREAVEMENT', 'STUDY', 'UNPAID') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `days` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `comments` VARCHAR(191) NULL,
    `approvedByLineManager` VARCHAR(191) NULL,
    `approvedByHr` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_records` (
    `id` VARCHAR(191) NOT NULL,
    `payPeriod` VARCHAR(191) NOT NULL,
    `basicSalary` DECIMAL(65, 30) NOT NULL,
    `overtime` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `bonus` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `deductions` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `netPay` DECIMAL(65, 30) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSED', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `payDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `reviewPeriod` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `goalsMet` INTEGER NOT NULL DEFAULT 0,
    `totalGoals` INTEGER NOT NULL DEFAULT 0,
    `manager` VARCHAR(191) NOT NULL,
    `feedback` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE') NOT NULL DEFAULT 'DRAFT',
    `dateCreated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateCompleted` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` ENUM('LEAVE_REQUEST_SUBMITTED', 'LEAVE_REQUEST_APPROVED', 'LEAVE_REQUEST_REJECTED', 'PAYROLL_PROCESSED', 'PERFORMANCE_REVIEW_DUE', 'ATTENDANCE_REMINDER', 'SYSTEM_ANNOUNCEMENT', 'BIRTHDAY_REMINDER', 'WORK_ANNIVERSARY', 'DOCUMENT_EXPIRY', 'TASK_ASSIGNED', 'MEETING_SCHEDULED') NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `data` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,
    `fromUserId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `interest` DECIMAL(65, 30) NULL,
    `totalAmount` DECIMAL(65, 30) NULL,
    `installments` INTEGER NULL,
    `tenure` INTEGER NULL,
    `reason` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdvanceSalary` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `daysCount` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `Status` VARCHAR(191) NULL,
    `ApprovedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdr` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `creation_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pdr_cycle` VARCHAR(50) NULL,
    `pdr_timeline` VARCHAR(191) NULL,
    `linemanager_id` VARCHAR(191) NULL,
    `director_id` VARCHAR(191) NULL,
    `overallStatus` ENUM('CREATED_BY_HR', 'EMPLOYEE_FILLING', 'EMPLOYEE_SUBMITTED_TO_HR', 'HR_REVIEWING_EMPLOYEE', 'HR_REVERTED_TO_EMPLOYEE', 'HR_APPROVED_EMPLOYEE', 'MANAGER_FILLING', 'MANAGER_SUBMITTED_TO_HR', 'HR_REVIEWING_MANAGER', 'HR_REVERTED_TO_MANAGER', 'HR_APPROVED_MANAGER', 'EMPLOYEE_ACKNOWLEDGING', 'EMPLOYEE_DISAGREED', 'EMPLOYEE_REVERT_TO_MANAGER', 'MANAGER_REVISING', 'EMPLOYEE_ACKNOWLEDGED', 'DIRECTOR_REVIEWING', 'DIRECTOR_REVIEWED', 'COMPLETED') NOT NULL DEFAULT 'CREATED_BY_HR',
    `emp_status` ENUM('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVERTED', 'ACKNOWLEDGED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `linemanager_status` ENUM('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVERTED', 'ACKNOWLEDGED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `director_status` ENUM('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVERTED', 'ACKNOWLEDGED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `hr_status` ENUM('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVERTED', 'ACKNOWLEDGED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `lastModifiedBy` VARCHAR(191) NULL,
    `lastModifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `training_required` BOOLEAN NULL DEFAULT false,
    `training_description` TEXT NULL,
    `promotion_recommended` BOOLEAN NULL DEFAULT false,
    `promotion_description` TEXT NULL,
    `director_overall_comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pdr_userId_pdr_cycle_key`(`userId`, `pdr_cycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdr_status_transitions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdrId` INTEGER NOT NULL,
    `fromStatus` ENUM('CREATED_BY_HR', 'EMPLOYEE_FILLING', 'EMPLOYEE_SUBMITTED_TO_HR', 'HR_REVIEWING_EMPLOYEE', 'HR_REVERTED_TO_EMPLOYEE', 'HR_APPROVED_EMPLOYEE', 'MANAGER_FILLING', 'MANAGER_SUBMITTED_TO_HR', 'HR_REVIEWING_MANAGER', 'HR_REVERTED_TO_MANAGER', 'HR_APPROVED_MANAGER', 'EMPLOYEE_ACKNOWLEDGING', 'EMPLOYEE_DISAGREED', 'EMPLOYEE_REVERT_TO_MANAGER', 'MANAGER_REVISING', 'EMPLOYEE_ACKNOWLEDGED', 'DIRECTOR_REVIEWING', 'DIRECTOR_REVIEWED', 'COMPLETED') NOT NULL,
    `toStatus` ENUM('CREATED_BY_HR', 'EMPLOYEE_FILLING', 'EMPLOYEE_SUBMITTED_TO_HR', 'HR_REVIEWING_EMPLOYEE', 'HR_REVERTED_TO_EMPLOYEE', 'HR_APPROVED_EMPLOYEE', 'MANAGER_FILLING', 'MANAGER_SUBMITTED_TO_HR', 'HR_REVIEWING_MANAGER', 'HR_REVERTED_TO_MANAGER', 'HR_APPROVED_MANAGER', 'EMPLOYEE_ACKNOWLEDGING', 'EMPLOYEE_DISAGREED', 'EMPLOYEE_REVERT_TO_MANAGER', 'MANAGER_REVISING', 'EMPLOYEE_ACKNOWLEDGED', 'DIRECTOR_REVIEWING', 'DIRECTOR_REVIEWED', 'COMPLETED') NOT NULL,
    `changedBy` VARCHAR(191) NOT NULL,
    `changedByRole` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdr_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `employee_type` VARCHAR(191) NOT NULL,
    `pdr_status_type` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `datetime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL',
    `sentTo` VARCHAR(191) NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdrpersonalquality` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `employee_type` VARCHAR(191) NOT NULL,
    `communication` INTEGER NOT NULL,
    `innovation` INTEGER NOT NULL,
    `work_ethics` INTEGER NOT NULL,
    `teamwork` INTEGER NOT NULL,
    `maturity` INTEGER NOT NULL,
    `initiative` INTEGER NOT NULL,
    `self_management` INTEGER NOT NULL,
    `customer_focus` INTEGER NOT NULL,
    `sense_of_responsibilities` INTEGER NOT NULL,
    `accountability` INTEGER NOT NULL,
    `work_knowledge` INTEGER NOT NULL,
    `attendance` INTEGER NOT NULL,
    `leadership` INTEGER NOT NULL,
    `comment` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdrgoalstask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `task` VARCHAR(191) NOT NULL,
    `employee_self_rating` INTEGER NOT NULL,
    `linemanager_rating` INTEGER NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdroverallcomment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `employee_type` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_emergencyDetailId_fkey` FOREIGN KEY (`emergencyDetailId`) REFERENCES `emergency_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_contractTypeId_fkey` FOREIGN KEY (`contractTypeId`) REFERENCES `contract_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_leaveId_fkey` FOREIGN KEY (`leaveId`) REFERENCES `leave_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employmentTypeId_fkey` FOREIGN KEY (`employmentTypeId`) REFERENCES `employment_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_educationalDetailId_fkey` FOREIGN KEY (`educationalDetailId`) REFERENCES `educational_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_leavePolicyId_fkey` FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendanceDeductionId_fkey` FOREIGN KEY (`attendanceDeductionId`) REFERENCES `attendance_deductions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_staging` ADD CONSTRAINT `zkteco_attendance_staging_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records` ADD CONSTRAINT `zkteco_attendance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records` ADD CONSTRAINT `zkteco_attendance_records_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `attendances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reason_attachments` ADD CONSTRAINT `attendance_reason_attachments_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvanceSalary` ADD CONSTRAINT `AdvanceSalary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr` ADD CONSTRAINT `pdr_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr` ADD CONSTRAINT `pdr_linemanager_id_fkey` FOREIGN KEY (`linemanager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr` ADD CONSTRAINT `pdr_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr_status_transitions` ADD CONSTRAINT `pdr_status_transitions_pdrId_fkey` FOREIGN KEY (`pdrId`) REFERENCES `pdr`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr_comments` ADD CONSTRAINT `pdr_comments_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdrpersonalquality` ADD CONSTRAINT `pdrpersonalquality_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdrgoalstask` ADD CONSTRAINT `pdrgoalstask_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdroverallcomment` ADD CONSTRAINT `pdroverallcomment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
