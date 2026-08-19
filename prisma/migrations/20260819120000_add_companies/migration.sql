-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_name_key`(`name`),
    INDEX `companies_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_employees` (
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `company_employees_userId_idx`(`userId`),
    PRIMARY KEY (`companyId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `company_employees` ADD CONSTRAINT `company_employees_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_employees` ADD CONSTRAINT `company_employees_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create the initial company and preserve current HRMS behavior by assigning
-- every existing employee to it.
INSERT INTO `companies` (
    `id`, `name`, `description`, `isDefault`, `isActive`, `createdAt`, `updatedAt`
) VALUES (
    'company_iriscommunications',
    'iriscommunications',
    'Default HRMS company',
    true,
    true,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);

INSERT INTO `company_employees` (`companyId`, `userId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `users`
WHERE `employeeId` IS NOT NULL;
