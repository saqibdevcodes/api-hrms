-- AlterTable
ALTER TABLE `pdr_comments` MODIFY `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `users` MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR';

-- CreateTable
CREATE TABLE `Document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `file` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
