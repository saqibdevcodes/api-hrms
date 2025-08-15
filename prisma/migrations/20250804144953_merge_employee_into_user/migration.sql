/*
  Warnings:

  - You are about to drop the `employees` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[employeeId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `attendances` DROP FOREIGN KEY `attendances_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `employees` DROP FOREIGN KEY `employees_employmentTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `employees` DROP FOREIGN KEY `employees_userId_fkey`;

-- DropForeignKey
ALTER TABLE `leave_requests` DROP FOREIGN KEY `leave_requests_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `payroll_records` DROP FOREIGN KEY `payroll_records_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `performance_reviews` DROP FOREIGN KEY `performance_reviews_employeeId_fkey`;

-- DropIndex
DROP INDEX `leave_requests_employeeId_fkey` ON `leave_requests`;

-- DropIndex
DROP INDEX `payroll_records_employeeId_fkey` ON `payroll_records`;

-- DropIndex
DROP INDEX `performance_reviews_employeeId_fkey` ON `performance_reviews`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR',
    ADD COLUMN `department` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactRelation` VARCHAR(191) NULL,
    ADD COLUMN `employeeId` VARCHAR(191) NULL,
    ADD COLUMN `employmentTypeId` VARCHAR(191) NULL,
    ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL,
    ADD COLUMN `hireDate` DATETIME(3) NULL,
    ADD COLUMN `manager` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `position` VARCHAR(191) NULL,
    ADD COLUMN `salary` DECIMAL(65, 30) NULL,
    ADD COLUMN `state` VARCHAR(191) NULL,
    ADD COLUMN `zipCode` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `employees`;

-- CreateIndex
CREATE UNIQUE INDEX `users_employeeId_key` ON `users`(`employeeId`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employmentTypeId_fkey` FOREIGN KEY (`employmentTypeId`) REFERENCES `employment_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
