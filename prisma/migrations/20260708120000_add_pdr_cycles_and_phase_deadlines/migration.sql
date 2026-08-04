-- CreateTable
CREATE TABLE `pdr_cycles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pdr_cycles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `pdr`
    ADD COLUMN `pdrCycleId` INTEGER NULL,
    ADD COLUMN `employeeAccessDeadline` DATETIME(3) NULL,
    ADD COLUMN `employeeAccessNoRestriction` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `hrEmployeeApprovalDeadline` DATETIME(3) NULL,
    ADD COLUMN `hrEmployeeApprovalNoRestriction` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `managerAccessDeadline` DATETIME(3) NULL,
    ADD COLUMN `managerAccessNoRestriction` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `hrManagerApprovalDeadline` DATETIME(3) NULL,
    ADD COLUMN `hrManagerApprovalNoRestriction` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `directorReviewDeadline` DATETIME(3) NULL,
    ADD COLUMN `directorReviewNoRestriction` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `employeeAcknowledgementDeadline` DATETIME(3) NULL,
    ADD COLUMN `employeeAcknowledgementNoRestriction` BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE `pdr` ADD CONSTRAINT `pdr_pdrCycleId_fkey` FOREIGN KEY (`pdrCycleId`) REFERENCES `pdr_cycles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
