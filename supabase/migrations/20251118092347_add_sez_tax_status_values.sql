-- Migration: Add SEZ (Special Economic Zone) support to tax_status enum
-- Adds sez_unit and sez_developer values for zero-rated supplies (exports/SEZ)
-- Required for Indian SaaS and service entities operating in SEZs

-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block in older PostgreSQL versions
-- This migration uses DO block to handle the addition safely

DO $$ 
BEGIN
  -- Add sez_unit enum value (if it doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'sez_unit' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tax_status')
  ) THEN
    ALTER TYPE public.tax_status ADD VALUE 'sez_unit';
  END IF;

  -- Add sez_developer enum value (if it doesn't exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'sez_developer' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tax_status')
  ) THEN
    ALTER TYPE public.tax_status ADD VALUE 'sez_developer';
  END IF;
END $$;

-- Update comments to reflect SEZ support
COMMENT ON TYPE public.tax_status IS 'Tax registration status enum: registered_regular (standard GST), registered_composition (flat rate), sez_unit (SEZ unit - zero-rated), sez_developer (SEZ developer - zero-rated), unregistered (below threshold), or consumer (personal use).';

COMMENT ON COLUMN public.orgs.tax_status IS 'Tax registration status: registered_regular (standard GST), registered_composition (flat rate), sez_unit (SEZ unit - zero-rated supplies), sez_developer (SEZ developer - zero-rated supplies), unregistered (below threshold), or consumer (personal use).';

COMMENT ON COLUMN public.orgs.gst_number IS 'GST Registration Number (GSTIN) - Maps to tax_registration_number. Applicable when tax_status is registered_regular, registered_composition, sez_unit, or sez_developer.';

