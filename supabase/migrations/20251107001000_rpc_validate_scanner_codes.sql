-- RPC: Validate scanner codes (multi-barcode support)
-- Detects type (serial vs product EAN) and validates against database
-- Returns JSON array of validation results

BEGIN;

CREATE OR REPLACE FUNCTION validate_scanner_codes(
  p_org_id uuid,
  p_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_code text;
  v_detected_type text;
  v_product_id uuid;
  v_master_product_id uuid;
  v_serial_status text;
  v_status text;
  v_message text;
  v_serial_record record;
  v_product_record record;
BEGIN
  -- Loop through each code
  FOREACH v_code IN ARRAY p_codes
  LOOP
    -- Skip empty codes
    IF v_code IS NULL OR trim(v_code) = '' THEN
      CONTINUE;
    END IF;

    v_detected_type := 'unknown';
    v_product_id := NULL;
    v_status := 'not_found';
    v_message := NULL;

    -- Step 1: Check if it's a serial number (exists in product_serials)
    SELECT ps.id, ps.product_id, ps.status
    INTO v_serial_record
    FROM product_serials ps
    WHERE ps.org_id = p_org_id
      AND ps.serial_number = trim(v_code)
      AND ps.status = 'available'
    LIMIT 1;

    IF v_serial_record.id IS NOT NULL THEN
      -- Serial found
      v_detected_type := 'serialnumber';
      v_product_id := v_serial_record.product_id;
      v_status := 'valid';
      v_message := 'Serial number found';
    ELSE
      -- Step 2: Check stock_ledger as fallback (for historical records)
      SELECT DISTINCT sl.product_id
      INTO v_product_id
      FROM stock_ledger sl
      WHERE sl.org_id = p_org_id
        AND sl.notes ILIKE '%' || trim(v_code) || '%'
      LIMIT 1;

      IF v_product_id IS NOT NULL THEN
        -- Found in ledger but not in active inventory
        v_detected_type := 'serialnumber';
        v_status := 'invalid';
        v_message := 'Serial exists in history but not in current inventory (may be sold/returned)';
      ELSE
        -- Step 3: Check if it's a product EAN (org products)
        SELECT p.id, p.master_product_id
        INTO v_product_record
        FROM products p
        WHERE p.org_id = p_org_id
          AND p.status = 'active'
          AND (
            p.ean = trim(v_code)
            OR EXISTS (
              SELECT 1 FROM master_products mp
              WHERE mp.id = p.master_product_id
                AND mp.barcode_ean = trim(v_code)
            )
          )
        LIMIT 1;

        IF v_product_record.id IS NOT NULL THEN
          -- Product EAN found
          v_detected_type := 'productcode';
          v_product_id := v_product_record.id;
          v_status := 'valid';
          v_message := 'Product EAN found';
        ELSE
          -- Step 4: Check master_products directly (for products not yet linked to org)
          SELECT mp.id
          INTO v_master_product_id
          FROM master_products mp
          WHERE mp.barcode_ean = trim(v_code)
            AND mp.status = 'active'
          LIMIT 1;

          IF v_master_product_id IS NOT NULL THEN
            -- Master product found but not linked to org
            v_detected_type := 'productcode';
            v_status := 'invalid';
            v_message := 'Product found in catalog but not added to your organization';
          ELSE
            -- Unknown code
            v_detected_type := 'unknown';
            v_status := 'not_found';
            v_message := 'Code not recognized';
          END IF;
        END IF;
      END IF;
    END IF;

    -- Append result to JSON array
    v_result := v_result || jsonb_build_object(
      'code', v_code,
      'type', v_detected_type,
      'product_id', v_product_id,
      'status', v_status,
      'message', v_message
    );
  END LOOP;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_scanner_codes TO authenticated;

COMMIT;

