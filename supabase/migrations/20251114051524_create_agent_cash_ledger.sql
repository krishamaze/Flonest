-- Create agent cash ledger for law-compliant cash handling
-- Enforces Indian Contract Act agency principles and Section 269ST compliance

BEGIN;

-- Step 1: Add payment tracking to invoices
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('upi', 'payment_link', 'netbanking', 'cash', 'bank_transfer', 'unpaid')) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_status text CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'verified')) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference text, -- UTR/Transaction ID
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid REFERENCES profiles(id);

-- Step 2: Create agent cash ledger table
CREATE TABLE agent_cash_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('cash_received', 'cash_deposited', 'cash_remitted', 'adjustment')),
  amount numeric(12,2) NOT NULL,
  reference_number text, -- UTR, deposit slip number, etc.
  deposited_to text CHECK (deposited_to IN ('seller_bank', 'agent_bank', NULL)),
  proof_url text, -- Photo of deposit slip/UTR screenshot
  status text CHECK (status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES profiles(id),
  rejection_reason text,
  CONSTRAINT positive_cash_received CHECK (
    transaction_type != 'cash_received' OR amount > 0
  ),
  CONSTRAINT negative_remittance CHECK (
    transaction_type NOT IN ('cash_deposited', 'cash_remitted') OR amount <= 0
  )
);

-- Step 3: Create org cash settings table
CREATE TABLE org_cash_settings (
  org_id uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  max_cash_holding_days integer DEFAULT 3,
  max_cash_balance numeric(12,2) DEFAULT 50000,
  section_269st_limit numeric(12,2) DEFAULT 200000, -- ₹2L per transaction per law
  require_deposit_proof boolean DEFAULT true,
  require_gps_on_collection boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_agent_cash_ledger_sender_org ON agent_cash_ledger(sender_org_id);
CREATE INDEX idx_agent_cash_ledger_agent_user ON agent_cash_ledger(agent_user_id);
CREATE INDEX idx_agent_cash_ledger_invoice ON agent_cash_ledger(invoice_id);
CREATE INDEX idx_agent_cash_ledger_status ON agent_cash_ledger(status);
CREATE INDEX idx_agent_cash_ledger_created_at ON agent_cash_ledger(created_at DESC);
CREATE INDEX idx_invoices_payment_method ON invoices(payment_method) WHERE is_dc_sale = true;
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status) WHERE is_dc_sale = true;

-- Step 5: Enable RLS
ALTER TABLE agent_cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_cash_settings ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for agent_cash_ledger

-- Agents and their helpers can view their own cash ledger
CREATE POLICY "agent_cash_ledger_agent_view" ON agent_cash_ledger
  FOR SELECT
  USING (
    has_agent_access(sender_org_id, auth.uid())
  );

-- Agents can insert cash_received and cash_deposited entries
CREATE POLICY "agent_cash_ledger_agent_insert" ON agent_cash_ledger
  FOR INSERT
  WITH CHECK (
    agent_user_id = auth.uid()
    AND transaction_type IN ('cash_received', 'cash_deposited', 'cash_remitted')
  );

-- Sender org admins can view all cash ledger entries for their org
CREATE POLICY "agent_cash_ledger_sender_admin_view" ON agent_cash_ledger
  FOR SELECT
  USING (
    sender_org_id IN (
      SELECT m.org_id FROM memberships m
      WHERE m.profile_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- Sender org admins can verify/reject cash entries
CREATE POLICY "agent_cash_ledger_sender_admin_verify" ON agent_cash_ledger
  FOR UPDATE
  USING (
    sender_org_id IN (
      SELECT m.org_id FROM memberships m
      WHERE m.profile_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- Step 7: RLS Policies for org_cash_settings

-- Org admins can manage their org's cash settings
CREATE POLICY "org_cash_settings_admin_manage" ON org_cash_settings
  FOR ALL
  USING (
    org_id IN (
      SELECT m.org_id FROM memberships m
      WHERE m.profile_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- Agents can view cash settings for orgs where they are agents
CREATE POLICY "org_cash_settings_agent_view" ON org_cash_settings
  FOR SELECT
  USING (
    org_id IN (
      SELECT ar.sender_org_id FROM agent_relationships ar
      WHERE ar.agent_user_id = auth.uid()
        AND ar.status = 'active'
    )
  );

-- Step 8: Helper function to get agent cash on hand
CREATE OR REPLACE FUNCTION get_agent_cash_on_hand(p_sender_org_id uuid, p_agent_user_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'cash_received' THEN amount
      WHEN transaction_type IN ('cash_deposited', 'cash_remitted') THEN amount -- already negative
      WHEN transaction_type = 'adjustment' THEN amount -- can be pos/neg
      ELSE 0
    END
  ), 0)
  FROM agent_cash_ledger
  WHERE sender_org_id = p_sender_org_id
    AND agent_user_id = p_agent_user_id
    AND status != 'rejected';
$$;

-- Step 9: Helper function to check overdue cash
CREATE OR REPLACE FUNCTION has_overdue_cash(p_sender_org_id uuid, p_agent_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM agent_cash_ledger acl
    INNER JOIN org_cash_settings ocs ON ocs.org_id = p_sender_org_id
    WHERE acl.sender_org_id = p_sender_org_id
      AND acl.agent_user_id = p_agent_user_id
      AND acl.transaction_type = 'cash_received'
      AND acl.status = 'pending'
      AND acl.created_at < NOW() - (ocs.max_cash_holding_days || ' days')::INTERVAL
  );
$$;

-- Step 10: Helper function to check if cash balance exceeds limit
CREATE OR REPLACE FUNCTION exceeds_cash_limit(p_sender_org_id uuid, p_agent_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    get_agent_cash_on_hand(p_sender_org_id, p_agent_user_id) >= 
    COALESCE(
      (SELECT max_cash_balance FROM org_cash_settings WHERE org_id = p_sender_org_id),
      50000
    );
$$;

-- Step 11: Create default cash settings for existing orgs
INSERT INTO org_cash_settings (org_id)
SELECT id FROM orgs
WHERE NOT EXISTS (
  SELECT 1 FROM org_cash_settings WHERE org_id = orgs.id
);

COMMIT;

