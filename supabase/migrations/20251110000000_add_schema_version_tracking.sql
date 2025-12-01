-- Add schema version tracking to app_versions table
-- Enables separate tracking of database schema changes from app version changes
--
BEGIN;

-- Add schema_version column to track database structure changes
ALTER TABLE app_versions
ADD COLUMN IF NOT EXISTS schema_version text;

-- Add rollback_sql column to store rollback SQL for schema migrations
ALTER TABLE app_versions
ADD COLUMN IF NOT EXISTS rollback_sql text;

-- Add comment explaining schema versioning
COMMENT ON COLUMN app_versions.schema_version IS 'Database schema version (e.g., "2.3.0"). Tracks structural database changes separately from app version. Uses semantic versioning: major (breaking), minor (additive), patch (non-breaking).';
COMMENT ON COLUMN app_versions.rollback_sql IS 'SQL to rollback schema changes. Stored for easy access during rollback procedures.';

-- Update existing rows to set initial schema version
-- Assuming current schema is version 1.0.0 (initial release)
UPDATE app_versions
SET schema_version = '1.0.0'
WHERE schema_version IS NULL
  AND is_current = true;

-- Add index on schema_version for queries
CREATE INDEX IF NOT EXISTS idx_app_versions_schema_version 
ON app_versions(schema_version) 
WHERE schema_version IS NOT NULL;

-- Update get_current_app_version() to return schema_version
CREATE OR REPLACE FUNCTION get_current_app_version()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version record;
BEGIN
  SELECT version, release_notes, released_at, schema_version
  INTO v_version
  FROM app_versions
  WHERE is_current = true
  ORDER BY released_at DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    RETURN jsonb_build_object(
      'version', '1.0.0',
      'release_notes', 'Initial release',
      'released_at', now(),
      'schema_version', '1.0.0'
    );
  END IF;

  RETURN jsonb_build_object(
    'version', v_version.version,
    'release_notes', v_version.release_notes,
    'released_at', v_version.released_at,
    'schema_version', COALESCE(v_version.schema_version, '1.0.0')
  );
END;
$$;

-- Update update_app_version() to accept optional schema_version and rollback_sql
CREATE OR REPLACE FUNCTION update_app_version(
  new_version text,
  release_notes text DEFAULT NULL,
  schema_version text DEFAULT NULL,
  rollback_sql text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_current_schema_version text;
  v_final_schema_version text;
BEGIN
  -- Get current schema version before update (default to '1.0.0' if none exists)
  SELECT COALESCE(av.schema_version, '1.0.0')
  INTO v_current_schema_version
  FROM app_versions av
  WHERE av.is_current = true
  LIMIT 1;
  
  -- If no current version exists, default to '1.0.0'
  IF v_current_schema_version IS NULL THEN
    v_current_schema_version := '1.0.0';
  END IF;

  -- Determine final schema version: use provided schema_version or keep current
  v_final_schema_version := COALESCE(schema_version, v_current_schema_version);

  -- Set all existing versions to not current
  UPDATE app_versions
  SET is_current = false,
      updated_at = now()
  WHERE is_current = true;

  -- Insert or update new version
  INSERT INTO app_versions (version, release_notes, is_current, released_at, schema_version, rollback_sql)
  VALUES (
    new_version, 
    release_notes, 
    true, 
    now(),
    v_final_schema_version,
    rollback_sql
  )
  ON CONFLICT (version) DO UPDATE
    SET is_current = true,
        release_notes = COALESCE(EXCLUDED.release_notes, app_versions.release_notes),
        released_at = COALESCE(EXCLUDED.released_at, app_versions.released_at),
        updated_at = now(),
        schema_version = COALESCE(EXCLUDED.schema_version, app_versions.schema_version),
        rollback_sql = COALESCE(EXCLUDED.rollback_sql, app_versions.rollback_sql);

  -- Return success status with both versions
  RETURN jsonb_build_object(
    'success', true,
    'version', new_version,
    'schema_version', v_final_schema_version,
    'message', 'Version updated successfully'
  );
END;
$$;

-- Grant execute permission
-- Note: Specify parameter types for update_app_version to avoid ambiguity with overloaded functions
GRANT EXECUTE ON FUNCTION get_current_app_version() TO authenticated;
GRANT EXECUTE ON FUNCTION update_app_version(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION update_app_version(text, text, text, text) TO authenticated;

COMMIT;

