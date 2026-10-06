-- Existing contract durations are expressed in months.
ALTER TABLE `contract_types`
    ADD COLUMN `durationUnit` ENUM('MONTH', 'YEAR') NOT NULL DEFAULT 'MONTH';
