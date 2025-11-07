-- RPC: Auto-save invoice draft
-- Saves draft invoice data incrementally
-- Stores draft JSON in invoices table (adds draft_data column if needed)

BEGIN;

  -- Add draft_data column to invoices if it doesn't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS draft_data jsonb;

-- Create index for draft queries
CREATE INDEX IF NOT EXISTS idx_invoices_draft_data ON invoices(org_id, status) 
  WHERE status = 'draft' AND draft_data IS NOT NULL;

-- Function to wrap draft data with versioning
CREATE OR REPLACE FUNCTION wrap_draft_data(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'v', 1,
    'data', p_data
  );
END;
$$;

-- Function to auto-save invoice draft
CREATE OR REPLACE FUNCTION auto_save_invoice_draft(
  p_org_id uuid,
  p_user_id uuid,
  p_draft_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_customer_id uuid;
  v_items jsonb;
  v_existing_invoice_id uuid;
BEGIN
  -- Extract customer_id and items from draft_data
  v_customer_id := (p_draft_data->>'customer_id')::uuid;
  v_items := p_draft_data->'items';

  -- Check if draft already exists (by customer_id + draft status)
  -- For now, we'll create a new draft each time or update if invoice_id is provided
  IF p_draft_data ? 'invoice_id' AND (p_draft_data->>'invoice_id')::uuid IS NOT NULL THEN
    v_existing_invoice_id := (p_draft_data->>'invoice_id')::uuid;
    
    -- Verify invoice exists and belongs to org
    SELECT id INTO v_invoice_id
    FROM invoices
    WHERE id = v_existing_invoice_id
      AND org_id = p_org_id
      AND status = 'draft';
    
    IF v_invoice_id IS NOT NULL THEN
      -- Update existing draft
      UPDATE invoices
      SET 
        customer_id = COALESCE(v_customer_id, customer_id),
        draft_data = wrap_draft_data(p_draft_data),
        updated_at = now()
      WHERE id = v_invoice_id;
      
      RETURN v_invoice_id;
    END IF;
  END IF;

  -- Create new draft invoice
  INSERT INTO invoices (
    org_id,
    customer_id,
    invoice_number,
    subtotal,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount,
    status,
    created_by,
    draft_data
  )
  VALUES (
    p_org_id,
    v_customer_id,
    'DRAFT-' || extract(epoch from now())::text, -- Temporary draft number
    0, -- Will be calculated on finalize
    0,
    0,
    0,
    0,
    'draft',
    p_user_id,
    wrap_draft_data(p_draft_data)
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auto_save_invoice_draft TO authenticated;

COMMIT;

