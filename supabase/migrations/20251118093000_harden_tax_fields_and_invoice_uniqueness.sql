-- Migration: Harden tax field validation and fix invoice number uniqueness
-- 
-- 1. Adds CHECK constraints for PAN and GSTIN format validation
-- 2. Adds UNIQUE constraint on (org_id, invoice_number) for proper sequence isolation
--
-- CRITICAL: This fixes the broken invoice numbering for multi-org users

BEGIN;

-- =====================================================
-- 1. Add CHECK constraints for tax identifier validation
-- =====================================================

-- PAN validation: [A-Z]{5}[0-9]{4}[A-Z]{1}
-- Only enforce when tax_identifier is not null
ALTER TABLE public.orgs
  ADD CONSTRAINT orgs_tax_identifier_format_check
  CHECK (
    tax_identifier IS NULL OR
    tax_identifier ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
  );

-- GSTIN validation: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
-- Only enforce when gst_number is not null
ALTER TABLE public.orgs
  ADD CONSTRAINT orgs_gst_number_format_check
  CHECK (
    gst_number IS NULL OR
    gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
  );

-- =====================================================
-- 2. Fix invoice number uniqueness - CRITICAL FIX
-- =====================================================

-- Add unique constraint on (org_id, invoice_number)
-- This ensures invoice numbers are isolated per organization
-- Only enforce when invoice_number is not null (drafts may not have numbers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_org_number_unique
  ON public.invoices(org_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_invoices_org_number_unique IS 
'Ensures invoice numbers are unique per organization. Critical for multi-org siloed architecture. Allows NULL invoice_number for drafts.';

-- =====================================================
-- 3. Update column comments for clarity
-- =====================================================

COMMENT ON COLUMN public.orgs.tax_identifier IS 
'Permanent Account Number (PAN) - Format: [A-Z]{5}[0-9]{4}[A-Z]{1}. Multiple orgs can share the same PAN (same legal entity, different trades).';

COMMENT ON COLUMN public.orgs.gst_number IS 
'GST Registration Number (GSTIN) - Format: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}. Only applicable when tax_status is registered_regular, registered_composition, sez_unit, or sez_developer.';

COMMENT ON COLUMN public.invoices.invoice_number IS 
'Invoice number - Must be unique within the organization (org_id). Format is typically INV-YYYYMMDD-XXX but can be customized per org.';

COMMIT;

