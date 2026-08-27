-- Replace the single ticket owner with a tracked many-to-many assignment team.
CREATE TABLE `ticket_assignees` (
    `ticketId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_assignees_userId_assignedAt_idx`(`userId`, `assignedAt`),
    INDEX `ticket_assignees_assignedById_idx`(`assignedById`),
    PRIMARY KEY (`ticketId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve every existing single assignee as a member of the new assignment team.
INSERT INTO `ticket_assignees` (`ticketId`, `userId`, `assignedById`, `assignedAt`)
SELECT `id`, `assigneeId`, NULL, `updatedAt`
FROM `tickets`
WHERE `assigneeId` IS NOT NULL;

ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_assigneeId_fkey`;
DROP INDEX `tickets_assigneeId_status_idx` ON `tickets`;
ALTER TABLE `tickets` DROP COLUMN `assigneeId`;

ALTER TABLE `ticket_assignees` ADD CONSTRAINT `ticket_assignees_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_assignees` ADD CONSTRAINT `ticket_assignees_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_assignees` ADD CONSTRAINT `ticket_assignees_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
