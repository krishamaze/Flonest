-- RPC: Update app version
-- Automatically updates the current app version in the database
-- Used by GitHub Actions after deployment to sync frontend/backend versions
--
BEGIN;

-- Function to update app version
CREATE OR REPLACE FUNCTION update_app_version(
  new_version text,
  release_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Set all existing versions to not current
  UPDATE app_versions
  SET is_current = false,
      updated_at = now()
  WHERE is_current = true;

  -- Insert or update new version
  INSERT INTO app_versions (version, release_notes, is_current, released_at)
  VALUES (new_version, release_notes, true, now())
  ON CONFLICT (version) DO UPDATE
    SET is_current = true,
        release_notes = COALESCE(EXCLUDED.release_notes, app_versions.release_notes),
        released_at = COALESCE(EXCLUDED.released_at, app_versions.released_at),
        updated_at = now();

  -- Return success status
  RETURN jsonb_build_object(
    'success', true,
    'version', new_version,
    'message', 'Version updated successfully'
  );
END;
$$;

-- Grant execute permission to service role (for GitHub Actions)
-- Note: Service role can bypass RLS, so this is secure for automated updates
GRANT EXECUTE ON FUNCTION update_app_version TO service_role;
GRANT EXECUTE ON FUNCTION update_app_version TO authenticated;

COMMIT;

