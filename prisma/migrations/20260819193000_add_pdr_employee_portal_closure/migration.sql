ALTER TABLE `pdr`
  ADD COLUMN `employeePortalClosesAt` DATETIME(3) NULL,
  ADD COLUMN `employeePortalClosedBy` VARCHAR(191) NULL;

CREATE INDEX `pdr_employeePortalClosesAt_idx`
  ON `pdr`(`employeePortalClosesAt`);
