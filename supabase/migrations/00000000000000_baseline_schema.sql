BEGIN;

-- =====================================================
-- Core tables
-- =====================================================

-- profiles (linked 1:1 to auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_id ON public.profiles(id);
CREATE INDEX idx_profiles_platform_admin_true
  ON public.profiles(platform_admin)
  WHERE platform_admin = true;

-- orgs
CREATE TABLE public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  gstin varchar(15),
  gst_enabled boolean NOT NULL DEFAULT false,
  state varchar(50) NOT NULL,
  pincode varchar(6),
  phone text,
  address text,
  custom_logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_slug ON public.orgs(slug);

-- branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  branch_head_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_branches_org ON public.branches(org_id);
CREATE INDEX idx_branches_branch_head ON public.branches(branch_head_id);

-- memberships
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('org_owner','branch_head','advisor','agent')),
  membership_status text NOT NULL CHECK (membership_status IN ('pending','active','inactive')) DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, org_id)
);

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_branch_role_check
  CHECK (
    (role = 'org_owner' AND branch_id IS NULL) OR
    (role IN ('branch_head','advisor','agent') AND branch_id IS NOT NULL)
  );

CREATE INDEX idx_memberships_profile_org ON public.memberships(profile_id, org_id);
CREATE INDEX idx_memberships_org ON public.memberships(org_id);
CREATE INDEX idx_memberships_branch ON public.memberships(branch_id);

-- =====================================================
-- Customer master & org-scoped customers
-- =====================================================

CREATE TABLE public.master_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text,
  gstin text,
  legal_name text NOT NULL,
  address text,
  email text,
  state_code text,
  pan text,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT master_customers_identifier CHECK (mobile IS NOT NULL OR gstin IS NOT NULL)
);

CREATE UNIQUE INDEX idx_master_customers_mobile
  ON public.master_customers(mobile) WHERE mobile IS NOT NULL;
CREATE UNIQUE INDEX idx_master_customers_gstin
  ON public.master_customers(gstin) WHERE gstin IS NOT NULL;
CREATE INDEX idx_master_customers_last_seen
  ON public.master_customers(last_seen_at DESC);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  master_customer_id uuid NOT NULL REFERENCES public.master_customers(id) ON DELETE RESTRICT,
  alias_name text,
  billing_address text,
  shipping_address text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, master_customer_id)
);

CREATE INDEX idx_customers_org ON public.customers(org_id);
CREATE UNIQUE INDEX idx_customers_org_master
  ON public.customers(org_id, master_customer_id);
CREATE INDEX idx_customers_master ON public.customers(master_customer_id);

-- =====================================================
-- Inventory & sales core tables
-- =====================================================

-- products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text NOT NULL,
  description text,
  category text,
  cost_price numeric(12,2),
  selling_price numeric(12,2),
  min_stock_level integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  ean text,
  unit text NOT NULL DEFAULT 'pcs',
  serial_tracked boolean NOT NULL DEFAULT false,
  master_product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_products_org_sku_active
  ON public.products(org_id, sku)
  WHERE status = 'active';

CREATE INDEX idx_products_org_status ON public.products(org_id, status);
CREATE INDEX idx_products_branch ON public.products(branch_id);
CREATE INDEX idx_products_org_ean
  ON public.products(org_id, ean)
  WHERE ean IS NOT NULL;
CREATE INDEX idx_products_serial_tracked
  ON public.products(org_id, serial_tracked)
  WHERE serial_tracked = true;

