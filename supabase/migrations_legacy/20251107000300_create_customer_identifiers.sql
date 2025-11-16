-- Create customer_identifiers table (future-safe structure)
-- Supports multiple mobile numbers and GSTINs per customer
-- For now: structure only, no migration of existing data

BEGIN;

CREATE TABLE IF NOT EXISTS customer_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_customer_id uuid NOT NULL REFERENCES master_customers(id) ON DELETE CASCADE,
  identifier_type text NOT NULL CHECK (identifier_type IN ('mobile', 'gstin')),
  value text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  -- Unique constraint: same identifier type + value can't be duplicated
  CONSTRAINT unique_customer_identifier UNIQUE (identifier_type, value)
);

-- Indexes for fast lookups
CREATE INDEX idx_customer_identifiers_customer ON customer_identifiers(master_customer_id);
CREATE INDEX idx_customer_identifiers_type_value ON customer_identifiers(identifier_type, value);
CREATE INDEX idx_customer_identifiers_primary ON customer_identifiers(master_customer_id, is_primary) 
  WHERE is_primary = true;

-- Enable RLS (read-only for now, matching master_customers policy)
ALTER TABLE customer_identifiers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read (matches master_customers)
CREATE POLICY "customer_identifiers_read" ON customer_identifiers
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Note: INSERT/UPDATE/DELETE will be handled via RPC functions in future
-- Direct writes are blocked by RLS (no policy for INSERT/UPDATE/DELETE)

COMMIT;

