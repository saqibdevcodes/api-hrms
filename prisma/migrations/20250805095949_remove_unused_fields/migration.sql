/*
  Warnings:

  - You are about to drop the column `emergencyContactName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContactPhone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContactRelation` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `employeeLeaveId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `_EmployeeLeaveToLeavePolicy` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `employee_leaves` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `_EmployeeLeaveToLeavePolicy` DROP FOREIGN KEY `_EmployeeLeaveToLeavePolicy_A_fkey`;

-- DropForeignKey
ALTER TABLE `_EmployeeLeaveToLeavePolicy` DROP FOREIGN KEY `_EmployeeLeaveToLeavePolicy_B_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_employeeLeaveId_fkey`;

-- DropIndex
DROP INDEX `users_employeeLeaveId_fkey` ON `users`;

-- AlterTable
ALTER TABLE `employee_leaves` ADD COLUMN `leavePolicyId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `emergencyContactName`,
    DROP COLUMN `emergencyContactPhone`,
    DROP COLUMN `emergencyContactRelation`,
    DROP COLUMN `employeeLeaveId`;

-- DropTable
DROP TABLE `_EmployeeLeaveToLeavePolicy`;

-- CreateIndex
CREATE UNIQUE INDEX `employee_leaves_userId_key` ON `employee_leaves`(`userId`);

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_leavePolicyId_fkey` FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
