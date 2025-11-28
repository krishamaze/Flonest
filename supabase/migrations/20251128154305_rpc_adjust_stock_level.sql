-- Migration: Add adjust_stock_level RPC and enable negative stock ledger entries

-- 1. Relax stock_ledger constraint to allow negative quantities for adjustments
-- We need to check if the constraint exists before dropping to be safe, 
-- but in migrations strict DDL is usually fine.
ALTER TABLE public.stock_ledger
DROP CONSTRAINT IF EXISTS stock_ledger_quantity_check;

ALTER TABLE public.stock_ledger
ADD CONSTRAINT stock_ledger_quantity_check CHECK (quantity <> 0);

-- 2. Create adjust_stock_level RPC
CREATE OR REPLACE FUNCTION public.adjust_stock_level(
  p_org_id uuid,
  p_product_id uuid,
  p_delta_qty numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_exists boolean;
BEGIN
  -- Validate inputs
  IF p_delta_qty = 0 THEN
    RAISE EXCEPTION 'Delta quantity cannot be zero';
  END IF;

  IF p_notes IS NULL OR trim(p_notes) = '' THEN
    RAISE EXCEPTION 'Notes are mandatory for stock adjustments';
  END IF;

  -- 1. Validate product belongs to org
  SELECT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = p_product_id AND org_id = p_org_id
  ) INTO v_product_exists;

  IF NOT v_product_exists THEN
    RAISE EXCEPTION 'Product % does not belong to organization %', p_product_id, p_org_id;
  END IF;

  -- 2. Update inventory table (UPSERT)
  -- Maps to requirement: Update: products.current_stock = current_stock + p_delta_qty
  -- Using public.inventory as the physical table for current stock.
  INSERT INTO public.inventory (org_id, product_id, quantity)
  VALUES (p_org_id, p_product_id, p_delta_qty::integer)
  ON CONFLICT (org_id, product_id)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    updated_at = now();

  -- 3. Audit: Insert into stock_ledger
  -- Maps to requirement: transaction_type: 'adjustment', quantity: p_delta_qty
  INSERT INTO public.stock_ledger (
    org_id,
    product_id,
    transaction_type,
    quantity,
    notes,
    created_by
  ) VALUES (
    p_org_id,
    p_product_id,
    'adjustment',
    p_delta_qty::integer,
    p_notes,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'delta', p_delta_qty
  );
END;
$$;

