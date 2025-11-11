-- Migration: Add branches table and branch linkage to memberships/invoices/products
-- Creates foundation for multi-branch support with role-based access

BEGIN;

-- Step 1: Create branches table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_branches_org ON branches(org_id);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view branches in their org
CREATE POLICY "branches_org_isolation" ON branches
  FOR SELECT
  USING (
    org_id IN (
      SELECT m.org_id FROM memberships m
      INNER JOIN profiles p ON p.id = m.profile_id
      WHERE p.id = auth.uid()
    )
  );

-- Step 2: Create default branch for each existing org
INSERT INTO branches (org_id, name, address)
SELECT 
  id as org_id,
  name || ' - Main Branch' as name,
  NULL as address
FROM orgs
WHERE NOT EXISTS (
  SELECT 1 FROM branches WHERE branches.org_id = orgs.id
);

-- Step 3: Add branch_id to memberships table
ALTER TABLE memberships
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Note: Constraint for branch_id/role relationship will be added in next migration
-- after role enum is updated from ('owner', 'staff', 'viewer') to ('owner', 'branch_head', 'staff')

-- Index for performance
CREATE INDEX idx_memberships_branch ON memberships(branch_id);

-- Step 4: Backfill memberships with default branch
-- Owners: Set branch_id = NULL (org-wide access)
UPDATE memberships
SET branch_id = NULL
WHERE role = 'owner';

-- Staff/Viewer: Assign to default branch for their org
UPDATE memberships m
SET branch_id = (
  SELECT b.id 
  FROM branches b 
  WHERE b.org_id = m.org_id 
  LIMIT 1
)
WHERE role IN ('staff', 'viewer') AND branch_id IS NULL;

-- Step 5: Add branch_id to invoices table
ALTER TABLE invoices
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_invoices_branch ON invoices(branch_id);

-- Step 6: Backfill invoices with default branch
UPDATE invoices i
SET branch_id = (
  SELECT b.id 
  FROM branches b 
  WHERE b.org_id = i.org_id 
  LIMIT 1
)
WHERE branch_id IS NULL;

-- Step 7: Add branch_id to products table
ALTER TABLE products
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_products_branch ON products(branch_id);

-- Step 8: Backfill products with default branch
UPDATE products p
SET branch_id = (
  SELECT b.id 
  FROM branches b 
  WHERE b.org_id = p.org_id 
  LIMIT 1
)
WHERE branch_id IS NULL;

COMMIT;

