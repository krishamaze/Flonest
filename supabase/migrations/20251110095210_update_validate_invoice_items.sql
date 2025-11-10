-- Migration: Update validate_invoice_items RPC
-- Adds master product approval checks (only for finalization, not drafts)

BEGIN;

CREATE OR REPLACE FUNCTION validate_invoice_items(
  p_org_id uuid,
  p_items jsonb,
  p_allow_draft boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := jsonb_build_object('valid', true, 'errors', '[]'::jsonb);
  v_item jsonb;
  v_item_index integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_serials text[];
  v_serial_tracked boolean;
  v_product_exists boolean := false;
  v_serial text;
  v_serial_record record;
  v_current_stock integer := 0;
  v_stock_ledger record;
  v_error_message text;
  v_error_type text;
  v_master_product_id uuid;
  v_master_approval_status text;
  v_master_hsn_code text;
  v_master_status text;
BEGIN
  -- Loop through each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_index := v_item_index + 1;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::integer, 0);
    v_serial_tracked := COALESCE((v_item->>'serial_tracked')::boolean, false);
    v_serials := ARRAY[]::text[];
    
    -- Extract serials array if present
    IF v_item ? 'serials' AND v_item->'serials' IS NOT NULL THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(v_item->'serials')) INTO v_serials;
    END IF;

    -- Reset validation flags
    v_product_exists := false;
    v_error_message := NULL;
    v_error_type := NULL;

    -- Step 1: Validate product exists in org's products table (status='active')
    SELECT EXISTS(
      SELECT 1 FROM products p
      WHERE p.id = v_product_id
        AND p.org_id = p_org_id
        AND p.status = 'active'
    ) INTO v_product_exists;

    IF NOT v_product_exists THEN
      v_error_type := 'product_not_found';
      v_error_message := 'Product not found in inventory';
      v_errors := v_errors || jsonb_build_object(
        'item_index', v_item_index,
        'type', v_error_type,
        'message', v_error_message,
        'product_id', v_product_id
      );
      v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
      CONTINUE;
    END IF;

    -- Step 1.5: Master product approval check (ONLY if not draft mode)
    IF NOT p_allow_draft THEN
      -- Get master_product_id from product
      SELECT master_product_id INTO v_master_product_id
      FROM products
      WHERE id = v_product_id AND org_id = p_org_id;

      IF v_master_product_id IS NULL THEN
        -- Product doesn't have master_product_id - this should be handled by auto-link
        -- But for validation, we'll allow it in draft mode, block in finalization
        v_error_type := 'master_product_not_linked';
        v_error_message := 'Product is not linked to a master product. Please link the product first.';
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;

      -- Check master product approval status and HSN
      SELECT approval_status, hsn_code, status
      INTO v_master_approval_status, v_master_hsn_code, v_master_status
      FROM master_products
      WHERE id = v_master_product_id;

      IF v_master_approval_status IS NULL THEN
        -- Master product doesn't exist (shouldn't happen, but handle it)
        v_error_type := 'master_product_not_found';
        v_error_message := 'Master product not found';
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id,
          'master_product_id', v_master_product_id
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;

      -- Check if master product is approved
      IF v_master_approval_status != 'approved' THEN
        v_error_type := 'master_product_not_approved';
        v_error_message := format('Master product is pending approval (status: %s). Please save as draft or wait for approval.', v_master_approval_status);
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id,
          'master_product_id', v_master_product_id,
          'approval_status', v_master_approval_status
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;

      -- Check if master product has valid HSN code
      IF v_master_hsn_code IS NULL THEN
        v_error_type := 'master_product_missing_hsn';
        v_error_message := 'Master product is missing HSN code. Please contact support to add HSN code.';
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id,
          'master_product_id', v_master_product_id
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;

      -- Validate HSN code exists in hsn_master
      IF NOT EXISTS (SELECT 1 FROM hsn_master WHERE hsn_code = v_master_hsn_code AND is_active = true) THEN
        v_error_type := 'master_product_invalid_hsn';
        v_error_message := format('Master product HSN code (%s) is not found in HSN master. Please contact support.', v_master_hsn_code);
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id,
          'master_product_id', v_master_product_id,
          'hsn_code', v_master_hsn_code
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;
    END IF;

    -- Step 2: Validate serials for serial-tracked products
    IF v_serial_tracked THEN
      IF v_serials IS NULL OR array_length(v_serials, 1) IS NULL OR array_length(v_serials, 1) = 0 THEN
        v_error_type := 'serial_not_found';
        v_error_message := 'Serial-tracked product requires at least one serial number';
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;

      -- Validate each serial exists and is available
      FOREACH v_serial IN ARRAY v_serials
      LOOP
        -- Check if serial exists in product_serials with status='available' and same product_id
        SELECT ps.id, ps.status, ps.product_id
        INTO v_serial_record
        FROM product_serials ps
        WHERE ps.org_id = p_org_id
          AND ps.serial_number = trim(v_serial)
          AND ps.product_id = v_product_id
          AND ps.status = 'available'
        LIMIT 1;

        IF v_serial_record.id IS NULL THEN
          v_error_type := 'serial_not_found';
          v_error_message := format('Serial number %s not found in stock or not available', v_serial);
          v_errors := v_errors || jsonb_build_object(
            'item_index', v_item_index,
            'type', v_error_type,
            'message', v_error_message,
            'product_id', v_product_id,
            'serial', v_serial
          );
          v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        END IF;
      END LOOP;
    ELSE
      -- Step 3: Validate stock quantity for non-tracked products
      IF v_quantity <= 0 THEN
        v_error_type := 'insufficient_stock';
        v_error_message := 'Quantity must be greater than 0';
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
        CONTINUE;
      END IF;

      -- Calculate current stock from stock_ledger
      SELECT COALESCE(SUM(
        CASE 
          WHEN transaction_type = 'in' THEN quantity
          WHEN transaction_type = 'out' THEN -quantity
          WHEN transaction_type = 'adjustment' THEN quantity
          ELSE 0
        END
      ), 0)::integer
      INTO v_current_stock
      FROM stock_ledger
      WHERE org_id = p_org_id
        AND product_id = v_product_id;

      -- Ensure non-negative stock
      v_current_stock := GREATEST(v_current_stock, 0);

      -- Check if stock is sufficient
      IF v_current_stock < v_quantity THEN
        v_error_type := 'insufficient_stock';
        v_error_message := format('Insufficient stock. Available: %s, Requested: %s', v_current_stock, v_quantity);
        v_errors := v_errors || jsonb_build_object(
          'item_index', v_item_index,
          'type', v_error_type,
          'message', v_error_message,
          'product_id', v_product_id,
          'available_stock', v_current_stock,
          'requested_quantity', v_quantity
        );
        v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
      END IF;
    END IF;
  END LOOP;

  -- Set errors array in result
  v_result := jsonb_set(v_result, '{errors}', v_errors);

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_invoice_items(uuid, jsonb, boolean) TO authenticated;

COMMIT;