-- stock_ledger
CREATE TABLE public.stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in','out','adjustment')),
  quantity integer NOT NULL CHECK (quantity > 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_ledger_org_product
  ON public.stock_ledger(org_id, product_id);
CREATE INDEX idx_stock_ledger_created_at
  ON public.stock_ledger(created_at DESC);

-- invoices / invoice_items
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  number text,
  status text NOT NULL DEFAULT 'draft',
  draft_session_id text,
  is_dc_sale boolean NOT NULL DEFAULT false,
  dc_id uuid,
  agent_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  payment_method text CHECK (payment_method IN ('upi','payment_link','netbanking','cash','bank_transfer','unpaid')) DEFAULT 'unpaid',
  payment_status text CHECK (payment_status IN ('unpaid','partial','paid','verified')) DEFAULT 'unpaid',
  payment_reference text,
  paid_amount numeric(12,2) DEFAULT 0,
  paid_at timestamptz,
  payment_verified_at timestamptz,
  payment_verified_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX idx_invoices_org_status ON public.invoices(org_id, status);
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_dc_sale ON public.invoices(is_dc_sale) WHERE is_dc_sale = true;
CREATE INDEX idx_invoices_agent_user ON public.invoices(agent_user_id) WHERE agent_user_id IS NOT NULL;
CREATE INDEX idx_invoices_updated_at ON public.invoices(updated_at DESC);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  description text,
  quantity numeric(12,2) NOT NULL,
  unit text NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  gst_rate numeric(5,2),
  discount_amount numeric(12,2),
  total_amount numeric(12,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON public.invoice_items(product_id);

-- serial tracking tables
CREATE TABLE public.product_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','used')),
  source_txn_id uuid REFERENCES public.stock_ledger(id) ON DELETE SET NULL,
  reserved_at timestamptz,
  reserved_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_product_serials_unique_available
  ON public.product_serials(org_id, product_id, serial_number)
  WHERE status IN ('available','reserved');

CREATE INDEX idx_product_serials_org_serial
  ON public.product_serials(org_id, serial_number);
CREATE INDEX idx_product_serials_product
  ON public.product_serials(product_id);
CREATE INDEX idx_product_serials_status
  ON public.product_serials(org_id, status);

CREATE TABLE public.invoice_item_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id uuid NOT NULL REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','used')),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_invoice_item_serial UNIQUE (invoice_item_id, serial_number)
);

CREATE INDEX idx_invoice_item_serials_item ON public.invoice_item_serials(invoice_item_id);
CREATE INDEX idx_invoice_item_serials_serial ON public.invoice_item_serials(serial_number);
CREATE INDEX idx_invoice_item_serials_status ON public.invoice_item_serials(status);

CREATE OR REPLACE FUNCTION public.update_product_serials_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_product_serials_updated_at
BEFORE UPDATE ON public.product_serials
FOR EACH ROW
EXECUTE FUNCTION public.update_product_serials_updated_at();

CREATE TABLE public.customer_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_customer_id uuid NOT NULL REFERENCES public.master_customers(id) ON DELETE CASCADE,
  identifier_type text NOT NULL CHECK (identifier_type IN ('mobile','gstin')),
  value text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_customer_identifier UNIQUE (identifier_type, value)
);

CREATE INDEX idx_customer_identifiers_customer ON public.customer_identifiers(master_customer_id);
CREATE INDEX idx_customer_identifiers_type_value ON public.customer_identifiers(identifier_type, value);
CREATE INDEX idx_customer_identifiers_primary
  ON public.customer_identifiers(master_customer_id, is_primary)
  WHERE is_primary = true;

-- =====================================================
-- Master products & HSN / category governance
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.hsn_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hsn_code text NOT NULL UNIQUE,
  description text,
  gst_rate numeric(5,2) NOT NULL,
  gst_type text CHECK (gst_type IN ('goods','services')) DEFAULT 'goods',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hsn_master_code ON public.hsn_master(hsn_code);
CREATE INDEX idx_hsn_master_active ON public.hsn_master(is_active);

CREATE TABLE public.category_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  hsn_code text NOT NULL REFERENCES public.hsn_master(hsn_code),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (category, hsn_code)
);

CREATE INDEX idx_category_map_category ON public.category_map(category);

CREATE TABLE public.master_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text,
  barcode_ean text,
  name text NOT NULL,
  category text,
  hsn_code text REFERENCES public.hsn_master(hsn_code),
  base_unit text NOT NULL DEFAULT 'pcs',
  base_price numeric(12,2),
  gst_rate numeric(5,2),
  gst_type text CHECK (gst_type IN ('goods','services')) DEFAULT 'goods',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued','pending')),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','auto_pass','migrated')),
  submitted_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT master_products_gst_rate_check
    CHECK (gst_rate IS NULL OR (gst_rate >= 0 AND gst_rate <= 28)),
  CONSTRAINT master_products_gst_type_check
    CHECK (gst_type IS NULL OR gst_type IN ('goods','services')),
  CONSTRAINT check_sku_or_ean
    CHECK (sku IS NOT NULL OR barcode_ean IS NOT NULL)
);

CREATE UNIQUE INDEX idx_master_products_sku
  ON public.master_products(sku)
  WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_master_products_ean
  ON public.master_products(barcode_ean)
  WHERE barcode_ean IS NOT NULL;
