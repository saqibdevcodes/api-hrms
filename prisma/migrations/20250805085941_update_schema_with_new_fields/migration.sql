/*
  Warnings:

  - You are about to drop the column `approvedBy` on the `leave_requests` table. All the data in the column will be lost.
  - The values [SENIOR_MANAGER,TEAM_LEAD,SPECIALIST,EXECUTIVE] on the enum `users_userRank` will be removed. If these variants are still used in the database, this will fail.
  - The values [HR,MANAGER] on the enum `users_role` will be removed. If these variants are still used in the database, this will fail.
  - The values [OTHER,PREFER_NOT_TO_SAY] on the enum `users_gender` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `attendances` ADD COLUMN `attendanceDeductionId` VARCHAR(191) NULL,
    ADD COLUMN `attendanceReasonId` VARCHAR(191) NULL,
    ADD COLUMN `reason` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `leave_requests` DROP COLUMN `approvedBy`,
    ADD COLUMN `approvedByHr` VARCHAR(191) NULL,
    ADD COLUMN `approvedByLineManager` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `shifts` ADD COLUMN `earlyOut` DATETIME(3) NULL,
    ADD COLUMN `fullDayStart` DATETIME(3) NULL,
    ADD COLUMN `halfDayStart` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `educationalDetailId` INTEGER NULL,
    ADD COLUMN `employeeEmergencyDetailId` INTEGER NULL,
    ADD COLUMN `employeeLeaveId` INTEGER NULL,
    MODIFY `userRank` ENUM('DIRECTOR_LEVEL', 'LINE_MANAGER', 'EMPLOYEE') NULL,
    MODIFY `role` ENUM('ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    MODIFY `gender` ENUM('MALE', 'FEMALE') NULL;

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
CREATE TABLE `employee_leaves` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `annualLeaves` INTEGER NOT NULL,
    `sickLeaves` INTEGER NOT NULL,
    `casualLeaves` INTEGER NOT NULL,
    `compensatoryLeaves` INTEGER NOT NULL,
    `maternityLeaves` INTEGER NOT NULL,
    `paternityLeaves` INTEGER NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

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
CREATE TABLE `employee_emergency_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

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

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pdr` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `creation_date` DATETIME(3) NOT NULL,
    `pdr_timeline` VARCHAR(191) NULL,
    `linemanager_id` VARCHAR(191) NULL,
    `director_id` VARCHAR(191) NULL,
    `emp_status` VARCHAR(191) NOT NULL,
    `linemanager_status` VARCHAR(191) NOT NULL,
    `directore_status` VARCHAR(191) NOT NULL,
    `admin_status` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PdrComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `employee_type` VARCHAR(191) NOT NULL,
    `pdr_status_type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PdrPersonalQuality` (
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
CREATE TABLE `PdrGoalsTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `task` VARCHAR(191) NOT NULL,
    `employee_self_rating` INTEGER NOT NULL,
    `linemanager_rating` INTEGER NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PdrGoalsTasksComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `employee_type` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PdrOverallComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pdr_id` INTEGER NOT NULL,
    `employee_type` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NOT NULL,
    `datetime` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_EmployeeLeaveToLeavePolicy` (
    `A` INTEGER NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_EmployeeLeaveToLeavePolicy_AB_unique`(`A`, `B`),
    INDEX `_EmployeeLeaveToLeavePolicy_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employeeLeaveId_fkey` FOREIGN KEY (`employeeLeaveId`) REFERENCES `employee_leaves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_educationalDetailId_fkey` FOREIGN KEY (`educationalDetailId`) REFERENCES `educational_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employeeEmergencyDetailId_fkey` FOREIGN KEY (`employeeEmergencyDetailId`) REFERENCES `employee_emergency_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendanceDeductionId_fkey` FOREIGN KEY (`attendanceDeductionId`) REFERENCES `attendance_deductions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reason_attachments` ADD CONSTRAINT `attendance_reason_attachments_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdr` ADD CONSTRAINT `Pdr_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdr` ADD CONSTRAINT `Pdr_linemanager_id_fkey` FOREIGN KEY (`linemanager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdr` ADD CONSTRAINT `Pdr_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrComment` ADD CONSTRAINT `PdrComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrPersonalQuality` ADD CONSTRAINT `PdrPersonalQuality_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrGoalsTask` ADD CONSTRAINT `PdrGoalsTask_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrGoalsTasksComment` ADD CONSTRAINT `PdrGoalsTasksComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrOverallComment` ADD CONSTRAINT `PdrOverallComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EmployeeLeaveToLeavePolicy` ADD CONSTRAINT `_EmployeeLeaveToLeavePolicy_A_fkey` FOREIGN KEY (`A`) REFERENCES `employee_leaves`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EmployeeLeaveToLeavePolicy` ADD CONSTRAINT `_EmployeeLeaveToLeavePolicy_B_fkey` FOREIGN KEY (`B`) REFERENCES `leave_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
