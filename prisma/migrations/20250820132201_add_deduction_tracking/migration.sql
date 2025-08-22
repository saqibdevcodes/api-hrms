-- AlterTable
ALTER TABLE `attendance_deductions` ADD COLUMN `deductionType` VARCHAR(191) NULL,
    ADD COLUMN `zktecoRecordIds` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `zkteco_attendance_records` ADD COLUMN `deductionAppliedAt` DATETIME(3) NULL,
    ADD COLUMN `usedForDeduction` BOOLEAN NOT NULL DEFAULT false;
