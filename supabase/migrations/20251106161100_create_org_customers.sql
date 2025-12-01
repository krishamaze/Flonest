-- M4: Create customers table (org-scoped links to master_customers)
-- Each org has its own customer record that links to a master customer

BEGIN;

-- Customers table (org-scoped links to master)
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  master_customer_id uuid NOT NULL REFERENCES master_customers(id) ON DELETE RESTRICT,
  alias_name text, -- Org-specific nickname
  billing_address text,
  shipping_address text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, master_customer_id)
);

-- Indexes for performance
CREATE INDEX idx_customers_org ON customers(org_id);
CREATE UNIQUE INDEX idx_customers_org_master ON customers(org_id, master_customer_id);
CREATE INDEX idx_customers_master ON customers(master_customer_id);

-- RLS: Org-scoped access using optimized helper function
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access customers from their org
CREATE POLICY "customers_org_isolation" ON customers FOR ALL
  USING (org_id = current_user_org_id());

COMMIT;

