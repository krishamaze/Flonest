-- Agent Portal: Create delivery challans and DC stock system
-- Completely isolated from regular inventory - no joins, no mixing

BEGIN;

-- Delivery Challans table
-- Tracks delivery challans issued from sender org to agent
CREATE TABLE delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_number text NOT NULL,
  sender_org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status text CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  issued_date timestamptz DEFAULT now(),
  accepted_date timestamptz,
  rejected_date timestamptz,
  rejection_reason text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sender_org_id, dc_number)
);

-- DC Items table
-- Line items in a delivery challan
CREATE TABLE dc_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id uuid NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(12,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- DC Stock Ledger table (ISOLATED from regular stock_ledger)
-- Tracks ALL DC stock movements separately from regular inventory
CREATE TABLE dc_stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  dc_id uuid REFERENCES delivery_challans(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  transaction_type text CHECK (transaction_type IN ('dc_in', 'dc_sale', 'dc_return', 'dc_adjustment')),
  quantity integer NOT NULL CHECK (quantity != 0),
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Update invoices table to support DC sales
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS is_dc_sale boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dc_id uuid REFERENCES delivery_challans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_delivery_challans_sender_org ON delivery_challans(sender_org_id);
CREATE INDEX idx_delivery_challans_agent_user ON delivery_challans(agent_user_id);
CREATE INDEX idx_delivery_challans_status ON delivery_challans(status);
CREATE INDEX idx_dc_items_dc ON dc_items(dc_id);
CREATE INDEX idx_dc_items_product ON dc_items(product_id);
CREATE INDEX idx_dc_stock_ledger_sender_agent ON dc_stock_ledger(sender_org_id, agent_user_id);
CREATE INDEX idx_dc_stock_ledger_product ON dc_stock_ledger(product_id);
CREATE INDEX idx_dc_stock_ledger_transaction_type ON dc_stock_ledger(transaction_type);
CREATE INDEX idx_dc_stock_ledger_created_at ON dc_stock_ledger(created_at DESC);
CREATE INDEX idx_invoices_dc_sale ON invoices(is_dc_sale) WHERE is_dc_sale = true;
CREATE INDEX idx_invoices_agent_user ON invoices(agent_user_id) WHERE agent_user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_stock_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_challans

-- Policy: Sender org admins can manage DCs for their org
CREATE POLICY "delivery_challans_sender_manage" ON delivery_challans
FOR ALL
USING (
  sender_org_id IN (
    SELECT org_id FROM memberships
    WHERE profile_id = auth.uid()
      AND role = 'admin'
  )
);

-- Policy: Agents can view DCs issued to them
CREATE POLICY "delivery_challans_agent_view" ON delivery_challans
FOR SELECT
USING (agent_user_id = auth.uid());

-- Policy: Agents can update DCs issued to them (accept/reject)
CREATE POLICY "delivery_challans_agent_update" ON delivery_challans
FOR UPDATE
USING (
  agent_user_id = auth.uid()
  AND status = 'pending'
);

-- Policy: Agent helpers can view DCs if they have portal permissions
CREATE POLICY "delivery_challans_helper_view" ON delivery_challans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM agent_portal_permissions app
    INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
    WHERE app.helper_user_id = auth.uid()
      AND ar.sender_org_id = delivery_challans.sender_org_id
      AND ar.agent_user_id = delivery_challans.agent_user_id
  )
);

-- Policy: Agent helpers can update DCs if they have portal permissions
CREATE POLICY "delivery_challans_helper_update" ON delivery_challans
FOR UPDATE
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM agent_portal_permissions app
    INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
    WHERE app.helper_user_id = auth.uid()
      AND ar.sender_org_id = delivery_challans.sender_org_id
      AND ar.agent_user_id = delivery_challans.agent_user_id
  )
);

-- RLS Policies for dc_items

-- Policy: Sender org admins can manage DC items
CREATE POLICY "dc_items_sender_manage" ON dc_items
FOR ALL
USING (
  dc_id IN (
    SELECT id FROM delivery_challans
    WHERE sender_org_id IN (
      SELECT org_id FROM memberships
      WHERE profile_id = auth.uid()
        AND role = 'admin'
    )
  )
);