CREATE INDEX idx_master_products_name_trgm
  ON public.master_products USING gin(name gin_trgm_ops);
CREATE INDEX idx_master_products_category
  ON public.master_products(category) WHERE category IS NOT NULL;
CREATE INDEX idx_master_products_status
  ON public.master_products(status) WHERE status = 'active';

CREATE TABLE public.master_product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id uuid NOT NULL REFERENCES public.master_products(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('submitted','approved','rejected','edited','auto_passed','migrated')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz DEFAULT now(),
  note text,
  field_changes jsonb,
  previous_approval_status text,
  new_approval_status text
);

CREATE INDEX idx_master_product_reviews_product ON public.master_product_reviews(master_product_id);
CREATE INDEX idx_master_product_reviews_reviewed_by ON public.master_product_reviews(reviewed_by);
CREATE INDEX idx_master_product_reviews_reviewed_at ON public.master_product_reviews(reviewed_at DESC);
CREATE INDEX idx_master_product_reviews_action ON public.master_product_reviews(action);

-- =====================================================
-- Notifications
-- =====================================================

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'product_approved',
    'product_rejected',
    'invoice_blocked',
    'product_submitted',
    'agent_invited',
    'agent_dc_issued',
    'agent_dc_accepted',
    'agent_dc_rejected',
    'agent_sale_created',
    'dc_accepted',
    'dc_rejected'
  )),
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read_at
  ON public.notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at
  ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_related_id
  ON public.notifications(related_id) WHERE related_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_product_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_message text;
  v_type text;
BEGIN
  IF OLD.approval_status = NEW.approval_status THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.created_by;

  IF NEW.approval_status = 'approved' THEN
    v_type := 'product_approved';
    v_title := 'Product Approved';
    v_message := format(
      'Your product "%s" (SKU: %s) has been approved and is now available for use.',
      NEW.name, NEW.sku
    );
  ELSIF NEW.approval_status = 'rejected' THEN
    v_type := 'product_rejected';
    v_title := 'Product Rejected';
    v_message := format(
      'Your product "%s" (SKU: %s) has been rejected.',
      NEW.name, NEW.sku
    );
    IF NEW.rejection_reason IS NOT NULL THEN
      v_message := v_message || format(' Reason: %s', NEW.rejection_reason);
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, created_at)
  VALUES (v_user_id, v_type, v_title, v_message, NEW.id, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_product_notification ON public.master_products;
CREATE TRIGGER trigger_create_product_notification
  AFTER UPDATE OF approval_status ON public.master_products
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION public.create_product_notification();

-- =====================================================
-- Agent portal: relationships, DC, cash ledger
-- =====================================================

CREATE TABLE public.agent_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text CHECK (status IN ('active','inactive','revoked')) DEFAULT 'active',
  invited_by uuid REFERENCES public.profiles(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (sender_org_id, agent_user_id)
);

CREATE TABLE public.agent_portal_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_relationship_id uuid NOT NULL REFERENCES public.agent_relationships(id) ON DELETE CASCADE,
  helper_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (agent_relationship_id, helper_user_id)
);

CREATE INDEX idx_agent_relationships_sender_org ON public.agent_relationships(sender_org_id);
CREATE INDEX idx_agent_relationships_agent_user ON public.agent_relationships(agent_user_id);
CREATE INDEX idx_agent_relationships_status ON public.agent_relationships(status);
CREATE INDEX idx_agent_portal_permissions_relationship ON public.agent_portal_permissions(agent_relationship_id);
CREATE INDEX idx_agent_portal_permissions_helper ON public.agent_portal_permissions(helper_user_id);

CREATE TABLE public.delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_number text NOT NULL,
  sender_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text CHECK (status IN ('pending','accepted','rejected')) DEFAULT 'pending',
  issued_date timestamptz DEFAULT now(),
  accepted_date timestamptz,
  rejected_date timestamptz,
  rejection_reason text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (sender_org_id, dc_number)
);

