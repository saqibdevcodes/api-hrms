-- Idempotent bootstrap for deployments that use `prisma db push`.
-- `db push` creates the schema but does not execute migration data backfills.

START TRANSACTION;

INSERT INTO `companies` (
    `id`,
    `name`,
    `description`,
    `isDefault`,
    `isActive`,
    `createdAt`,
    `updatedAt`
) VALUES (
    'company_iriscommunications',
    'iriscommunications',
    'Default HRMS company',
    true,
    true,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
    `isDefault` = true,
    `isActive` = true,
    `updatedAt` = CURRENT_TIMESTAMP(3);

-- Employees and master records can belong to more than one company, so these
-- inserts preserve all existing assignments while adding the default company.
INSERT IGNORE INTO `company_employees` (`companyId`, `userId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `users`
WHERE `employeeId` IS NOT NULL;

INSERT IGNORE INTO `company_departments` (`companyId`, `departmentId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `departments`;

INSERT IGNORE INTO `company_contract_types` (`companyId`, `contractTypeId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `contract_types`;

INSERT IGNORE INTO `company_shifts` (`companyId`, `shiftId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `shifts`;

INSERT IGNORE INTO `company_leave_policies` (`companyId`, `leavePolicyId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `leave_policies`;

INSERT IGNORE INTO `company_employment_types` (`companyId`, `employmentTypeId`, `assignedAt`)
SELECT 'company_iriscommunications', `id`, CURRENT_TIMESTAMP(3)
FROM `employment_types`;

COMMIT;
