-- AlterTable
ALTER TABLE `AdvanceSalary` MODIFY `reason` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `attendance_deductions` MODIFY `deductionReason` TEXT NOT NULL,
    MODIFY `zktecoRecordIds` TEXT NULL;

-- AlterTable
ALTER TABLE `attendance_reasons` MODIFY `reason` TEXT NULL,
    MODIFY `reasonDetails` TEXT NULL,
    MODIFY `taskDetail` TEXT NULL,
    MODIFY `fieldAddress` TEXT NULL,
    MODIFY `reasonComment` TEXT NULL;

-- AlterTable
ALTER TABLE `attendances` MODIFY `reason` TEXT NULL,
    MODIFY `notes` TEXT NULL;

-- AlterTable
ALTER TABLE `contract_types` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `departments` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `designations` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `employment_types` MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `leave_requests` MODIFY `reason` TEXT NOT NULL,
    MODIFY `comments` TEXT NULL;

-- AlterTable
ALTER TABLE `loans` MODIFY `reason` TEXT NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `message` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `off_days` MODIFY `reason` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `pdr_comments` MODIFY `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `pdr_status_transitions` MODIFY `comment` TEXT NULL;

-- AlterTable
ALTER TABLE `pdrgoalstask` MODIFY `task` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `pdroverallcomment` MODIFY `comment` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `pdrpersonalquality` MODIFY `comment` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `performance_reviews` MODIFY `feedback` TEXT NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `personalAddress` TEXT NULL,
    MODIFY `address` TEXT NULL,
    MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR';

-- AlterTable
ALTER TABLE `zkteco_attendance_records` MODIFY `processingError` TEXT NULL;

-- AlterTable
ALTER TABLE `zkteco_attendance_staging` MODIFY `processingError` TEXT NULL;
