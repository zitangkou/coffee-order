-- Invalidate admin sessions after account changes and protect SMS codes at rest.
ALTER TABLE `Admin`
  ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `SmsCode`
  MODIFY `code` VARCHAR(64) NOT NULL,
  ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;
