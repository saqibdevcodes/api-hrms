-- Assign organizational master data to one or more companies.
CREATE TABLE `company_departments` (
    `companyId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `company_departments_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`companyId`, `departmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_contract_types` (
    `companyId` VARCHAR(191) NOT NULL,
    `contractTypeId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `company_contract_types_contractTypeId_idx`(`contractTypeId`),
    PRIMARY KEY (`companyId`, `contractTypeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_shifts` (
    `companyId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `company_shifts_shiftId_idx`(`shiftId`),
    PRIMARY KEY (`companyId`, `shiftId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_leave_policies` (
    `companyId` VARCHAR(191) NOT NULL,
    `leavePolicyId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `company_leave_policies_leavePolicyId_idx`(`leavePolicyId`),
    PRIMARY KEY (`companyId`, `leavePolicyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_employment_types` (
    `companyId` VARCHAR(191) NOT NULL,
    `employmentTypeId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `company_employment_types_employmentTypeId_idx`(`employmentTypeId`),
    PRIMARY KEY (`companyId`, `employmentTypeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `company_departments` ADD CONSTRAINT `company_departments_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_departments` ADD CONSTRAINT `company_departments_departmentId_fkey`
FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `company_contract_types` ADD CONSTRAINT `company_contract_types_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_contract_types` ADD CONSTRAINT `company_contract_types_contractTypeId_fkey`
FOREIGN KEY (`contractTypeId`) REFERENCES `contract_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `company_shifts` ADD CONSTRAINT `company_shifts_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_shifts` ADD CONSTRAINT `company_shifts_shiftId_fkey`
FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `company_leave_policies` ADD CONSTRAINT `company_leave_policies_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_leave_policies` ADD CONSTRAINT `company_leave_policies_leavePolicyId_fkey`
FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `company_employment_types` ADD CONSTRAINT `company_employment_types_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_employment_types` ADD CONSTRAINT `company_employment_types_employmentTypeId_fkey`
FOREIGN KEY (`employmentTypeId`) REFERENCES `employment_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing behavior by assigning every current master record to the
-- default company. New records are explicitly assigned by their CRUD APIs.
INSERT INTO `company_departments` (`companyId`, `departmentId`)
SELECT 'company_iriscommunications', `id` FROM `departments`;

INSERT INTO `company_contract_types` (`companyId`, `contractTypeId`)
SELECT 'company_iriscommunications', `id` FROM `contract_types`;

INSERT INTO `company_shifts` (`companyId`, `shiftId`)
SELECT 'company_iriscommunications', `id` FROM `shifts`;

INSERT INTO `company_leave_policies` (`companyId`, `leavePolicyId`)
SELECT 'company_iriscommunications', `id` FROM `leave_policies`;

INSERT INTO `company_employment_types` (`companyId`, `employmentTypeId`)
SELECT 'company_iriscommunications', `id` FROM `employment_types`;

-- A PDR belongs to exactly one company. Existing PDRs are retained under the
-- default company, while future duplicate checks include the company.
ALTER TABLE `pdr` ADD COLUMN `companyId` VARCHAR(191) NULL;
UPDATE `pdr` SET `companyId` = 'company_iriscommunications' WHERE `companyId` IS NULL;
ALTER TABLE `pdr` MODIFY `companyId` VARCHAR(191) NOT NULL DEFAULT 'company_iriscommunications';
DROP INDEX `pdr_userId_pdr_cycle_key` ON `pdr`;
CREATE UNIQUE INDEX `pdr_userId_pdr_cycle_companyId_key`
ON `pdr`(`userId`, `pdr_cycle`, `companyId`);
CREATE INDEX `pdr_companyId_idx` ON `pdr`(`companyId`);
ALTER TABLE `pdr` ADD CONSTRAINT `pdr_companyId_fkey`
FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
