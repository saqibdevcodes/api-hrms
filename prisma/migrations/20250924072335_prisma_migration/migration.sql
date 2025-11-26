/*
Warnings:

- You are about to drop the column `admin_status` on the `pdr` table. All the data in the column will be lost.
- You are about to drop the column `datetime` on the `pdr` table. All the data in the column will be lost.
- You are about to drop the column `directore_status` on the `pdr` table. All the data in the column will be lost.
- You are about to alter the column `emp_status` on the `pdr` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(20))`.
- You are about to alter the column `linemanager_status` on the `pdr` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(20))`.
- You are about to drop the `pdrcomment` table. If the table is not empty, all the data it contains will be lost.
- You are about to drop the `pdrgoalstaskscomment` table. If the table is not empty, all the data it contains will be lost.
- A unique constraint covering the columns `[userId,pdr_cycle]` on the table `pdr` will be added. If there are existing duplicate values, this will fail.

*/

-- Normalize PDR table names to lowercase for consistency with Prisma mappings
-- These renames ensure subsequent statements referencing lowercase tables work
-- Only rename if the old table exists and new table doesn't exist
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'Pdr');
SET @lowercase_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pdr');
SET @sql = IF(@table_exists > 0 AND @lowercase_exists = 0, 'RENAME TABLE `Pdr` TO `pdr`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'PdrComment');
SET @lowercase_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pdrcomment');
SET @sql = IF(@table_exists > 0 AND @lowercase_exists = 0, 'RENAME TABLE `PdrComment` TO `pdrcomment`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'PdrGoalsTask');
SET @lowercase_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pdrgoalstask');
SET @sql = IF(@table_exists > 0 AND @lowercase_exists = 0, 'RENAME TABLE `PdrGoalsTask` TO `pdrgoalstask`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'PdrGoalsTasksComment');
SET @lowercase_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pdrgoalstaskscomment');
SET @sql = IF(@table_exists > 0 AND @lowercase_exists = 0, 'RENAME TABLE `PdrGoalsTasksComment` TO `pdrgoalstaskscomment`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'PdrPersonalQuality');
SET @lowercase_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pdrpersonalquality');
SET @sql = IF(@table_exists > 0 AND @lowercase_exists = 0, 'RENAME TABLE `PdrPersonalQuality` TO `pdrpersonalquality`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'PdrOverallComment');
SET @lowercase_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pdroverallcomment');
SET @sql = IF(@table_exists > 0 AND @lowercase_exists = 0, 'RENAME TABLE `PdrOverallComment` TO `pdroverallcomment`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- DropForeignKeys
ALTER TABLE `AdvanceSalary`
DROP FOREIGN KEY `AdvanceSalary_userId_fkey`;

ALTER TABLE `attendance_reason_attachments`
DROP FOREIGN KEY `attendance_reason_attachments_attendanceReasonId_fkey`;

ALTER TABLE `attendances`
DROP FOREIGN KEY `attendances_attendanceDeductionId_fkey`;

ALTER TABLE `attendances`
DROP FOREIGN KEY `attendances_attendanceReasonId_fkey`;

ALTER TABLE `attendances`
DROP FOREIGN KEY `attendances_employeeId_fkey`;

ALTER TABLE `employee_leaves`
DROP FOREIGN KEY `employee_leaves_leavePolicyId_fkey`;

ALTER TABLE `employee_leaves`
DROP FOREIGN KEY `employee_leaves_userId_fkey`;

ALTER TABLE `leave_requests`
DROP FOREIGN KEY `leave_requests_employeeId_fkey`;

ALTER TABLE `loans` DROP FOREIGN KEY `loans_userId_fkey`;

ALTER TABLE `notifications`
DROP FOREIGN KEY `notifications_userId_fkey`;

ALTER TABLE `payroll_records`
DROP FOREIGN KEY `payroll_records_employeeId_fkey`;

ALTER TABLE `pdr` DROP FOREIGN KEY `Pdr_director_id_fkey`;

ALTER TABLE `pdr` DROP FOREIGN KEY `Pdr_linemanager_id_fkey`;

ALTER TABLE `pdr` DROP FOREIGN KEY `Pdr_userId_fkey`;

ALTER TABLE `pdrgoalstask`
DROP FOREIGN KEY `PdrGoalsTask_pdr_id_fkey`;

ALTER TABLE `pdroverallcomment`
DROP FOREIGN KEY `PdrOverallComment_pdr_id_fkey`;

ALTER TABLE `pdrpersonalquality`
DROP FOREIGN KEY `PdrPersonalQuality_pdr_id_fkey`;

ALTER TABLE `performance_reviews`
DROP FOREIGN KEY `performance_reviews_employeeId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_contractTypeId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_departmentId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_designationId_fkey`;

ALTER TABLE `users`
DROP FOREIGN KEY `users_educationalDetailId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_emergencyDetailId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_employmentTypeId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_leaveId_fkey`;

ALTER TABLE `users` DROP FOREIGN KEY `users_shiftId_fkey`;

ALTER TABLE `zkteco_attendance_records`
DROP FOREIGN KEY `zkteco_attendance_records_attendanceId_fkey`;

ALTER TABLE `zkteco_attendance_records`
DROP FOREIGN KEY `zkteco_attendance_records_userId_fkey`;

-- AlterTable
ALTER TABLE `pdr`
DROP COLUMN `admin_status`,
DROP COLUMN `datetime`,
DROP COLUMN `directore_status`,
ADD COLUMN `completedAt` DATETIME(3) NULL,
ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
ADD COLUMN `director_overall_comment` TEXT NULL,
ADD COLUMN `director_status` ENUM(
    'PENDING',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REVERTED',
    'ACKNOWLEDGED',
    'COMPLETED'
) NOT NULL DEFAULT 'PENDING',
ADD COLUMN `hr_status` ENUM(
    'PENDING',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REVERTED',
    'ACKNOWLEDGED',
    'COMPLETED'
) NOT NULL DEFAULT 'PENDING',
ADD COLUMN `isCompleted` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `lastModifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
ADD COLUMN `lastModifiedBy` VARCHAR(191) NULL,
ADD COLUMN `overallStatus` ENUM(
    'CREATED_BY_HR',
    'EMPLOYEE_FILLING',
    'EMPLOYEE_SUBMITTED_TO_HR',
    'HR_REVIEWING_EMPLOYEE',
    'HR_REVERTED_TO_EMPLOYEE',
    'HR_APPROVED_EMPLOYEE',
    'MANAGER_FILLING',
    'MANAGER_SUBMITTED_TO_HR',
    'HR_REVIEWING_MANAGER',
    'HR_REVERTED_TO_MANAGER',
    'HR_APPROVED_MANAGER',
    'EMPLOYEE_ACKNOWLEDGING',
    'EMPLOYEE_DISAGREED',
    'EMPLOYEE_REVERT_TO_MANAGER',
    'MANAGER_REVISING',
    'EMPLOYEE_ACKNOWLEDGED',
    'DIRECTOR_REVIEWING',
    'DIRECTOR_REVIEWED',
    'COMPLETED'
) NOT NULL DEFAULT 'CREATED_BY_HR',
ADD COLUMN `pdr_cycle` VARCHAR(50) NULL,
ADD COLUMN `promotion_description` TEXT NULL,
ADD COLUMN `promotion_recommended` BOOLEAN NULL DEFAULT false,
ADD COLUMN `training_description` TEXT NULL,
ADD COLUMN `training_required` BOOLEAN NULL DEFAULT false,
ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
MODIFY `creation_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
MODIFY `emp_status` ENUM(
    'PENDING',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REVERTED',
    'ACKNOWLEDGED',
    'COMPLETED'
) NOT NULL DEFAULT 'PENDING',
MODIFY `linemanager_status` ENUM(
    'PENDING',
    'IN_PROGRESS',
    'SUBMITTED',
    'APPROVED',
    'REVERTED',
    'ACKNOWLEDGED',
    'COMPLETED'
) NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE `pdrcomment`;

-- DropTable
DROP TABLE `pdrgoalstaskscomment`;

-- CreateTable
CREATE TABLE `pdr_status_transitions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdrId` INTEGER NOT NULL,
    `fromStatus` ENUM(
        'CREATED_BY_HR',
        'EMPLOYEE_FILLING',
        'EMPLOYEE_SUBMITTED_TO_HR',
        'HR_REVIEWING_EMPLOYEE',
        'HR_REVERTED_TO_EMPLOYEE',
        'HR_APPROVED_EMPLOYEE',
        'MANAGER_FILLING',
        'MANAGER_SUBMITTED_TO_HR',
        'HR_REVIEWING_MANAGER',
        'HR_REVERTED_TO_MANAGER',
        'HR_APPROVED_MANAGER',
        'EMPLOYEE_ACKNOWLEDGING',
        'EMPLOYEE_DISAGREED',
        'EMPLOYEE_REVERT_TO_MANAGER',
        'MANAGER_REVISING',
        'EMPLOYEE_ACKNOWLEDGED',
        'DIRECTOR_REVIEWING',
        'DIRECTOR_REVIEWED',
        'COMPLETED'
    ) NOT NULL,
    `toStatus` ENUM(
        'CREATED_BY_HR',
        'EMPLOYEE_FILLING',
        'EMPLOYEE_SUBMITTED_TO_HR',
        'HR_REVIEWING_EMPLOYEE',
        'HR_REVERTED_TO_EMPLOYEE',
        'HR_APPROVED_EMPLOYEE',
        'MANAGER_FILLING',
        'MANAGER_SUBMITTED_TO_HR',
        'HR_REVIEWING_MANAGER',
        'HR_REVERTED_TO_MANAGER',
        'HR_APPROVED_MANAGER',
        'EMPLOYEE_ACKNOWLEDGING',
        'EMPLOYEE_DISAGREED',
        'EMPLOYEE_REVERT_TO_MANAGER',
        'MANAGER_REVISING',
        'EMPLOYEE_ACKNOWLEDGED',
        'DIRECTOR_REVIEWING',
        'DIRECTOR_REVIEWED',
        'COMPLETED'
    ) NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX `pdr_userId_pdr_cycle_key` ON `pdr` (`userId`, `pdr_cycle`);

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_emergencyDetailId_fkey` FOREIGN KEY (`emergencyDetailId`) REFERENCES `emergency_details` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_contractTypeId_fkey` FOREIGN KEY (`contractTypeId`) REFERENCES `contract_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `designations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_leaveId_fkey` FOREIGN KEY (`leaveId`) REFERENCES `leave_policies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_employmentTypeId_fkey` FOREIGN KEY (`employmentTypeId`) REFERENCES `employment_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users`
ADD CONSTRAINT `users_educationalDetailId_fkey` FOREIGN KEY (`educationalDetailId`) REFERENCES `educational_details` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves`
ADD CONSTRAINT `employee_leaves_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves`
ADD CONSTRAINT `employee_leaves_leavePolicyId_fkey` FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances`
ADD CONSTRAINT `attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances`
ADD CONSTRAINT `attendances_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances`
ADD CONSTRAINT `attendances_attendanceDeductionId_fkey` FOREIGN KEY (`attendanceDeductionId`) REFERENCES `attendance_deductions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records`
ADD CONSTRAINT `zkteco_attendance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records`
ADD CONSTRAINT `zkteco_attendance_records_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `attendances` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reason_attachments`
ADD CONSTRAINT `attendance_reason_attachments_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests`
ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_records`
ADD CONSTRAINT `payroll_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews`
ADD CONSTRAINT `performance_reviews_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications`
ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans`
ADD CONSTRAINT `loans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvanceSalary`
ADD CONSTRAINT `AdvanceSalary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr`
ADD CONSTRAINT `pdr_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr`
ADD CONSTRAINT `pdr_linemanager_id_fkey` FOREIGN KEY (`linemanager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr`
ADD CONSTRAINT `pdr_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr_status_transitions`
ADD CONSTRAINT `pdr_status_transitions_pdrId_fkey` FOREIGN KEY (`pdrId`) REFERENCES `pdr` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdr_comments`
ADD CONSTRAINT `pdr_comments_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdrpersonalquality`
ADD CONSTRAINT `PdrPersonalQuality_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdrgoalstask`
ADD CONSTRAINT `PdrGoalsTask_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdroverallcomment`
ADD CONSTRAINT `PdrOverallComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;