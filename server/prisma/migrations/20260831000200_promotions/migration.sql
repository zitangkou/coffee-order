ALTER TABLE `Order`
  ADD COLUMN `originalAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `discountAmount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN `promotionName` VARCHAR(100) NULL;

UPDATE `Order` SET `originalAmount` = `totalAmount` WHERE `originalAmount` = 0;

CREATE TABLE `Promotion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `config` JSON NOT NULL,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Promotion_isActive_startsAt_endsAt_idx`(`isActive`, `startsAt`, `endsAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