-- Policy: Agents and helpers can view DC items
CREATE POLICY "dc_items_agent_view" ON dc_items
FOR SELECT
USING (
  dc_id IN (
    SELECT id FROM delivery_challans
    WHERE agent_user_id = auth.uid()
       OR EXISTS (
         SELECT 1 FROM agent_portal_permissions app
         INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
         WHERE app.helper_user_id = auth.uid()
           AND ar.sender_org_id = delivery_challans.sender_org_id
           AND ar.agent_user_id = delivery_challans.agent_user_id
       )
  )
);

-- RLS Policies for dc_stock_ledger

-- Policy: Sender org admins can view DC stock for their agents
CREATE POLICY "dc_stock_ledger_sender_view" ON dc_stock_ledger
FOR SELECT
USING (
  sender_org_id IN (
    SELECT org_id FROM memberships
    WHERE profile_id = auth.uid()
      AND role = 'admin'
  )
);

-- Policy: Agents can view their DC stock
CREATE POLICY "dc_stock_ledger_agent_view" ON dc_stock_ledger
FOR SELECT
USING (agent_user_id = auth.uid());

-- Policy: Agents can create DC stock entries (accept DC, create sale)
CREATE POLICY "dc_stock_ledger_agent_create" ON dc_stock_ledger
FOR INSERT
WITH CHECK (agent_user_id = auth.uid());

-- Policy: Agent helpers can view DC stock if they have permissions
CREATE POLICY "dc_stock_ledger_helper_view" ON dc_stock_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM agent_portal_permissions app
    INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
    WHERE app.helper_user_id = auth.uid()
      AND ar.sender_org_id = dc_stock_ledger.sender_org_id
      AND ar.agent_user_id = dc_stock_ledger.agent_user_id
  )
);

-- Policy: Agent helpers can create DC stock entries if they have permissions
CREATE POLICY "dc_stock_ledger_helper_create" ON dc_stock_ledger
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agent_portal_permissions app
    INNER JOIN agent_relationships ar ON ar.id = app.agent_relationship_id
    WHERE app.helper_user_id = auth.uid()
      AND ar.sender_org_id = dc_stock_ledger.sender_org_id
      AND ar.agent_user_id = dc_stock_ledger.agent_user_id
  )
);

-- Helper function: Get current DC stock for agent
CREATE OR REPLACE FUNCTION get_dc_stock_summary(
  p_sender_org_id uuid,
  p_agent_user_id uuid
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_sku text,
  current_stock integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    COALESCE(SUM(
      CASE 
        WHEN dcsl.transaction_type = 'dc_in' THEN dcsl.quantity
        WHEN dcsl.transaction_type = 'dc_sale' THEN -dcsl.quantity
        WHEN dcsl.transaction_type = 'dc_return' THEN dcsl.quantity
        WHEN dcsl.transaction_type = 'dc_adjustment' THEN dcsl.quantity
        ELSE 0
      END
    ), 0)::integer as current_stock
  FROM products p
  LEFT JOIN dc_stock_ledger dcsl ON dcsl.product_id = p.id
    AND dcsl.sender_org_id = p_sender_org_id
    AND dcsl.agent_user_id = p_agent_user_id
  WHERE p.org_id = p_sender_org_id
  GROUP BY p.id, p.name, p.sku
  HAVING COALESCE(SUM(
    CASE 
      WHEN dcsl.transaction_type = 'dc_in' THEN dcsl.quantity
      WHEN dcsl.transaction_type = 'dc_sale' THEN -dcsl.quantity
      WHEN dcsl.transaction_type = 'dc_return' THEN dcsl.quantity
      WHEN dcsl.transaction_type = 'dc_adjustment' THEN dcsl.quantity
      ELSE 0
    END
  ), 0) > 0
  ORDER BY p.name;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE delivery_challans IS 'Delivery challans issued from sender org to agents';
COMMENT ON TABLE dc_items IS 'Line items in delivery challans';
COMMENT ON TABLE dc_stock_ledger IS 'DC stock movements - COMPLETELY ISOLATED from regular stock_ledger';
COMMENT ON COLUMN dc_stock_ledger.transaction_type IS 'dc_in: DC accepted, dc_sale: sold to customer, dc_return: returned to sender, dc_adjustment: manual adjustment';
COMMENT ON COLUMN invoices.is_dc_sale IS 'True if invoice was created from DC stock by agent';
COMMENT ON COLUMN invoices.agent_user_id IS 'Agent who created this DC sale';

COMMIT;

