-- Migration: Add tax fields to customers and products for siloed architecture
--
-- CRITICAL: Ensures org-scoped tax fields for proper isolation
-- 
-- 1. customers: Add gst_number for B2B Input Tax Credit claims (org-specific)
-- 2. products: Add hsn_sac_code and tax_rate for org-specific tax treatment
--
-- This allows different orgs to have different tax treatments for the same master entity

BEGIN;

-- =====================================================
-- 1. Add gst_number to customers table
-- =====================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gst_number TEXT;

-- Add CHECK constraint for GSTIN format validation
ALTER TABLE public.customers
  ADD CONSTRAINT customers_gst_number_format_check
  CHECK (
    gst_number IS NULL OR
    gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
  );

-- Add index for GSTIN lookups
CREATE INDEX IF NOT EXISTS idx_customers_gst_number
  ON public.customers(org_id, gst_number)
  WHERE gst_number IS NOT NULL;

-- =====================================================
-- 2. Add hsn_sac_code and tax_rate to products table
-- =====================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_sac_code TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);

-- Add CHECK constraint for tax_rate (0-28% as per Indian GST)
ALTER TABLE public.products
  ADD CONSTRAINT products_tax_rate_check
  CHECK (
    tax_rate IS NULL OR
    (tax_rate >= 0 AND tax_rate <= 28)
  );

-- Add CHECK constraint for HSN/SAC code format
-- HSN: 4, 6, or 8 digits (goods)
-- SAC: 6 digits starting with 99 (services)
ALTER TABLE public.products
  ADD CONSTRAINT products_hsn_sac_code_format_check
  CHECK (
    hsn_sac_code IS NULL OR
    hsn_sac_code ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8}|99[0-9]{4})$'
  );

-- Add index for HSN/SAC code lookups
CREATE INDEX IF NOT EXISTS idx_products_hsn_sac_code
  ON public.products(org_id, hsn_sac_code)
  WHERE hsn_sac_code IS NOT NULL;

-- Add index for tax_rate filtering
CREATE INDEX IF NOT EXISTS idx_products_tax_rate
  ON public.products(org_id, tax_rate)
  WHERE tax_rate IS NOT NULL;

-- =====================================================
-- 3. Update column comments
-- =====================================================

COMMENT ON COLUMN public.customers.gst_number IS 
'GST Registration Number (GSTIN) - Org-specific GSTIN for B2B transactions. Required for Input Tax Credit claims. Format: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}.';

COMMENT ON COLUMN public.customers.billing_address IS 
'Billing address - Must include state for Place of Supply (POS) determination in GST calculations.';

COMMENT ON COLUMN public.products.hsn_sac_code IS 
'HSN/SAC Code - Harmonized System Nomenclature (goods) or Service Accounting Code (services). Format: 4/6/8 digits for HSN, 99XXXX for SAC. Org-specific to allow different tax treatments.';

COMMENT ON COLUMN public.products.tax_rate IS 
'Tax rate percentage (0-28%) - Org-specific GST rate. Allows same product to have different tax rates in different orgs (e.g., 18% in Regular GST org, 0% in SEZ org).';

COMMIT;

