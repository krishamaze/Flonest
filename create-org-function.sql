-- Create a function to create orgs that bypasses RLS
-- This is needed for initial org creation during signup

-- Drop existing function first
DROP FUNCTION IF EXISTS create_user_org(TEXT, TEXT, TEXT);

CREATE FUNCTION create_user_org(org_name TEXT, org_slug TEXT, org_state TEXT DEFAULT 'Default')
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  gst_number VARCHAR(15),
  gst_enabled BOOLEAN,
  state VARCHAR(50),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO orgs (name, slug, state, gst_enabled)
  VALUES (org_name, org_slug, org_state, false)
  RETURNING orgs.*;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_user_org(TEXT, TEXT, TEXT) TO authenticated;

