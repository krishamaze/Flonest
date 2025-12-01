-- Add custom logo and additional org fields for settings page

BEGIN;

ALTER TABLE orgs 
  ADD COLUMN IF NOT EXISTS custom_logo_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;

-- Add comments
COMMENT ON COLUMN orgs.custom_logo_url IS 'URL to custom organization logo stored in Supabase storage';
COMMENT ON COLUMN orgs.phone IS 'Organization primary contact phone number';
COMMENT ON COLUMN orgs.address IS 'Organization primary business address';

-- Note: gstin is already available as gst_number column

COMMIT;