CREATE TABLE public.dc_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id uuid NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.dc_stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  dc_id uuid REFERENCES public.delivery_challans(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  transaction_type text CHECK (transaction_type IN ('dc_in','dc_sale','dc_return','dc_adjustment')),
  quantity integer NOT NULL CHECK (quantity <> 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_delivery_challans_sender_org ON public.delivery_challans(sender_org_id);
CREATE INDEX idx_delivery_challans_agent_user ON public.delivery_challans(agent_user_id);
CREATE INDEX idx_delivery_challans_status ON public.delivery_challans(status);
CREATE INDEX idx_dc_items_dc ON public.dc_items(dc_id);
CREATE INDEX idx_dc_items_product ON public.dc_items(product_id);
CREATE INDEX idx_dc_stock_ledger_sender_agent ON public.dc_stock_ledger(sender_org_id, agent_user_id);
CREATE INDEX idx_dc_stock_ledger_product ON public.dc_stock_ledger(product_id);
CREATE INDEX idx_dc_stock_ledger_txn_type ON public.dc_stock_ledger(transaction_type);
CREATE INDEX idx_dc_stock_ledger_created_at ON public.dc_stock_ledger(created_at DESC);

CREATE TABLE public.agent_cash_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  agent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('cash_received','cash_deposited','cash_remitted','adjustment')),
  amount numeric(12,2) NOT NULL,
  reference_number text,
  deposited_to text CHECK (deposited_to IN ('seller_bank','agent_bank', NULL)),
  proof_url text,
  status text CHECK (status IN ('pending','verified','rejected')) DEFAULT 'pending',
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id),
  rejection_reason text,
  CONSTRAINT positive_cash_received CHECK (
    transaction_type <> 'cash_received' OR amount > 0
  ),
  CONSTRAINT negative_remittance CHECK (
    transaction_type NOT IN ('cash_deposited','cash_remitted') OR amount <= 0
  )
);

