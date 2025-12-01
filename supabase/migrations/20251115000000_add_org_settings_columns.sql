-- Add organization settings columns for profile management
-- Adds custom_logo_url, phone, and address fields
-- Renames gst_number to gstin for consistency

BEGIN;

-- Add custom logo URL column
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;

-- Add phone number column
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add business address column
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Rename gst_number to gstin for consistency (if not already renamed)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orgs' AND column_name = 'gst_number'
  ) THEN
    ALTER TABLE orgs RENAME COLUMN gst_number TO gstin;
  END IF;
END $$;

-- Add comment to custom_logo_url column
COMMENT ON COLUMN orgs.custom_logo_url IS 'Custom organization logo URL from storage. Falls back to default finetune logo if null';

COMMENT ON COLUMN orgs.phone IS 'Organization contact phone number';

COMMENT ON COLUMN orgs.address IS 'Organization business address';

COMMIT;

