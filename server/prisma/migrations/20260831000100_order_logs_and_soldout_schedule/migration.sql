ALTER TABLE `Product` ADD COLUMN `soldOutUntil` DATETIME(3) NULL;

CREATE TABLE `OrderStatusLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `status` ENUM('UNPAID', 'PAID', 'MAKING', 'READY', 'COMPLETED', 'REFUNDING', 'REFUNDED', 'CANCELLED') NOT NULL,
  `source` VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OrderStatusLog_orderId_createdAt_idx`(`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderStatusLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `OrderStatusLog` (`orderId`, `status`, `source`, `createdAt`)
SELECT `id`, `status`, 'MIGRATION', `updatedAt` FROM `Order`;
