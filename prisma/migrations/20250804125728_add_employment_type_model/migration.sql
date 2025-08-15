/*
  Warnings:

  - You are about to drop the column `employmentType` on the `employees` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `employees` DROP COLUMN `employmentType`,
    ADD COLUMN `employmentTypeId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `employment_types` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employment_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_employmentTypeId_fkey` FOREIGN KEY (`employmentTypeId`) REFERENCES `employment_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
