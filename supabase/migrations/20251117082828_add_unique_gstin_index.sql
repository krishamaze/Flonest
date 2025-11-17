-- Add unique partial index on gst_number to prevent duplicate GSTINs
-- Only applies to non-null GSTINs (allows multiple orgs with NULL GSTIN)

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_gst_number_unique 
ON public.orgs(gst_number) 
WHERE gst_number IS NOT NULL;

COMMENT ON INDEX idx_orgs_gst_number_unique IS 'Ensures each GSTIN can only be registered to one organization. NULL values are excluded (multiple unregistered orgs allowed).';

COMMIT;

