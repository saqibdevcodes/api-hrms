/*
  Warnings:

  - The values [DIRECTOR_LEVEL] on the enum `users_userRank` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `pdr_comments` MODIFY `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `users` MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    MODIFY `userRank` ENUM('DIRECTOR', 'LINE_MANAGER', 'EMPLOYEE') NULL,
    MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR';
