-- Create app_versions table for version tracking
-- Keeps frontend and backend versions in sync

BEGIN;

CREATE TABLE IF NOT EXISTS app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  release_notes text,
  released_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast current version lookup
CREATE INDEX IF NOT EXISTS idx_app_versions_current ON app_versions(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_app_versions_released_at ON app_versions(released_at DESC);

-- Enable RLS (read-only for all authenticated users)
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_versions_read_all" ON app_versions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RPC to get current version
CREATE OR REPLACE FUNCTION get_current_app_version()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version record;
BEGIN
  SELECT version, release_notes, released_at
  INTO v_version
  FROM app_versions
  WHERE is_current = true
  ORDER BY released_at DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    RETURN jsonb_build_object(
      'version', '1.0.0',
      'release_notes', 'Initial release',
      'released_at', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'version', v_version.version,
    'release_notes', v_version.release_notes,
    'released_at', v_version.released_at
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_current_app_version TO authenticated;

-- Insert initial version
INSERT INTO app_versions (version, release_notes, is_current)
VALUES ('1.0.0', 'Initial release with inventory, invoices, and serial tracking', true)
ON CONFLICT (version) DO NOTHING;

COMMIT;

