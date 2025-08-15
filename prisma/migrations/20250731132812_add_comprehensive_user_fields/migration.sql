/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Post` DROP FOREIGN KEY `Post_authorId_fkey`;

-- DropTable
DROP TABLE `Post`;

-- DropTable
DROP TABLE `User`;

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
    `education` ENUM('PRIMARY', 'SECONDARY', 'HIGHER_SECONDARY', 'BACHELORS', 'MASTERS', 'PHD', 'DIPLOMA', 'CERTIFICATE', 'PROFESSIONAL') NULL,
    `educationInstitute` VARCHAR(191) NULL,
    `educationGrade` VARCHAR(191) NULL,
    `personalEmail` VARCHAR(191) NULL,
    `personalMobile` VARCHAR(191) NULL,
    `officialMobile` VARCHAR(191) NULL,
    `officialEmail` VARCHAR(191) NULL,
    `userRank` ENUM('DIRECTOR_LEVEL', 'LINE_MANAGER', 'EMPLOYEE', 'SENIOR_MANAGER', 'TEAM_LEAD', 'SPECIALIST', 'EXECUTIVE') NULL,
    `password` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `role` ENUM('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `personalAddress` VARCHAR(191) NULL,
    `dateOfJoining` DATETIME(3) NULL,
    `dateOfExit` DATETIME(3) NULL,
    `degreePicture` VARCHAR(191) NULL,
    `cnicPictureFront` VARCHAR(191) NULL,
    `cnicPictureBack` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLogin` DATETIME(3) NULL,
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

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_cnic_key`(`cnic`),
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
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_name_key`(`name`),
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
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL,
    `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED') NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `zipCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'United States',
    `position` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `manager` VARCHAR(191) NULL,
    `salary` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `hireDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `employmentType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT') NOT NULL DEFAULT 'FULL_TIME',
    `status` ENUM('ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE') NOT NULL DEFAULT 'ACTIVE',
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `emergencyContactRelation` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `employees_employeeId_key`(`employeeId`),
    UNIQUE INDEX `employees_email_key`(`email`),
    UNIQUE INDEX `employees_userId_key`(`userId`),
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
    `date` DATETIME(3) NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME') NOT NULL DEFAULT 'PRESENT',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `attendances_employeeId_date_key`(`employeeId`, `date`),
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
    `approvedBy` VARCHAR(191) NULL,
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
ALTER TABLE `employees` ADD CONSTRAINT `employees_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
