-- Add legal_name column to orgs table
-- Separates immutable GST-registered legal name from editable display/brand name

BEGIN;

-- Add legal_name column (nullable, populated from GST verification)
ALTER TABLE public.orgs
ADD COLUMN IF NOT EXISTS legal_name text;

-- Add comment explaining the distinction
COMMENT ON COLUMN public.orgs.legal_name IS 'GST-registered legal name (immutable after verification). Distinct from name (display/brand name which is editable).';

COMMENT ON COLUMN public.orgs.name IS 'Display/brand name (editable). Used in app UI. Distinct from legal_name (GST-registered name).';

COMMIT;

