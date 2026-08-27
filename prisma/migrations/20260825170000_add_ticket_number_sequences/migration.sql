-- Atomic monthly counters produce readable ticket references such as
-- TKT-202608-IT-00042 without exposing employee identifiers.
CREATE TABLE `ticket_sequences` (
    `period` VARCHAR(191) NOT NULL,
    `serviceCode` VARCHAR(191) NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`period`, `serviceCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
