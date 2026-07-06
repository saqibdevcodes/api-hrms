/*
  Warnings:

  - You are about to drop the column `compensatoryLeaves` on the `employee_leaves` table. All the data in the column will be lost.
  - You are about to drop the column `maternityLeaves` on the `employee_leaves` table. All the data in the column will be lost.
  - You are about to drop the column `paternityLeaves` on the `employee_leaves` table. All the data in the column will be lost.
  - You are about to drop the column `maternityLeaves` on the `leave_policies` table. All the data in the column will be lost.
  - You are about to drop the column `paternityLeaves` on the `leave_policies` table. All the data in the column will be lost.
  - The values [MATERNITY,PATERNITY,PERSONAL,EMERGENCY,BEREAVEMENT,STUDY,UNPAID] on the enum `leave_requests_leaveType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `employee_leaves` DROP COLUMN `compensatoryLeaves`,
    DROP COLUMN `maternityLeaves`,
    DROP COLUMN `paternityLeaves`;

-- AlterTable
ALTER TABLE `leave_policies` DROP COLUMN `maternityLeaves`,
    DROP COLUMN `paternityLeaves`;

-- AlterTable
ALTER TABLE `leave_requests` MODIFY `leaveType` ENUM('ANNUAL', 'SICK', 'CASUAL') NOT NULL;

-- AlterTable
ALTER TABLE `pdr_comments` MODIFY `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `users` MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR';
