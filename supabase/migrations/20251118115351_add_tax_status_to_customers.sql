-- Migration: Add tax_status to customers table for SEZ support
--
-- CRITICAL: Enables marking customers as SEZ Unit/Developer for zero-rated supply logic
-- This completes the tax calculation engine's ability to handle SEZ scenarios
--
-- Uses the existing tax_status enum (registered_regular, registered_composition, sez_unit, sez_developer, unregistered, consumer)

BEGIN;

-- Add tax_status column to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tax_status public.tax_status;

-- Add index for tax_status filtering (useful for SEZ customer queries)
CREATE INDEX IF NOT EXISTS idx_customers_tax_status
  ON public.customers(org_id, tax_status)
  WHERE tax_status IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.customers.tax_status IS 
'Customer tax status - Used to determine if customer is SEZ Unit/Developer for zero-rated supply logic. Values: registered_regular, registered_composition, sez_unit, sez_developer, unregistered, consumer.';

COMMIT;

