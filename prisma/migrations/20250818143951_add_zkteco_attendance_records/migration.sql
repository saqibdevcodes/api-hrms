-- AlterTable
ALTER TABLE `attendances` ADD COLUMN `deviceCheckIns` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `deviceCheckOuts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastDeviceSync` DATETIME(3) NULL,
    ADD COLUMN `overtimeHours` DECIMAL(5, 2) NULL,
    ADD COLUMN `totalHours` DECIMAL(5, 2) NULL,
    MODIFY `date` DATE NOT NULL;

-- CreateTable
CREATE TABLE `zkteco_attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `checkType` ENUM('check_in', 'check_out', 'break_out', 'break_in', 'overtime_in', 'overtime_out') NOT NULL,
    `verifyType` INTEGER NOT NULL,
    `workCode` VARCHAR(191) NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `processingError` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `attendanceId` VARCHAR(191) NULL,

    INDEX `zkteco_attendance_records_employeeId_idx`(`employeeId`),
    INDEX `zkteco_attendance_records_deviceId_idx`(`deviceId`),
    INDEX `zkteco_attendance_records_timestamp_idx`(`timestamp`),
    INDEX `zkteco_attendance_records_processed_idx`(`processed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records` ADD CONSTRAINT `zkteco_attendance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records` ADD CONSTRAINT `zkteco_attendance_records_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `attendances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
