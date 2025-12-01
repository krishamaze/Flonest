-- Migration: Add governance fields to master_products table
-- Adds approval workflow fields and audit trail

BEGIN;

-- Add approval_status column
ALTER TABLE master_products
ADD COLUMN IF NOT EXISTS approval_status text 
  CHECK (approval_status IN ('pending', 'auto_pass', 'approved', 'rejected')) 
  DEFAULT 'pending';

-- Add governance fields
ALTER TABLE master_products
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS submitted_org_id uuid REFERENCES orgs(id),
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update status constraint (remove 'pending' from status, it's now in approval_status)
ALTER TABLE master_products 
DROP CONSTRAINT IF EXISTS master_products_status_check;

ALTER TABLE master_products 
ADD CONSTRAINT master_products_status_check 
CHECK (status IN ('active', 'inactive', 'discontinued'));

-- Add constraint: approved products must have HSN (unless status is inactive/discontinued)
ALTER TABLE master_products
DROP CONSTRAINT IF EXISTS check_approved_has_hsn;

ALTER TABLE master_products
ADD CONSTRAINT check_approved_has_hsn
CHECK (
  (approval_status != 'approved' OR hsn_code IS NOT NULL OR status IN ('inactive', 'discontinued'))
);

-- Create indexes for governance queries
CREATE INDEX IF NOT EXISTS idx_master_products_approval_status ON master_products(approval_status);
CREATE INDEX IF NOT EXISTS idx_master_products_submitted_org ON master_products(submitted_org_id) WHERE submitted_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_created_by ON master_products(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_reviewed_by ON master_products(reviewed_by) WHERE reviewed_by IS NOT NULL;

COMMIT;

