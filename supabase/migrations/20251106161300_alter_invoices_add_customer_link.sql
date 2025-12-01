-- M4: Add customer_id to invoices table
-- Links invoices to org-scoped customers

BEGIN;

-- Add customer_id column (nullable for backward compatibility)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);

-- Note: customer_id is nullable initially to allow existing invoices to remain valid
-- Once UI is ready, we can enforce NOT NULL for new invoices

COMMIT;

