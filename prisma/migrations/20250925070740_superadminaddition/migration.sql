/*
  Warnings:

  - The values [SUPER_ADMIN] on the enum `users_userRank` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `users` MODIFY `userRank` ENUM('DIRECTOR_LEVEL', 'LINE_MANAGER', 'EMPLOYEE') NULL,
    MODIFY `role` ENUM('ADMIN', 'EMPLOYEE', 'SUPERADMIN') NOT NULL DEFAULT 'EMPLOYEE';
