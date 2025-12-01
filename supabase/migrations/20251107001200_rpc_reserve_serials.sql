-- RPC: Reserve serials for invoice item
-- Validates serials belong to same product and are available
-- Updates product_serials status to 'reserved'
-- Inserts into invoice_item_serials

BEGIN;

CREATE OR REPLACE FUNCTION reserve_serials_for_invoice(
  p_invoice_item_id uuid,
  p_serial_numbers text[],
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_serial text;
  v_product_id uuid;
  v_expected_product_id uuid;
  v_serial_id uuid;
  v_validation_errors text[] := ARRAY[]::text[];
  v_reserved_count integer := 0;
  v_invoice_item record;
BEGIN
  -- Get invoice item and validate it exists and belongs to org
  SELECT ii.id, ii.product_id, i.org_id
  INTO v_invoice_item
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE ii.id = p_invoice_item_id
    AND i.org_id = p_org_id;

  IF v_invoice_item.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invoice item not found or does not belong to organization'
    );
  END IF;

  v_expected_product_id := v_invoice_item.product_id;

  -- Validate all serials belong to the same product and are available
  FOREACH v_serial IN ARRAY p_serial_numbers
  LOOP
    -- Check if serial exists and is available
    SELECT ps.id, ps.product_id
    INTO v_serial_id, v_product_id
    FROM product_serials ps
    WHERE ps.org_id = p_org_id
      AND ps.serial_number = trim(v_serial)
      AND ps.status = 'available';

    IF v_serial_id IS NULL THEN
      v_validation_errors := array_append(v_validation_errors, 
        format('Serial %s not found or not available', v_serial));
      CONTINUE;
    END IF;

    IF v_product_id != v_expected_product_id THEN
      v_validation_errors := array_append(v_validation_errors,
        format('Serial %s belongs to a different product', v_serial));
      CONTINUE;
    END IF;

    -- Check for duplicate in invoice_item_serials
    IF EXISTS (
      SELECT 1 FROM invoice_item_serials iis
      WHERE iis.invoice_item_id = p_invoice_item_id
        AND iis.serial_number = trim(v_serial)
    ) THEN
      v_validation_errors := array_append(v_validation_errors,
        format('Serial %s already added to this invoice item', v_serial));
      CONTINUE;
    END IF;

    -- Reserve the serial (with optional timeout: 24 hours from now)
    UPDATE product_serials
    SET status = 'reserved',
        reserved_at = now(),
        reserved_expires_at = now() + interval '24 hours',
        updated_at = now()
    WHERE id = v_serial_id;

    -- Insert into invoice_item_serials
    INSERT INTO invoice_item_serials (invoice_item_id, serial_number, status)
    VALUES (p_invoice_item_id, trim(v_serial), 'reserved');

    v_reserved_count := v_reserved_count + 1;
  END LOOP;

  -- Return result
  IF array_length(v_validation_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reserved_count', v_reserved_count,
      'errors', v_validation_errors,
      'message', format('Reserved %s serials, %s errors', v_reserved_count, array_length(v_validation_errors, 1))
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'reserved_count', v_reserved_count,
      'message', format('Successfully reserved %s serials', v_reserved_count)
    );
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reserve_serials_for_invoice TO authenticated;

COMMIT;

