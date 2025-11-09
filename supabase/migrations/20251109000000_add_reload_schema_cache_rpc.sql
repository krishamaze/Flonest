-- RPC: Reload PostgREST schema cache
-- This function notifies PostgREST to reload its schema cache
-- Useful when schema changes or cache becomes stale

BEGIN;

CREATE OR REPLACE FUNCTION reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify PostgREST to reload schema cache
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reload_schema_cache() TO authenticated;

COMMIT;

