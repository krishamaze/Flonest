-- Migration: Create master_product_reviews table
-- Audit trail for master product approval workflow

BEGIN;

-- Create master_product_reviews table
CREATE TABLE IF NOT EXISTS master_product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id uuid NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'edited', 'auto_passed', 'migrated')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz DEFAULT now(),
  note text,
  field_changes jsonb, -- Stores diff of changed fields
  previous_approval_status text,
  new_approval_status text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_master_product_reviews_product ON master_product_reviews(master_product_id);
CREATE INDEX IF NOT EXISTS idx_master_product_reviews_reviewed_by ON master_product_reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_master_product_reviews_reviewed_at ON master_product_reviews(reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_product_reviews_action ON master_product_reviews(action);

-- Enable RLS
ALTER TABLE master_product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - Internal users only
DROP POLICY IF EXISTS "master_product_reviews_read_internal" ON master_product_reviews;
CREATE POLICY "master_product_reviews_read_internal" ON master_product_reviews
FOR SELECT
USING (is_internal_user(auth.uid()));

-- RLS Policy: INSERT - Internal users only (direct inserts)
-- Note: RPC functions using SECURITY DEFINER can insert regardless of this policy
-- This policy only affects direct client inserts
DROP POLICY IF EXISTS "master_product_reviews_insert_internal" ON master_product_reviews;
CREATE POLICY "master_product_reviews_insert_internal" ON master_product_reviews
FOR INSERT
WITH CHECK (is_internal_user(auth.uid()));

-- RLS Policy: UPDATE/DELETE - Internal users only
DROP POLICY IF EXISTS "master_product_reviews_write_internal" ON master_product_reviews;
CREATE POLICY "master_product_reviews_write_internal" ON master_product_reviews
FOR ALL
USING (is_internal_user(auth.uid()))
WITH CHECK (is_internal_user(auth.uid()));

COMMIT;

