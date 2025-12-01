-- Create RPC function for customer balance tracking
-- This enables "You'll Get" receivables feature similar to FINETUNE

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_customer_balances(UUID);

-- Create function to aggregate customer balances
CREATE OR REPLACE FUNCTION get_customer_balances(p_org_id UUID)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  mobile TEXT,
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  balance_due NUMERIC,
  last_invoice_date TIMESTAMPTZ,
  invoice_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS customer_id,
    COALESCE(c.alias_name, mc.legal_name, 'Unknown') AS customer_name,
    mc.mobile,
    COALESCE(SUM(
      CASE 
        WHEN i.status IN ('pending', 'posted', 'paid') 
        THEN i.total_amount 
        ELSE 0 
      END
    ), 0) AS total_invoiced,
    COALESCE(SUM(
      CASE 
        WHEN i.status IN ('pending', 'posted', 'paid') 
        THEN COALESCE(i.paid_amount, 0)
        ELSE 0 
      END
    ), 0) AS total_paid,
    COALESCE(SUM(
      CASE 
        WHEN i.status IN ('pending', 'posted', 'paid') 
        THEN i.total_amount - COALESCE(i.paid_amount, 0)
        ELSE 0 
      END
    ), 0) AS balance_due,
    MAX(
      CASE 
        WHEN i.status IN ('pending', 'posted', 'paid') 
        THEN i.created_at 
        ELSE NULL 
      END
    ) AS last_invoice_date,
    COUNT(
      CASE 
        WHEN i.status IN ('pending', 'posted', 'paid') 
        THEN i.id 
        ELSE NULL 
      END
    ) AS invoice_count
  FROM customers c
  LEFT JOIN master_customers mc ON c.master_customer_id = mc.id
  LEFT JOIN invoices i ON i.customer_id = c.id
  WHERE c.org_id = p_org_id
  GROUP BY c.id, c.alias_name, mc.legal_name, mc.mobile
  ORDER BY balance_due DESC, customer_name ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_customer_balances(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_customer_balances(UUID) IS 
  'Aggregates customer balance information including total invoiced, paid amounts, and receivables. Excludes draft invoices. Returns results ordered by balance due (desc), then customer name.';

-- Create index to optimize balance queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status_amount 
  ON invoices(customer_id, status, total_amount, paid_amount)
  WHERE status IN ('pending', 'posted', 'paid');

COMMENT ON INDEX idx_invoices_customer_status_amount IS 
  'Optimizes customer balance aggregation queries by covering customer_id, status, and amount columns';

