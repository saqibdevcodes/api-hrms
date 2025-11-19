-- Add profilePicture field to users table
ALTER TABLE `users` ADD COLUMN `profilePicture` VARCHAR(191) NULL AFTER `employmentTypeId`;