CREATE TABLE public.org_cash_settings (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  max_cash_holding_days integer DEFAULT 3,
  max_cash_balance numeric(12,2) DEFAULT 50000,
  section_269st_limit numeric(12,2) DEFAULT 200000,
  require_deposit_proof boolean DEFAULT true,
  require_gps_on_collection boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_cash_ledger_sender_org ON public.agent_cash_ledger(sender_org_id);
CREATE INDEX idx_agent_cash_ledger_agent_user ON public.agent_cash_ledger(agent_user_id);
CREATE INDEX idx_agent_cash_ledger_invoice ON public.agent_cash_ledger(invoice_id);
CREATE INDEX idx_agent_cash_ledger_status ON public.agent_cash_ledger(status);
CREATE INDEX idx_agent_cash_ledger_created_at ON public.agent_cash_ledger(created_at DESC);

CREATE OR REPLACE FUNCTION public.has_agent_access(p_sender_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_relationships ar
    WHERE ar.sender_org_id = p_sender_org_id
      AND ar.agent_user_id = p_user_id
      AND ar.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.agent_portal_permissions app
    JOIN public.agent_relationships ar ON ar.id = app.agent_relationship_id
    WHERE ar.sender_org_id = p_sender_org_id
      AND app.helper_user_id = p_user_id
      AND ar.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_agent_relationship(p_sender_org_id uuid, p_user_id uuid)
RETURNS TABLE (
  relationship_id uuid,
  sender_org_id uuid,
  sender_org_name text,
  agent_user_id uuid,
  is_primary_agent boolean,
  can_manage boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ar.id,
    ar.sender_org_id,
    o.name,
    ar.agent_user_id,
    true,
    true
  FROM public.agent_relationships ar
  JOIN public.orgs o ON o.id = ar.sender_org_id
  WHERE ar.sender_org_id = p_sender_org_id
    AND ar.agent_user_id = p_user_id
    AND ar.status = 'active'
  UNION ALL
  SELECT
    ar.id,
    ar.sender_org_id,
    o.name,
    ar.agent_user_id,
    false,
    false
  FROM public.agent_portal_permissions app
  JOIN public.agent_relationships ar ON ar.id = app.agent_relationship_id
  JOIN public.orgs o ON o.id = ar.sender_org_id
  WHERE ar.sender_org_id = p_sender_org_id
    AND app.helper_user_id = p_user_id
    AND ar.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_agent_cash_on_hand(p_sender_org_id uuid, p_agent_user_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'cash_received' THEN amount
      WHEN transaction_type IN ('cash_deposited','cash_remitted') THEN amount
      WHEN transaction_type = 'adjustment' THEN amount
      ELSE 0
    END
  ), 0)
  FROM public.agent_cash_ledger
  WHERE sender_org_id = p_sender_org_id
    AND agent_user_id = p_agent_user_id
    AND status <> 'rejected';
$$;

CREATE OR REPLACE FUNCTION public.has_overdue_cash(p_sender_org_id uuid, p_agent_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_cash_ledger acl
    JOIN public.org_cash_settings ocs ON ocs.org_id = p_sender_org_id
    WHERE acl.sender_org_id = p_sender_org_id
      AND acl.agent_user_id = p_agent_user_id
      AND acl.transaction_type = 'cash_received'
      AND acl.status = 'pending'
      AND acl.created_at < now() - (ocs.max_cash_holding_days || ' days')::interval
  );
$$;

CREATE OR REPLACE FUNCTION public.exceeds_cash_limit(p_sender_org_id uuid, p_agent_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.get_agent_cash_on_hand(p_sender_org_id, p_agent_user_id) >=
    COALESCE(
      (SELECT max_cash_balance FROM public.org_cash_settings WHERE org_id = p_sender_org_id),
      50000
    );
$$;

CREATE OR REPLACE FUNCTION public.get_dc_stock_summary(
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
    p.id,
    p.name,
    p.sku,
    COALESCE(SUM(
      CASE
        WHEN dcsl.transaction_type = 'dc_in' THEN dcsl.quantity
        WHEN dcsl.transaction_type = 'dc_sale' THEN -dcsl.quantity
        WHEN dcsl.transaction_type = 'dc_return' THEN dcsl.quantity
        WHEN dcsl.transaction_type = 'dc_adjustment' THEN dcsl.quantity
        ELSE 0
      END
    ), 0)::integer AS current_stock
  FROM public.products p
  LEFT JOIN public.dc_stock_ledger dcsl
    ON dcsl.product_id = p.id
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

-- =====================================================
-- Billing & app versions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_in_paise integer NOT NULL DEFAULT 0 CHECK (price_in_paise >= 0),
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly','yearly')),
  trial_period_days integer NOT NULL DEFAULT 0 CHECK (trial_period_days >= 0),
  is_active boolean NOT NULL DEFAULT true,
  max_seats integer CHECK (max_seats IS NULL OR max_seats > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  status text NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','incomplete')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  ended_at timestamptz,
  pending_plan_id uuid REFERENCES public.billing_plans(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_subscriptions_unique_org UNIQUE (org_id)
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_subscription_id uuid NOT NULL REFERENCES public.org_subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created','plan_changed','cancellation_scheduled','canceled',
    'renewed','payment_failed','status_updated'
  )),
  event_time timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX org_subscriptions_plan_idx ON public.org_subscriptions(plan_id);
CREATE INDEX org_subscriptions_status_idx ON public.org_subscriptions(status);
CREATE INDEX subscription_events_subscription_idx ON public.subscription_events(org_subscription_id);
CREATE INDEX subscription_events_event_time_idx ON public.subscription_events(event_time DESC);

CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  release_notes text,
  released_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_app_versions_current
  ON public.app_versions(is_current) WHERE is_current = true;
CREATE INDEX idx_app_versions_released_at
  ON public.app_versions(released_at DESC);

CREATE OR REPLACE FUNCTION public.reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_app_version()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version record;
BEGIN
  SELECT version, release_notes, released_at
  INTO v_version
  FROM public.app_versions
  WHERE is_current = true
  ORDER BY released_at DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    RETURN jsonb_build_object(
      'version','1.0.0',
      'release_notes','Initial release',
      'released_at',now()
    );
  END IF;

  RETURN jsonb_build_object(
    'version', v_version.version,
    'release_notes', v_version.release_notes,
    'released_at', v_version.released_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_app_version(
  new_version text,
  release_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.app_versions
  SET is_current = false,
      updated_at = now()
  WHERE is_current = true;

  INSERT INTO public.app_versions (version, release_notes, is_current, released_at)
  VALUES (new_version, release_notes, true, now())
  ON CONFLICT (version) DO UPDATE
    SET is_current = true,
        release_notes = COALESCE(EXCLUDED.release_notes, public.app_versions.release_notes),
        released_at = COALESCE(EXCLUDED.released_at, public.app_versions.released_at),
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'version', new_version,
    'message', 'Version updated successfully'
  );
END;
$$;

-- =====================================================
-- Canonical helpers & RPCs (roles and platform admin)
-- =====================================================

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT org_id
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT branch_id
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
  v_org_id uuid;
BEGIN
  SELECT role, org_id INTO v_role, v_org_id
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;

  IF v_role = 'org_owner' THEN
    RETURN ARRAY(SELECT id FROM public.branches WHERE org_id = v_org_id);
  ELSIF v_role IN ('branch_head','advisor','agent') THEN
    RETURN ARRAY[public.current_user_branch_id()];
  ELSE
    RETURN ARRAY[]::uuid[];
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT platform_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.require_platform_admin_aal2()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  claims jsonb;
  v_aal text;
BEGIN
  IF NOT public.current_user_is_platform_admin() THEN
    RETURN false;
  END IF;

  claims := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb,
    '{}'::jsonb
  );
  v_aal := COALESCE(claims->>'aal','');

  IF v_aal <> 'aal2' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_platform_admin_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT COALESCE(platform_admin,false) INTO v_is_admin
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  RETURN COALESCE(v_is_admin,false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_platform_admin_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_platform_admin_email(text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_default_org_for_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_org_id uuid;
  v_membership_id uuid;
  v_org_name text;
  v_org_slug text;
  v_org_record public.orgs%ROWTYPE;
  v_membership_record public.memberships%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Please create profile first.';
  END IF;

  SELECT id INTO v_membership_id
  FROM public.memberships
  WHERE profile_id = v_user_id
  LIMIT 1;

  IF v_membership_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a membership';
  END IF;

  v_org_name := 'test-' || left(v_user_id::text, 8);
  v_org_slug := 'test-' || left(v_user_id::text, 8);

  INSERT INTO public.orgs (name, slug, state, gst_enabled)
  VALUES (v_org_name, v_org_slug, 'Default', false)
  RETURNING * INTO v_org_record;

  v_org_id := v_org_record.id;

  INSERT INTO public.memberships (profile_id, org_id, role, membership_status)
  VALUES (v_profile_id, v_org_id, 'org_owner', 'active')
  RETURNING * INTO v_membership_record;

  v_membership_id := v_membership_record.id;

  RETURN json_build_object(
    'org_id', v_org_id,
    'membership_id', v_membership_id,
    'org', row_to_json(v_org_record),
    'membership', row_to_json(v_membership_record)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_default_org_for_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_membership(p_membership_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.memberships%ROWTYPE;
  v_approver_role text;
  v_approver_org_id uuid;
BEGIN
  SELECT role, org_id INTO v_approver_role, v_approver_org_id
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;

  IF v_approver_role <> 'org_owner' THEN
    RAISE EXCEPTION 'Only org owners can approve memberships';
  END IF;

  SELECT * INTO v_membership
  FROM public.memberships
  WHERE id = p_membership_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  IF v_membership.org_id <> v_approver_org_id THEN
    RAISE EXCEPTION 'Cannot approve membership from different organization';
  END IF;

  IF v_membership.membership_status <> 'pending' THEN
    RAISE EXCEPTION 'Membership is not pending approval';
  END IF;

  UPDATE public.memberships
  SET membership_status = 'active',
      updated_at = now()
  WHERE id = p_membership_id;

  RETURN json_build_object(
    'success', true,
    'membership_id', p_membership_id,
    'status', 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_membership(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_advisor_membership(
  p_profile_id uuid,
  p_branch_id uuid,
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_role text;
  v_creator_org_id uuid;
  v_creator_branch_id uuid;
  v_branch_org_id uuid;
  v_new_membership_id uuid;
BEGIN
  SELECT role, org_id, branch_id INTO v_creator_role, v_creator_org_id, v_creator_branch_id
  FROM public.memberships
  WHERE profile_id = auth.uid()
    AND membership_status = 'active'
  LIMIT 1;

  IF v_creator_role NOT IN ('org_owner','branch_head') THEN
    RAISE EXCEPTION 'Only org owners and branch heads can create advisor memberships';
  END IF;

  SELECT org_id INTO v_branch_org_id
  FROM public.branches
  WHERE id = p_branch_id;

  IF v_branch_org_id IS NULL OR v_branch_org_id <> v_creator_org_id THEN
    RAISE EXCEPTION 'Branch does not belong to your organization';
  END IF;

  IF v_creator_role = 'branch_head' AND p_branch_id <> v_creator_branch_id THEN
    RAISE EXCEPTION 'Branch heads can only create advisors in their own branch';
  END IF;

  INSERT INTO public.memberships (profile_id, org_id, branch_id, role, membership_status)
  VALUES (
    p_profile_id,
    v_creator_org_id,
    p_branch_id,
    'advisor',
    CASE WHEN v_creator_role = 'org_owner' THEN 'active' ELSE 'pending' END
  )
  RETURNING id INTO v_new_membership_id;

  RETURN json_build_object(
    'success', true,
    'membership_id', v_new_membership_id,
    'status', CASE WHEN v_creator_role = 'org_owner' THEN 'active' ELSE 'pending' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_advisor_membership(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_master_product(
  p_master_product_id uuid,
  p_action text,
  p_platform_admin_id uuid,
  p_changes jsonb DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_hsn_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_product public.master_products%ROWTYPE;
  v_previous_approval_status text;
  v_gst_rate numeric;
  v_success boolean := false;
BEGIN
  IF NOT public.require_platform_admin_aal2() THEN
    RAISE EXCEPTION 'Access denied: Platform admin with MFA (AAL2) required';
  END IF;

  IF p_platform_admin_id <> auth.uid() THEN
    RAISE EXCEPTION 'PlatformAdmin ID must match authenticated user';
  END IF;

  IF p_action NOT IN ('approve','reject','edit_and_approve') THEN
    RAISE EXCEPTION 'Invalid action. Must be approve, reject, or edit_and_approve';
  END IF;

  SELECT * INTO v_master_product
  FROM public.master_products
  WHERE id = p_master_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master product not found';
  END IF;

  v_previous_approval_status := v_master_product.approval_status;

  IF p_action IN ('approve','edit_and_approve') THEN
    IF p_hsn_code IS NULL THEN
      RAISE EXCEPTION 'HSN code is required for approval';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.hsn_master
      WHERE hsn_code = p_hsn_code
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'HSN code does not exist in hsn_master table';
    END IF;

    SELECT gst_rate INTO v_gst_rate
    FROM public.hsn_master
    WHERE hsn_code = p_hsn_code
      AND is_active = true;

    IF p_changes IS NOT NULL THEN
      UPDATE public.master_products
      SET
        name = COALESCE((p_changes->>'name')::text, name),
        category = COALESCE((p_changes->>'category')::text, category),
        base_unit = COALESCE((p_changes->>'base_unit')::text, base_unit),
        base_price = COALESCE((p_changes->>'base_price')::numeric, base_price),
        barcode_ean = COALESCE((p_changes->>'barcode_ean')::text, barcode_ean),
        updated_at = now()
      WHERE id = p_master_product_id;
    END IF;

    UPDATE public.master_products
    SET
      approval_status = 'approved',
      status = 'active',
      hsn_code = p_hsn_code,
      gst_rate = v_gst_rate,
      reviewed_by = p_platform_admin_id,
      reviewed_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = p_master_product_id;

    v_success := true;

  ELSIF p_action = 'reject' THEN
    IF p_note IS NULL OR trim(p_note) = '' THEN
      RAISE EXCEPTION 'Rejection reason is required';
    END IF;

    UPDATE public.master_products
    SET
      approval_status = 'rejected',
      reviewed_by = p_platform_admin_id,
      reviewed_at = now(),
      rejection_reason = p_note,
      updated_at = now()
    WHERE id = p_master_product_id;

    v_success := true;
  END IF;

  INSERT INTO public.master_product_reviews (
    master_product_id,
    action,
    reviewed_by,
    reviewed_at,
    note,
    field_changes,
    previous_approval_status,
    new_approval_status
  )
  VALUES (
    p_master_product_id,
    p_action,
    p_platform_admin_id,
    now(),
    p_note,
    p_changes,
    v_previous_approval_status,
    (SELECT approval_status FROM public.master_products WHERE id = p_master_product_id)
  );

  RETURN v_success;
END;
$$;

COMMENT ON FUNCTION public.review_master_product(uuid, text, uuid, jsonb, text, text) IS
'Review master product (approve/reject/edit).
SECURITY: Requires platform_admin flag AND AAL2 (MFA verified) session.
Server-side enforcement matches RLS policies. Parameter: p_platform_admin_id (canonical).';

-- =====================================================
-- RLS enablement & policies
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_item_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_portal_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dc_stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_cash_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_view_self
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
USING (id = auth.uid());

CREATE POLICY orgs_view_own
ON public.orgs
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND id = public.current_user_org_id()
);

CREATE POLICY branches_owner_all
ON public.branches
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY branches_branch_and_advisor_view
ON public.branches
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() IN ('branch_head','advisor','agent')
);

CREATE POLICY memberships_self_view
ON public.memberships
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND profile_id = auth.uid()
  AND membership_status = 'active'
);

CREATE POLICY memberships_owner_all
ON public.memberships
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY memberships_branch_manage_advisors
ON public.memberships
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND branch_id = public.current_user_branch_id()
  AND role = 'advisor'
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND branch_id = public.current_user_branch_id()
  AND role = 'advisor'
  AND membership_status IN ('pending','active')
);

CREATE POLICY memberships_view_active
ON public.memberships
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND membership_status = 'active'
);

CREATE POLICY memberships_owner_view_all
ON public.memberships
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY products_owner_all
ON public.products
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY products_branch_head_all
ON public.products
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND branch_id = public.current_user_branch_id()
);

CREATE POLICY products_advisor_read
ON public.products
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
  AND branch_id = public.current_user_branch_id()
);

CREATE POLICY customers_owner_all
ON public.customers
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY customers_branch_head_all
ON public.customers
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
);

CREATE POLICY customers_advisor_read_write
ON public.customers
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
);

CREATE POLICY stock_ledger_owner_all
ON public.stock_ledger
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY stock_ledger_branch_head_all
ON public.stock_ledger
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
);

CREATE POLICY stock_ledger_advisor_read
ON public.stock_ledger
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
);

CREATE POLICY master_customers_read
ON public.master_customers
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY customer_identifiers_read
ON public.customer_identifiers
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY master_products_read_approved
ON public.master_products
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND status = 'active'
  AND approval_status = 'approved'
);

CREATE POLICY master_products_read_platform_admin
ON public.master_products
FOR SELECT
USING (public.current_user_is_platform_admin());

CREATE POLICY master_products_read_own_pending
ON public.master_products
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND approval_status IN ('pending','auto_pass','rejected')
  AND submitted_org_id = public.current_user_org_id()
);

CREATE POLICY master_products_update_platform_admin
ON public.master_products
FOR UPDATE
USING (public.current_user_is_platform_admin())
WITH CHECK (public.current_user_is_platform_admin());

CREATE POLICY master_product_reviews_read_platform_admin
ON public.master_product_reviews
FOR SELECT
USING (public.current_user_is_platform_admin());

CREATE POLICY master_product_reviews_insert_platform_admin
ON public.master_product_reviews
FOR INSERT
WITH CHECK (public.current_user_is_platform_admin());

CREATE POLICY master_product_reviews_write_platform_admin
ON public.master_product_reviews
FOR ALL
USING (public.current_user_is_platform_admin())
WITH CHECK (public.current_user_is_platform_admin());

CREATE POLICY notifications_read_own
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY invoices_org_owner_all
ON public.invoices
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'org_owner'
);

