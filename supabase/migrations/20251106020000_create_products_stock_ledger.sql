-- M3: Inventory CRUD Implementation (FIN-15)
-- Create products and stock_ledger tables with optimized RLS policies
-- Critical fixes applied: current_user_org_id() helper, RESTRICT foreign keys, partial unique index

BEGIN;

-- Products table (org-specific products, separate from master_products)
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sku text NOT NULL,
  description text,
  category text,
  cost_price decimal(12,2),
  selling_price decimal(12,2),
  min_stock_level integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stock ledger table (inventory transaction audit trail)
CREATE TABLE stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL CHECK (quantity > 0),
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Performance indexes (optimized)
-- Partial unique index: allows inactive duplicates, enforces uniqueness for active products only
CREATE UNIQUE INDEX idx_products_org_sku ON products(org_id, sku) WHERE status = 'active';
CREATE INDEX idx_products_org_status ON products(org_id, status);
CREATE INDEX idx_stock_ledger_org_product ON stock_ledger(org_id, product_id);
CREATE INDEX idx_stock_ledger_created_at ON stock_ledger(created_at DESC);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies (using optimized helper function from M2, not subquery pattern)
CREATE POLICY "products_tenant_isolation" ON products FOR ALL
USING (org_id = current_user_org_id());

CREATE POLICY "stock_ledger_tenant_isolation" ON stock_ledger FOR ALL
USING (org_id = current_user_org_id());

COMMIT;

