-- Migration: Create hsn_master table
-- HSN master catalog with GST rates
-- Read-only for all authenticated users, write-only for internal users

BEGIN;

-- Create hsn_master table
CREATE TABLE IF NOT EXISTS hsn_master (
  hsn_code text PRIMARY KEY,
  description text NOT NULL,
  gst_rate numeric(5,2) NOT NULL CHECK (gst_rate >= 0 AND gst_rate <= 28),
  category text,
  chapter_code text,
  is_active boolean DEFAULT true,
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hsn_master_category ON hsn_master(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hsn_master_active ON hsn_master(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hsn_master_gst_rate ON hsn_master(gst_rate);

-- Enable RLS
ALTER TABLE hsn_master ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - All authenticated users can read active HSN codes
DROP POLICY IF EXISTS "hsn_master_read" ON hsn_master;
CREATE POLICY "hsn_master_read" ON hsn_master
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- RLS Policy: INSERT/UPDATE/DELETE - Internal users only
-- Note: This will be updated after is_internal_user() function is created
-- For now, we'll use a placeholder that blocks all writes
-- This will be updated in migration 3 (add_internal_user_flag.sql)
DROP POLICY IF EXISTS "hsn_master_write_internal" ON hsn_master;
-- Temporarily block all writes until internal user function exists
-- Will be updated in a later migration

COMMIT;