CREATE POLICY invoices_branch_head_all
ON public.invoices
FOR ALL
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND branch_id = public.current_user_branch_id()
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'branch_head'
  AND branch_id = public.current_user_branch_id()
);

CREATE POLICY invoices_advisor_select
ON public.invoices
FOR SELECT
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
  AND branch_id = public.current_user_branch_id()
);

CREATE POLICY invoices_advisor_insert
ON public.invoices
FOR INSERT
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
  AND branch_id = public.current_user_branch_id()
);

CREATE POLICY invoices_advisor_update
ON public.invoices
FOR UPDATE
USING (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
  AND branch_id = public.current_user_branch_id()
)
WITH CHECK (
  NOT public.current_user_is_platform_admin()
  AND org_id = public.current_user_org_id()
  AND public.current_user_role() = 'advisor'
  AND branch_id = public.current_user_branch_id()
);

CREATE POLICY invoices_read_platform_admin
ON public.invoices
FOR SELECT
USING (public.current_user_is_platform_admin());

CREATE POLICY billing_plans_service_role_only
ON public.billing_plans
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY org_subscriptions_service_role_only
ON public.org_subscriptions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY subscription_events_service_role_only
ON public.subscription_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY app_versions_read_all
ON public.app_versions
FOR SELECT
USING (auth.role() = 'authenticated');

COMMIT;


