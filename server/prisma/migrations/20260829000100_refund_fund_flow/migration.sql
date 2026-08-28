-- Separate refund review from the asynchronous WeChat fund result.
ALTER TABLE `Refund`
  MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `outRefundNo` VARCHAR(64) NULL,
  ADD COLUMN `wechatRefundId` VARCHAR(64) NULL,
  ADD COLUMN `refundAmount` DECIMAL(10, 2) NULL,
  ADD COLUMN `failureReason` VARCHAR(255) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `Refund_outRefundNo_key` ON `Refund`(`outRefundNo`);
