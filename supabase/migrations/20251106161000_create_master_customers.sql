-- M4: Create master_customers table
-- Global customer master with unique mobile/GSTIN identifiers
-- Read-only for users, writes via RPC only

BEGIN;

-- Master customers table (global, shared across orgs)
CREATE TABLE master_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text, -- 10-digit, nullable
  gstin text, -- 15-char GSTIN, nullable
  legal_name text NOT NULL,
  address text,
  email text,
  state_code text, -- Derived from GSTIN positions 1-2
  pan text, -- Derived from GSTIN positions 3-7
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_identifier CHECK (mobile IS NOT NULL OR gstin IS NOT NULL)
);

-- Unique indexes (partial, only for non-null values)
CREATE UNIQUE INDEX idx_master_customers_mobile ON master_customers(mobile) WHERE mobile IS NOT NULL;
CREATE UNIQUE INDEX idx_master_customers_gstin ON master_customers(gstin) WHERE gstin IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_master_customers_last_seen ON master_customers(last_seen_at DESC);

-- RLS: Read-only for all authenticated users
ALTER TABLE master_customers ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read master customers
CREATE POLICY "master_customers_read" ON master_customers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Note: INSERT/UPDATE/DELETE operations must use RPC function upsert_master_customer
-- Direct writes are blocked by RLS (no policy for INSERT/UPDATE/DELETE)

COMMIT;

