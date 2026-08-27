-- Expand notification types for ticket lifecycle alerts.
ALTER TABLE `notifications` MODIFY `type` ENUM(
    'LEAVE_REQUEST_SUBMITTED',
    'LEAVE_REQUEST_APPROVED',
    'LEAVE_REQUEST_REJECTED',
    'PAYROLL_PROCESSED',
    'PERFORMANCE_REVIEW_DUE',
    'ATTENDANCE_REMINDER',
    'SYSTEM_ANNOUNCEMENT',
    'BIRTHDAY_REMINDER',
    'WORK_ANNIVERSARY',
    'DOCUMENT_EXPIRY',
    'TASK_ASSIGNED',
    'MEETING_SCHEDULED',
    'PDR_CREATION',
    'PDR_SUBMISSION',
    'PDR_REVIEW',
    'PDR_APPROVAL',
    'PDR_REJECTED',
    'TICKET_CREATED',
    'TICKET_ASSIGNED',
    'TICKET_UPDATED',
    'TICKET_COMMENT',
    'TICKET_RESOLVED',
    'TICKET_SLA_BREACHED'
) NOT NULL;

CREATE TABLE `ticket_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT 'blue',
    `icon` VARCHAR(191) NOT NULL DEFAULT 'life-buoy',
    `supportEmail` VARCHAR(191) NULL,
    `routingDepartment` VARCHAR(191) NULL,
    `firstResponseMinutes` INTEGER NOT NULL DEFAULT 240,
    `resolutionMinutes` INTEGER NOT NULL DEFAULT 2880,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `companyId` VARCHAR(191) NULL,

    UNIQUE INDEX `ticket_categories_companyId_slug_key`(`companyId`, `slug`),
    INDEX `ticket_categories_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `impact` ENUM('SINGLE_USER', 'MULTIPLE_USERS', 'DEPARTMENT', 'COMPANY') NOT NULL DEFAULT 'SINGLE_USER',
    `channel` ENUM('PORTAL', 'EMAIL', 'PHONE', 'WALK_IN', 'SYSTEM') NOT NULL DEFAULT 'PORTAL',
    `customCategory` VARCHAR(191) NULL,
    `contactPreference` VARCHAR(191) NULL DEFAULT 'PORTAL_EMAIL',
    `firstResponseAt` DATETIME(3) NULL,
    `responseDueAt` DATETIME(3) NULL,
    `resolutionDueAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `reopenedAt` DATETIME(3) NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolutionSummary` TEXT NULL,
    `rootCause` TEXT NULL,
    `satisfactionRating` INTEGER NULL,
    `satisfactionComment` TEXT NULL,
    `isEscalated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,

    UNIQUE INDEX `tickets_ticketNumber_key`(`ticketNumber`),
    INDEX `tickets_requesterId_createdAt_idx`(`requesterId`, `createdAt`),
    INDEX `tickets_assigneeId_status_idx`(`assigneeId`, `status`),
    INDEX `tickets_companyId_status_priority_idx`(`companyId`, `status`, `priority`),
    INDEX `tickets_categoryId_status_idx`(`categoryId`, `status`),
    INDEX `tickets_resolutionDueAt_status_idx`(`resolutionDueAt`, `status`),
    INDEX `tickets_lastActivityAt_idx`(`lastActivityAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_comments` (
    `id` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `isEdited` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,

    INDEX `ticket_comments_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ticketId` VARCHAR(191) NOT NULL,
    `commentId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NOT NULL,

    INDEX `ticket_attachments_ticketId_idx`(`ticketId`),
    INDEX `ticket_attachments_commentId_idx`(`commentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_watchers` (
    `ticketId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_watchers_userId_idx`(`userId`),
    PRIMARY KEY (`ticketId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ticket_activities` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ticketId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,

    INDEX `ticket_activities_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ticket_categories` ADD CONSTRAINT `ticket_categories_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ticket_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `ticket_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ticket_watchers` ADD CONSTRAINT `ticket_watchers_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_watchers` ADD CONSTRAINT `ticket_watchers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_activities` ADD CONSTRAINT `ticket_activities_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticket_activities` ADD CONSTRAINT `ticket_activities_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Global categories are available to every company. Company-specific categories can
-- be added later without changing ticket records or API behavior.
INSERT INTO `ticket_categories` (`id`, `name`, `slug`, `description`, `color`, `icon`, `supportEmail`, `routingDepartment`, `firstResponseMinutes`, `resolutionMinutes`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
('ticket-category-it', 'IT & Systems', 'it-systems', 'Hardware, software, account access, network and security support.', 'blue', 'monitor-cog', 'it@iriscommunications.com', 'Technology', 60, 480, true, 10, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ticket-category-hr', 'People & HR', 'people-hr', 'Policies, benefits, employee records and workplace concerns.', 'violet', 'users', 'hr@iriscommunications.com', 'Human Resources', 240, 2880, true, 20, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ticket-category-payroll', 'Payroll & Finance', 'payroll-finance', 'Salary, deductions, reimbursements and finance queries.', 'emerald', 'wallet-cards', 'finance@iriscommunications.com', 'Finance', 240, 2880, true, 30, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ticket-category-facilities', 'Facilities & Admin', 'facilities-admin', 'Office access, equipment, maintenance, transport and supplies.', 'amber', 'building-2', 'admin@iriscommunications.com', 'Administration', 240, 1440, true, 40, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ticket-category-security', 'Security & Compliance', 'security-compliance', 'Information security, privacy, compliance and incident reporting.', 'rose', 'shield-alert', 'security@iriscommunications.com', 'Technology', 30, 240, true, 50, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('ticket-category-other', 'General Request', 'general-request', 'Requests that do not fit another service category.', 'slate', 'life-buoy', 'support@iriscommunications.com', NULL, 480, 4320, true, 90, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
