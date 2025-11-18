-- Migration: Add structured state_code to orgs and customers for Place of Supply logic
--
-- CRITICAL: GST calculation (IGST vs CGST+SGST) requires comparing org state_code with customer state_code
-- This is a prerequisite for automated tax calculations in the invoicing engine
--
-- State codes: 2-digit numeric codes (01-37) as per Indian GST system
-- Examples: 27 = Maharashtra, 33 = Tamil Nadu, 32 = Kerala

BEGIN;

-- =====================================================
-- 1. Add state_code to orgs table
-- =====================================================

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);

-- Add CHECK constraint for 2-digit state codes (01-37 for Indian states)
ALTER TABLE public.orgs
  ADD CONSTRAINT orgs_state_code_format_check
  CHECK (
    state_code IS NULL OR
    (state_code ~ '^[0-9]{2}$' AND state_code::integer BETWEEN 1 AND 37)
  );

-- Add index for state_code lookups
CREATE INDEX IF NOT EXISTS idx_orgs_state_code
  ON public.orgs(state_code)
  WHERE state_code IS NOT NULL;

-- =====================================================
-- 2. Add state_code to customers table
-- =====================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);

-- Add CHECK constraint for 2-digit state codes (01-37 for Indian states)
ALTER TABLE public.customers
  ADD CONSTRAINT customers_state_code_format_check
  CHECK (
    state_code IS NULL OR
    (state_code ~ '^[0-9]{2}$' AND state_code::integer BETWEEN 1 AND 37)
  );

-- Add index for state_code lookups (critical for POS logic)
CREATE INDEX IF NOT EXISTS idx_customers_state_code
  ON public.customers(org_id, state_code)
  WHERE state_code IS NOT NULL;

-- =====================================================
-- 3. Update column comments
-- =====================================================

COMMENT ON COLUMN public.orgs.state IS 
'State name (legacy field) - Full state name or abbreviation. Kept for backward compatibility. Use state_code for tax calculations.';

COMMENT ON COLUMN public.orgs.state_code IS 
'State code (2-digit) - Indian GST state code (01-37). CRITICAL for Place of Supply (POS) logic. Required for IGST vs CGST+SGST determination. Examples: 27=Maharashtra, 33=Tamil Nadu, 32=Kerala.';

COMMENT ON COLUMN public.customers.billing_address IS 
'Billing address - Full address text. Use state_code for automated POS determination.';

COMMENT ON COLUMN public.customers.state_code IS 
'State code (2-digit) - Indian GST state code (01-37). CRITICAL for Place of Supply (POS) logic. Required for comparing with org.state_code to determine IGST vs CGST+SGST. Examples: 27=Maharashtra, 33=Tamil Nadu, 32=Kerala.';

COMMIT;

