-- Add pincode field to orgs table for first-time setup flow
-- Pincode is required for new orgs but nullable for backward compatibility with existing orgs

BEGIN;

-- Add pincode column (nullable for existing orgs)
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);

-- Optional: Add constraint for validation (can be added in future migration)
-- ALTER TABLE orgs
--   ADD CONSTRAINT orgs_pincode_check
--   CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$');

COMMENT ON COLUMN orgs.pincode IS '6-digit postal pincode for organization address (required for new orgs)';

COMMIT;

