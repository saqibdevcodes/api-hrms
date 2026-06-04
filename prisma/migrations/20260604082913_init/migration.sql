/*
  Warnings:

  - You are about to alter the column `data` on the `notifications` table. The data in that column could be lost. The data in that column will be cast from `LongText` to `Json`.

*/
-- DropForeignKey
ALTER TABLE `pdr_comments` DROP FOREIGN KEY `pdr_comments_pdr_id_fkey`;

-- DropForeignKey
ALTER TABLE `pdrgoalstask` DROP FOREIGN KEY `pdrgoalstask_pdr_id_fkey`;

-- DropForeignKey
ALTER TABLE `pdroverallcomment` DROP FOREIGN KEY `pdroverallcomment_pdr_id_fkey`;

-- DropForeignKey
ALTER TABLE `pdrpersonalquality` DROP FOREIGN KEY `pdrpersonalquality_pdr_id_fkey`;

-- DropIndex
DROP INDEX `pdr_comments_pdr_id_fkey` ON `pdr_comments`;

-- DropIndex
DROP INDEX `pdrgoalstask_pdr_id_fkey` ON `pdrgoalstask`;

-- DropIndex
DROP INDEX `pdroverallcomment_pdr_id_fkey` ON `pdroverallcomment`;

-- DropIndex
DROP INDEX `pdrpersonalquality_pdr_id_fkey` ON `pdrpersonalquality`;

-- AlterTable
ALTER TABLE `notifications` MODIFY `data` JSON NULL;

-- AlterTable
ALTER TABLE `pdr_comments` MODIFY `commentType` VARCHAR(191) NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `users` MODIFY `country` VARCHAR(191) NOT NULL DEFAULT 'Pakistan',
    MODIFY `currency` VARCHAR(191) NOT NULL DEFAULT 'PKR';

-- AddForeignKey
ALTER TABLE `pdr_comments` ADD CONSTRAINT `pdr_comments_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdrpersonalquality` ADD CONSTRAINT `pdrpersonalquality_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdrgoalstask` ADD CONSTRAINT `pdrgoalstask_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdroverallcomment` ADD CONSTRAINT `pdroverallcomment_pdr_id_fkey` FOREIGN KEY (`pdr_id`) REFERENCES `pdr`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
