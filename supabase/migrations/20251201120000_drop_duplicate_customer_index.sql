-- Drop duplicate index on customers table
-- Keep a single index on (org_id, master_customer_id)
DROP INDEX IF EXISTS idx_customers_org_master;
-- Optionally rename the remaining index for clarity
ALTER INDEX IF EXISTS customers_org_id_master_customer_id_key RENAME TO idx_customers_org_master;
