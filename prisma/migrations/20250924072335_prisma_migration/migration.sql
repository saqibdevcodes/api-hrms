-- DropIndex
DROP INDEX `AdvanceSalary_userId_fkey` ON `advancesalary`;

-- DropIndex
DROP INDEX `attendance_reason_attachments_attendanceReasonId_fkey` ON `attendance_reason_attachments`;

-- DropIndex
DROP INDEX `attendances_attendanceDeductionId_fkey` ON `attendances`;

-- DropIndex
DROP INDEX `attendances_attendanceReasonId_fkey` ON `attendances`;

-- DropIndex
DROP INDEX `employee_leaves_leavePolicyId_fkey` ON `employee_leaves`;

-- DropIndex
DROP INDEX `leave_requests_employeeId_fkey` ON `leave_requests`;

-- DropIndex
DROP INDEX `loans_userId_fkey` ON `loans`;

-- DropIndex
DROP INDEX `notifications_userId_fkey` ON `notifications`;

-- DropIndex
DROP INDEX `payroll_records_employeeId_fkey` ON `payroll_records`;

-- DropIndex
DROP INDEX `Pdr_director_id_fkey` ON `pdr`;

-- DropIndex
DROP INDEX `Pdr_linemanager_id_fkey` ON `pdr`;

-- DropIndex
DROP INDEX `Pdr_userId_fkey` ON `pdr`;

-- DropIndex
DROP INDEX `PdrComment_pdr_id_fkey` ON `pdrcomment`;

-- DropIndex
DROP INDEX `PdrGoalsTask_pdr_id_fkey` ON `pdrgoalstask`;

-- DropIndex
DROP INDEX `PdrGoalsTasksComment_pdr_id_fkey` ON `pdrgoalstaskscomment`;

-- DropIndex
DROP INDEX `PdrOverallComment_pdr_id_fkey` ON `pdroverallcomment`;

-- DropIndex
DROP INDEX `PdrPersonalQuality_pdr_id_fkey` ON `pdrpersonalquality`;

-- DropIndex
DROP INDEX `performance_reviews_employeeId_fkey` ON `performance_reviews`;

-- DropIndex
DROP INDEX `users_contractTypeId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_departmentId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_designationId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_educationalDetailId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_emergencyDetailId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_employmentTypeId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_leaveId_fkey` ON `users`;

-- DropIndex
DROP INDEX `users_shiftId_fkey` ON `users`;

-- DropIndex
DROP INDEX `zkteco_attendance_records_attendanceId_fkey` ON `zkteco_attendance_records`;

-- DropIndex
DROP INDEX `zkteco_attendance_records_userId_fkey` ON `zkteco_attendance_records`;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_emergencyDetailId_fkey` FOREIGN KEY (`emergencyDetailId`) REFERENCES `emergency_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_contractTypeId_fkey` FOREIGN KEY (`contractTypeId`) REFERENCES `contract_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_leaveId_fkey` FOREIGN KEY (`leaveId`) REFERENCES `leave_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employmentTypeId_fkey` FOREIGN KEY (`employmentTypeId`) REFERENCES `employment_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_educationalDetailId_fkey` FOREIGN KEY (`educationalDetailId`) REFERENCES `educational_details`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leaves` ADD CONSTRAINT `employee_leaves_leavePolicyId_fkey` FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_attendanceDeductionId_fkey` FOREIGN KEY (`attendanceDeductionId`) REFERENCES `attendance_deductions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records` ADD CONSTRAINT `zkteco_attendance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zkteco_attendance_records` ADD CONSTRAINT `zkteco_attendance_records_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `attendances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reason_attachments` ADD CONSTRAINT `attendance_reason_attachments_attendanceReasonId_fkey` FOREIGN KEY (`attendanceReasonId`) REFERENCES `attendance_reasons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_records` ADD CONSTRAINT `payroll_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_reviews` ADD CONSTRAINT `performance_reviews_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvanceSalary` ADD CONSTRAINT `AdvanceSalary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdr` ADD CONSTRAINT `Pdr_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdr` ADD CONSTRAINT `Pdr_linemanager_id_fkey` FOREIGN KEY (`linemanager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pdr` ADD CONSTRAINT `Pdr_director_id_fkey` FOREIGN KEY (`director_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrComment` ADD CONSTRAINT `PdrComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrPersonalQuality` ADD CONSTRAINT `PdrPersonalQuality_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrGoalsTask` ADD CONSTRAINT `PdrGoalsTask_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrGoalsTasksComment` ADD CONSTRAINT `PdrGoalsTasksComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdrOverallComment` ADD CONSTRAINT `PdrOverallComment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `Pdr`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
