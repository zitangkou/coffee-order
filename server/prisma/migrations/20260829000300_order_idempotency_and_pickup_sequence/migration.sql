-- Make new order requests idempotent and allocate collision-free pickup numbers per business day.
ALTER TABLE `Order`
  ADD COLUMN `pickupKey` VARCHAR(32) NULL,
  ADD COLUMN `businessDate` CHAR(8) NULL,
  ADD COLUMN `clientRequestId` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `Order_pickupKey_key` ON `Order`(`pickupKey`);
CREATE UNIQUE INDEX `Order_userId_clientRequestId_key` ON `Order`(`userId`, `clientRequestId`);

CREATE TABLE `DailySequence` (
  `businessDate` CHAR(8) NOT NULL,
  `pickupValue` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`businessDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
