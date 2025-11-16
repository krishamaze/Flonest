-- Migration: Create category_map table
-- Maps product categories to suggested HSN codes
-- Read-only for all authenticated users, write-only for internal users

BEGIN;

-- Create category_map table
CREATE TABLE IF NOT EXISTS category_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  suggested_hsn_code text REFERENCES hsn_master(hsn_code),
  confidence_score numeric(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_map_category ON category_map(category_name);
CREATE INDEX IF NOT EXISTS idx_category_map_hsn ON category_map(suggested_hsn_code) WHERE suggested_hsn_code IS NOT NULL;

-- Enable RLS
ALTER TABLE category_map ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - All authenticated users can read
DROP POLICY IF EXISTS "category_map_read" ON category_map;
CREATE POLICY "category_map_read" ON category_map
FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS Policy: INSERT/UPDATE/DELETE - Internal users only
-- Note: This will be updated after is_internal_user() function is created
-- For now, we'll use a placeholder that blocks all writes
-- This will be updated in migration 3 (add_internal_user_flag.sql)
DROP POLICY IF EXISTS "category_map_write_internal" ON category_map;
-- Temporarily block all writes until internal user function exists
-- Will be updated in a later migration

COMMIT;

