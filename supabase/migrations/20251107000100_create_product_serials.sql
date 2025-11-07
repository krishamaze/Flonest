-- Create product_serials table
-- Master record of serials owned by org (inventory-level)

BEGIN;

CREATE TABLE IF NOT EXISTS product_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used')),
  source_txn_id uuid REFERENCES stock_ledger(id) ON DELETE SET NULL,
  reserved_at timestamptz,
  reserved_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique index: prevents duplicate available/reserved serials
CREATE UNIQUE INDEX idx_product_serials_unique_available 
  ON product_serials(org_id, product_id, serial_number) 
  WHERE status IN ('available', 'reserved');

-- Indexes for fast lookups
CREATE INDEX idx_product_serials_org_serial ON product_serials(org_id, serial_number);
CREATE INDEX idx_product_serials_product ON product_serials(product_id);
CREATE INDEX idx_product_serials_status ON product_serials(org_id, status);

-- Enable RLS
ALTER TABLE product_serials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Org-scoped access
CREATE POLICY "product_serials_tenant_isolation" ON product_serials
  FOR ALL
  USING (
    org_id IN (
      SELECT m.org_id FROM memberships m
      INNER JOIN profiles p ON p.id = m.profile_id
      WHERE p.id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_serials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_product_serials_updated_at
  BEFORE UPDATE ON product_serials
  FOR EACH ROW
  EXECUTE FUNCTION update_product_serials_updated_at();

COMMIT;

