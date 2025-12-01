-- Create invoice_item_serials table
-- Records serial number usage in invoice items (sales linkage)

BEGIN;

CREATE TABLE IF NOT EXISTS invoice_item_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id uuid NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'used')),
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  -- Unique constraint: same serial can't be added twice to same invoice item
  CONSTRAINT unique_invoice_item_serial UNIQUE (invoice_item_id, serial_number)
);

-- Indexes for fast lookups
CREATE INDEX idx_invoice_item_serials_item ON invoice_item_serials(invoice_item_id);
CREATE INDEX idx_invoice_item_serials_serial ON invoice_item_serials(serial_number);
CREATE INDEX idx_invoice_item_serials_status ON invoice_item_serials(status);

-- Enable RLS
ALTER TABLE invoice_item_serials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access serials for invoices in their orgs
CREATE POLICY "invoice_item_serials_tenant_isolation" ON invoice_item_serials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_serials.invoice_item_id
        AND i.org_id IN (
          SELECT m.org_id FROM memberships m
          INNER JOIN profiles p ON p.id = m.profile_id
          WHERE p.id = auth.uid()
        )
    )
  );

COMMIT;

