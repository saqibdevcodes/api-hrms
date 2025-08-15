/*
  Warnings:

  - You are about to drop the column `employeeEmergencyDetailId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `employee_emergency_details` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_employeeEmergencyDetailId_fkey`;

-- DropIndex
DROP INDEX `users_employeeEmergencyDetailId_fkey` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `employeeEmergencyDetailId`;

-- DropTable
DROP TABLE `employee_emergency_details`;
