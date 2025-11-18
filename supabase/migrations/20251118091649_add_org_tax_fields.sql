-- Migration: Add tax identifier (PAN) and tax status to organizations
-- Implements Multi-Organization Architecture for Indian GST compliance
-- Each organization is a siloed legal entity with independent tax settings

BEGIN;

-- Create tax_status enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.tax_status AS ENUM (
    'registered_regular',    -- Standard GST registration
    'registered_composition', -- Composition scheme (flat rate, no ITC)
    'unregistered',          -- Below threshold/Exempt
    'consumer'               -- Personal use
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add tax_identifier (PAN) column
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS tax_identifier TEXT;

-- Add tax_status column with default
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS tax_status public.tax_status DEFAULT 'unregistered';

-- Migrate existing data: Set tax_status based on current gst_enabled and gst_number
-- If org has GSTIN, assume registered_regular (can be updated later)
-- If no GSTIN but gst_enabled=true, set to unregistered (legacy data cleanup)
-- Otherwise, keep as unregistered
UPDATE public.orgs
SET tax_status = CASE
  WHEN gst_number IS NOT NULL AND trim(gst_number) != '' THEN 'registered_regular'::public.tax_status
  ELSE 'unregistered'::public.tax_status
END
WHERE tax_status IS NULL;

-- Add index on tax_identifier for future compliance dashboard queries
CREATE INDEX IF NOT EXISTS idx_orgs_tax_identifier
  ON public.orgs(tax_identifier)
  WHERE tax_identifier IS NOT NULL;

-- Add index on tax_status for filtering
CREATE INDEX IF NOT EXISTS idx_orgs_tax_status
  ON public.orgs(tax_status);

-- Add comments for documentation
COMMENT ON COLUMN public.orgs.tax_identifier IS 'Permanent Account Number (PAN) - Legal tax identifier for the organization. Multiple orgs can share the same PAN (same legal entity, different trades).';
COMMENT ON TYPE public.tax_status IS 'Tax registration status enum: registered_regular (standard GST), registered_composition (flat rate), unregistered (below threshold), or consumer (personal use).';
COMMENT ON COLUMN public.orgs.tax_status IS 'Tax registration status: registered_regular (standard GST), registered_composition (flat rate), unregistered (below threshold), or consumer (personal use).';
COMMENT ON COLUMN public.orgs.gst_number IS 'GST Registration Number (GSTIN) - Maps to tax_registration_number. Only applicable when tax_status is registered_regular or registered_composition.';

COMMIT;

