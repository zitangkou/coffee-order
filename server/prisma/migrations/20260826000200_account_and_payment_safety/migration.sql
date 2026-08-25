-- Account lifecycle fields and payment callback idempotency.
-- The unique index intentionally fails if historical transaction IDs contain duplicates;
-- inspect and reconcile those rows before retrying the migration.

ALTER TABLE `User`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Payment_transactionId_key` ON `Payment`(`transactionId`);
