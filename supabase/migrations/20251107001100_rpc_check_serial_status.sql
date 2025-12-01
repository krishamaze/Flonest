-- RPC: Check serial number status
-- Validates if a serial exists and belongs to org/product

BEGIN;

CREATE OR REPLACE FUNCTION check_serial_status(
  p_org_id uuid,
  p_serial_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_serial_record record;
  v_ledger_record record;
BEGIN
  -- Step 1: Check product_serials (primary source)
  SELECT ps.id, ps.product_id, ps.status
  INTO v_serial_record
  FROM product_serials ps
  WHERE ps.org_id = p_org_id
    AND ps.serial_number = trim(p_serial_number)
  LIMIT 1;

  IF v_serial_record.id IS NOT NULL THEN
    -- Serial found in active inventory
    RETURN jsonb_build_object(
      'found', true,
      'product_id', v_serial_record.product_id,
      'status', v_serial_record.status,
      'message', CASE 
        WHEN v_serial_record.status = 'available' THEN 'Serial is available'
        WHEN v_serial_record.status = 'reserved' THEN 'Serial is reserved for another invoice'
        WHEN v_serial_record.status = 'used' THEN 'Serial has already been sold'
        ELSE 'Serial status unknown'
      END
    );
  END IF;

  -- Step 2: Fallback to stock_ledger (check historical records)
  SELECT DISTINCT sl.product_id
  INTO v_ledger_record
  FROM stock_ledger sl
  WHERE sl.org_id = p_org_id
    AND sl.notes ILIKE '%' || trim(p_serial_number) || '%'
  LIMIT 1;

  IF v_ledger_record.product_id IS NOT NULL THEN
    -- Found in ledger but not in active inventory
    RETURN jsonb_build_object(
      'found', true,
      'product_id', v_ledger_record.product_id,
      'status', 'sold_or_returned',
      'message', 'Serial exists in transaction history but not in current inventory (may be sold or returned)'
    );
  END IF;

  -- Not found anywhere
  RETURN jsonb_build_object(
    'found', false,
    'product_id', NULL,
    'status', 'not_found',
    'message', 'Serial number not found in inventory or transaction history'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_serial_status TO authenticated;

COMMIT;

