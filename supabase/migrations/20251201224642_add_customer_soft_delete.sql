-- Migration: Add soft delete functionality for customers
-- Created: 2025-12-01
-- Description: Adds deleted_at column, indexes, and RPC functions for soft delete with 30-day expiry

-- ============================================================================
-- 1. Add deleted_at column to customers table
-- ============================================================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN customers.deleted_at IS 'Timestamp when customer was soft-deleted. NULL = active, NOT NULL = deleted. Auto-purged after 30 days.';

-- ============================================================================
-- 2. Create index for soft-deleted customers (for cleanup queries)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at 
ON customers(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 3. RPC: can_delete_customer - Check if customer can be deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION can_delete_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_count integer;
BEGIN
  -- Check if customer has any invoices (excluding drafts)
  SELECT COUNT(*) INTO v_invoice_count
  FROM invoices 
  WHERE customer_id = p_customer_id 
  AND status != 'draft';
  
  RETURN json_build_object(
    'can_delete', v_invoice_count = 0,
    'invoice_count', v_invoice_count
  );
END;
$$;

COMMENT ON FUNCTION can_delete_customer IS 'Checks if a customer can be soft-deleted by validating no active invoices exist (drafts excluded)';

-- ============================================================================
-- 4. RPC: soft_delete_customer - Soft delete a customer
-- ============================================================================
CREATE OR REPLACE FUNCTION soft_delete_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_can_delete_result json;
  v_can_delete boolean;
  v_invoice_count integer;
  v_deleted_at timestamptz;
  v_expires_at timestamptz;
BEGIN
  -- Check if deletion is allowed
  SELECT can_delete_customer(p_customer_id) INTO v_can_delete_result;
  v_can_delete := (v_can_delete_result->>'can_delete')::boolean;
  v_invoice_count := (v_can_delete_result->>'invoice_count')::integer;
  
  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'Cannot delete customer with % existing transactions', v_invoice_count
      USING HINT = 'Customer has active invoices and cannot be deleted';
  END IF;
  
  -- Soft delete: set deleted_at timestamp
  v_deleted_at := NOW();
  v_expires_at := v_deleted_at + INTERVAL '30 days';
  
  UPDATE customers 
  SET deleted_at = v_deleted_at,
      updated_at = v_deleted_at
  WHERE id = p_customer_id 
  AND deleted_at IS NULL;
  
  -- Check if update actually happened
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or already deleted'
      USING HINT = 'Customer may have been deleted already';
  END IF;
  
  RETURN json_build_object(
    'success', true, 
    'deleted_at', v_deleted_at,
    'expires_at', v_expires_at
  );
END;
$$;

COMMENT ON FUNCTION soft_delete_customer IS 'Soft deletes a customer by setting deleted_at. Customer is hidden from queries and auto-purged after 30 days.';

-- ============================================================================
-- 5. RPC: restore_customer - Restore a soft-deleted customer
-- ============================================================================
CREATE OR REPLACE FUNCTION restore_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_at timestamptz;
  v_days_since_delete integer;
  v_restored_at timestamptz;
BEGIN
  -- Get deletion timestamp
  SELECT deleted_at INTO v_deleted_at
  FROM customers
  WHERE id = p_customer_id;
  
  IF v_deleted_at IS NULL THEN
    RAISE EXCEPTION 'Customer is not deleted'
      USING HINT = 'Only soft-deleted customers can be restored';
  END IF;
  
  -- Check if within 30-day restore window
  v_days_since_delete := EXTRACT(DAY FROM NOW() - v_deleted_at);
  
  IF v_days_since_delete > 30 THEN
    RAISE EXCEPTION 'Restore window expired (% days ago)', v_days_since_delete
      USING HINT = 'Customers can only be restored within 30 days of deletion';
  END IF;
  
  -- Restore customer
  v_restored_at := NOW();
  
  UPDATE customers 
  SET deleted_at = NULL,
      updated_at = v_restored_at
  WHERE id = p_customer_id;
  
  RETURN json_build_object(
    'success', true,
    'restored_at', v_restored_at,
    'was_deleted_for_days', v_days_since_delete
  );
END;
$$;

COMMENT ON FUNCTION restore_customer IS 'Restores a soft-deleted customer if within 30-day window. Returns error if expired.';

-- ============================================================================
-- 6. RPC: cleanup_expired_deleted_customers - Auto-purge expired deletions
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_deleted_customers()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purged_count integer;
  v_purged_at timestamptz;
BEGIN
  v_purged_at := NOW();
  
  -- Hard delete customers deleted > 30 days ago
  WITH deleted AS (
    DELETE FROM customers
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_purged_count FROM deleted;
  
  RETURN json_build_object(
    'purged_count', v_purged_count,
    'purged_at', v_purged_at
  );
END;
$$;

COMMENT ON FUNCTION cleanup_expired_deleted_customers IS 'Hard deletes customers that have been soft-deleted for >30 days. Should be run as scheduled job (cron/pg_cron).';

-- ============================================================================
-- 7. Grant execute permissions on RPC functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION can_delete_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_deleted_customers() TO authenticated;

-- ============================================================================
-- Migration complete
-- ============================================================================
-- Next steps:
-- 1. Apply this migration via Supabase MCP
-- 2. Update API layer to filter deleted_at IS NULL in queries
-- 3. Add frontend hooks for soft delete/restore
-- 4. Set up scheduled job for cleanup_expired_deleted_customers()
