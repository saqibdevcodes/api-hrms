-- AlterTable
ALTER TABLE `pdr_comments` MODIFY `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `hasSystemAccess` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR';
