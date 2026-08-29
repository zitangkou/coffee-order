-- Each order can have at most one persisted successful payment.
-- Deployment intentionally fails if historical duplicate payment rows exist,
-- so operators can reconcile money records instead of deleting them silently.
CREATE UNIQUE INDEX `Payment_orderId_key` ON `Payment`(`orderId`);
