-- Platform Authority: Master Data Governance & Abstraction Layer
-- Implements strict HSN/category mapping, inventory policies, and purchase bill validation
-- 
-- Key Changes:
-- 1. Create master_categories table (friendly abstraction layer)
-- 2. Add inventory_policy to orgs (strict/warn_allow/silent for negative stock)
-- 3. Add category_id reference to products (derive HSN/tax from master)
-- 4. Create purchase_bills table with HSN mismatch tracking
-- 5. Verify master_products verification workflow

-- =====================================================
-- 1. Master Categories: Friendly Abstraction Layer
-- =====================================================

-- Rename category_map to master_categories for clarity
-- Add proper structure with hierarchy support and explicit HSN/tax mapping
CREATE TABLE IF NOT EXISTS public.master_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_category_id uuid REFERENCES public.master_categories(id) ON DELETE SET NULL,
  hsn_code text NOT NULL REFERENCES public.hsn_master(hsn_code),
  gst_rate numeric(5,2) NOT NULL,
  gst_type text CHECK (gst_type IN ('goods','services')) DEFAULT 'goods',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_categories_gst_rate_check
    CHECK (gst_rate >= 0 AND gst_rate <= 28)
);

-- Unique index for active categories only (replaces UNIQUE constraint with WHERE clause)
-- Create this before migration to ensure uniqueness during data migration
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_categories_name_unique_active 
  ON public.master_categories(name) WHERE is_active = true;

-- Migrate existing category_map data to master_categories
DO $$
DECLARE
  v_category_record record;
BEGIN
  -- Check if category_map exists and has data
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'category_map'
  ) THEN
    -- Insert data from category_map, deriving gst_rate from hsn_master
    FOR v_category_record IN 
      SELECT DISTINCT ON (cm.category)
        cm.category,
        cm.hsn_code,
        hm.gst_rate,
        COALESCE(hm.gst_type, 'goods') as gst_type,
        cm.created_at
      FROM public.category_map cm
      JOIN public.hsn_master hm ON hm.hsn_code = cm.hsn_code
      WHERE hm.is_active = true
      ORDER BY cm.category, cm.created_at DESC
    LOOP
      -- Check if category already exists before inserting
      IF NOT EXISTS (
        SELECT 1 FROM public.master_categories 
        WHERE name = v_category_record.category AND is_active = true
      ) THEN
        INSERT INTO public.master_categories (name, hsn_code, gst_rate, gst_type, created_at)
        VALUES (
          v_category_record.category,
          v_category_record.hsn_code,
          v_category_record.gst_rate,
          v_category_record.gst_type,
          v_category_record.created_at
        );
      END IF;
    END LOOP;
  END IF;
END $$;
CREATE INDEX idx_master_categories_name ON public.master_categories(name) WHERE is_active = true;
CREATE INDEX idx_master_categories_hsn_code ON public.master_categories(hsn_code);
CREATE INDEX idx_master_categories_parent ON public.master_categories(parent_category_id) WHERE parent_category_id IS NOT NULL;
CREATE INDEX idx_master_categories_active ON public.master_categories(is_active) WHERE is_active = true;

-- =====================================================
-- 2. Inventory Policy: Organization-Level Control
-- =====================================================

-- Add inventory_policy enum to orgs table
DO $$
BEGIN
  -- Check if inventory_policy column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orgs' 
      AND column_name = 'inventory_policy'
  ) THEN
    ALTER TABLE public.orgs 
    ADD COLUMN inventory_policy text NOT NULL DEFAULT 'warn_allow'
      CHECK (inventory_policy IN ('strict','warn_allow','silent'));
    
    COMMENT ON COLUMN public.orgs.inventory_policy IS 
      'strict: Block sale if stock < 0 (high-value serial-tracked items)
       warn_allow: Show warning but allow sale (FMCG/Retail - Default)
       silent: Allow sale without warning (fast-paced trading)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orgs_inventory_policy 
  ON public.orgs(inventory_policy);

-- =====================================================
-- 3. Products: Link to Master Categories
-- =====================================================

-- Add category_id reference to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN category_id uuid REFERENCES public.master_categories(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN public.products.category_id IS 
      'Links to master_categories for HSN/tax derivation. 
       HSN and tax rate are derived from master, not stored independently.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_category_id 
  ON public.products(category_id) WHERE category_id IS NOT NULL;

-- Add helper function to derive HSN and tax from category
CREATE OR REPLACE FUNCTION public.get_product_hsn_tax(p_category_id uuid)
RETURNS TABLE (
  hsn_code text,
  gst_rate numeric,
  gst_type text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    mc.hsn_code,
    mc.gst_rate,
    mc.gst_type
  FROM public.master_categories mc
  WHERE mc.id = p_category_id
    AND mc.is_active = true;
$$;

-- =====================================================
-- 4. Purchase Bills: HSN Mismatch Tracking
-- =====================================================

-- Create purchase_bills table (Inward Supplies / GRN)
CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  bill_number text NOT NULL,
  vendor_name text,
  vendor_gstin text,
  bill_date date NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft','flagged_hsn_mismatch','approved','posted')),
  flagged_reason text,
  flagged_at timestamptz,
  flagged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_bills_org_bill_number_unique
    UNIQUE (org_id, bill_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_bill_id uuid NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  master_product_id uuid REFERENCES public.master_products(id) ON DELETE SET NULL,
  description text,
  quantity numeric(12,2) NOT NULL,
  unit text NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  -- Vendor's HSN (from invoice)
  vendor_hsn_code text,
  vendor_gst_rate numeric(5,2),
  -- System's HSN (from master)
  system_hsn_code text,
  system_gst_rate numeric(5,2),
  -- Mismatch tracking
  hsn_mismatch boolean NOT NULL DEFAULT false,
  hsn_match_status text CHECK (hsn_match_status IN ('match','mismatch','pending_verification')),
  total_amount numeric(12,2) NOT NULL,
  cost_provisional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper function to check HSN mismatch
CREATE OR REPLACE FUNCTION public.check_hsn_mismatch(
  p_product_id uuid,
  p_vendor_hsn_code text
)
RETURNS TABLE (
  matches boolean,
  system_hsn_code text,
  system_gst_rate numeric,
  vendor_hsn_code text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category_id uuid;
  v_system_hsn text;
  v_system_gst numeric;
BEGIN
  -- Get category_id from product
  SELECT category_id INTO v_category_id
  FROM public.products
  WHERE id = p_product_id;
  
  -- If no category_id, check master_product
  IF v_category_id IS NULL THEN
    SELECT 
      mp.hsn_code,
      mp.gst_rate
    INTO v_system_hsn, v_system_gst
    FROM public.products p
    JOIN public.master_products mp ON mp.id = p.master_product_id
    WHERE p.id = p_product_id;
  ELSE
    -- Get HSN from master_categories
    SELECT 
      hsn_code,
      gst_rate
    INTO v_system_hsn, v_system_gst
    FROM public.master_categories
    WHERE id = v_category_id
      AND is_active = true;
  END IF;
  
  -- Compare vendor HSN with system HSN
  -- Normalize: compare up to 4 digits (e.g., "8471" matches "84713010")
  RETURN QUERY
  SELECT 
    CASE 
      WHEN v_system_hsn IS NULL THEN false
      WHEN p_vendor_hsn_code IS NULL THEN false
      WHEN LEFT(COALESCE(v_system_hsn, ''), 4) = LEFT(COALESCE(p_vendor_hsn_code, ''), 4) THEN true
      ELSE false
    END as matches,
    v_system_hsn as system_hsn_code,
    v_system_gst as system_gst_rate,
    p_vendor_hsn_code as vendor_hsn_code;
END;
$$;

-- Indexes for purchase_bills
CREATE INDEX idx_purchase_bills_org ON public.purchase_bills(org_id);
CREATE INDEX idx_purchase_bills_branch ON public.purchase_bills(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_purchase_bills_status ON public.purchase_bills(status);
CREATE INDEX idx_purchase_bills_flagged ON public.purchase_bills(status) WHERE status = 'flagged_hsn_mismatch';
CREATE INDEX idx_purchase_bills_bill_number ON public.purchase_bills(org_id, bill_number);
CREATE INDEX idx_purchase_bills_created_at ON public.purchase_bills(created_at DESC);

-- Indexes for purchase_bill_items
CREATE INDEX idx_purchase_bill_items_bill ON public.purchase_bill_items(purchase_bill_id);
CREATE INDEX idx_purchase_bill_items_product ON public.purchase_bill_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_purchase_bill_items_master_product ON public.purchase_bill_items(master_product_id) WHERE master_product_id IS NOT NULL;
CREATE INDEX idx_purchase_bill_items_hsn_mismatch ON public.purchase_bill_items(hsn_mismatch) WHERE hsn_mismatch = true;

-- =====================================================
-- 5. Verify Master Products Verification Workflow
-- =====================================================

-- Ensure master_products has correct fields (already present in baseline, but verify)
DO $$
BEGIN
  -- Verify approval_status exists (already in baseline)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'master_products' 
      AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.master_products
    ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
      CHECK (approval_status IN ('pending','approved','rejected','auto_pass','migrated'));
  END IF;
  
  -- Verify submitted_org_id exists (already in baseline)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'master_products' 
      AND column_name = 'submitted_org_id'
  ) THEN
    ALTER TABLE public.master_products
    ADD COLUMN submitted_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 6. Stock Ledger: Support Provisional Costing
-- =====================================================

-- Add cost_provisional flag to stock_ledger for negative stock scenarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'stock_ledger' 
      AND column_name = 'cost_provisional'
  ) THEN
    ALTER TABLE public.stock_ledger 
    ADD COLUMN cost_provisional boolean NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN public.stock_ledger.cost_provisional IS 
      'True when sale occurred before purchase entry. 
       Cost uses last known purchase price. 
       Should be recalculated after purchase entry is posted.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_ledger_cost_provisional 
  ON public.stock_ledger(cost_provisional) WHERE cost_provisional = true;

-- =====================================================
-- 7. RLS Policies
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.master_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;

-- Master Categories: Read-only for authenticated users, admin write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'master_categories' 
      AND policyname = 'master_categories_read_all'
  ) THEN
    CREATE POLICY master_categories_read_all
    ON public.master_categories
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'master_categories' 
      AND policyname = 'master_categories_write_platform_admin'
  ) THEN
    CREATE POLICY master_categories_write_platform_admin
    ON public.master_categories
    FOR ALL
    USING (public.current_user_is_platform_admin())
    WITH CHECK (public.current_user_is_platform_admin());
  END IF;
END $$;

-- Purchase Bills: Org-scoped access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'purchase_bills' 
      AND policyname = 'purchase_bills_org_owner_all'
  ) THEN
    CREATE POLICY purchase_bills_org_owner_all
    ON public.purchase_bills
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'purchase_bills' 
      AND policyname = 'purchase_bills_branch_head_all'
  ) THEN
    CREATE POLICY purchase_bills_branch_head_all
    ON public.purchase_bills
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'purchase_bills' 
      AND policyname = 'purchase_bills_advisor_read_write'
  ) THEN
    CREATE POLICY purchase_bills_advisor_read_write
    ON public.purchase_bills
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'purchase_bill_items' 
      AND policyname = 'purchase_bill_items_parent_access'
  ) THEN
    CREATE POLICY purchase_bill_items_parent_access
    ON public.purchase_bill_items
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.purchase_bills pb
        WHERE pb.id = purchase_bill_items.purchase_bill_id
          AND (
            (NOT public.current_user_is_platform_admin()
             AND pb.org_id = public.current_user_org_id()
             AND public.current_user_role() IN ('org_owner','branch_head','advisor'))
            OR public.current_user_is_platform_admin()
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.purchase_bills pb
        WHERE pb.id = purchase_bill_items.purchase_bill_id
          AND (
            (NOT public.current_user_is_platform_admin()
             AND pb.org_id = public.current_user_org_id()
             AND public.current_user_role() IN ('org_owner','branch_head','advisor'))
            OR public.current_user_is_platform_admin()
          )
      )
    );
  END IF;
END $$;

-- =====================================================
-- 8. Helper Functions for Reactive Lookup
-- =====================================================

-- Cascade Lookup: Level 1 - Serial Number
CREATE OR REPLACE FUNCTION public.lookup_serial_number(
  p_org_id uuid,
  p_serial_number text
)
RETURNS TABLE (
  found boolean,
  lookup_type text,
  product_id uuid,
  product_name text,
  product_sku text,
  selling_price numeric,
  hsn_code text,
  gst_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_product_record record;
  v_category_record record;
BEGIN
  -- Level 1: Check product_serials (Serial Number lookup)
  SELECT 
    ps.product_id,
    p.name,
    p.sku,
    p.selling_price,
    p.category_id
  INTO v_product_record
  FROM public.product_serials ps
  JOIN public.products p ON p.id = ps.product_id
  WHERE ps.org_id = p_org_id
    AND ps.serial_number = trim(p_serial_number)
    AND ps.status IN ('available','reserved')
  LIMIT 1;
  
  IF v_product_record.product_id IS NOT NULL THEN
    -- Found via serial number - get HSN/tax from category
    IF v_product_record.category_id IS NOT NULL THEN
      SELECT 
        mc.hsn_code,
        mc.gst_rate
      INTO v_category_record
      FROM public.master_categories mc
      WHERE mc.id = v_product_record.category_id
        AND mc.is_active = true;
    END IF;
    
    RETURN QUERY
    SELECT 
      true as found,
      'serial_number'::text as lookup_type,
      v_product_record.product_id,
      v_product_record.product_name,
      v_product_record.product_sku,
      v_product_record.selling_price,
      COALESCE(v_category_record.hsn_code, NULL) as hsn_code,
      COALESCE(v_category_record.gst_rate, NULL) as gst_rate;
    RETURN;
  END IF;
  
  -- Not found
  RETURN QUERY
  SELECT false, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::numeric, NULL::text, NULL::numeric;
END;
$$;

-- Cascade Lookup: Level 2 - Product Code / SKU
CREATE OR REPLACE FUNCTION public.lookup_product_code(
  p_org_id uuid,
  p_code text
)
RETURNS TABLE (
  found boolean,
  lookup_type text,
  product_id uuid,
  master_product_id uuid,
  product_name text,
  product_sku text,
  selling_price numeric,
  hsn_code text,
  gst_rate numeric,
  category_id uuid,
  category_name text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_product_record record;
  v_master_record record;
  v_category_record record;
BEGIN
  -- Level 2: Check products table (SKU lookup)
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.selling_price,
    p.category_id,
    p.master_product_id
  INTO v_product_record
  FROM public.products p
  WHERE p.org_id = p_org_id
    AND p.status = 'active'
    AND (p.sku = trim(p_code) OR p.ean = trim(p_code))
  LIMIT 1;
  
  IF v_product_record.id IS NOT NULL THEN
    -- Found via SKU - get HSN/tax from category or master_product
    IF v_product_record.category_id IS NOT NULL THEN
      SELECT 
        mc.id,
        mc.name,
        mc.hsn_code,
        mc.gst_rate
      INTO v_category_record
      FROM public.master_categories mc
      WHERE mc.id = v_product_record.category_id
        AND mc.is_active = true;
    ELSIF v_product_record.master_product_id IS NOT NULL THEN
      SELECT 
        mp.hsn_code,
        mp.gst_rate
      INTO v_master_record
      FROM public.master_products mp
      WHERE mp.id = v_product_record.master_product_id
        AND mp.approval_status = 'approved'
        AND mp.status = 'active';
    END IF;
    
    RETURN QUERY
    SELECT 
      true as found,
      'product_code'::text as lookup_type,
      v_product_record.id,
      v_product_record.master_product_id,
      v_product_record.name,
      v_product_record.sku,
      v_product_record.selling_price,
      COALESCE(v_category_record.hsn_code, v_master_record.hsn_code, NULL) as hsn_code,
      COALESCE(v_category_record.gst_rate, v_master_record.gst_rate, NULL) as gst_rate,
      v_product_record.category_id,
      COALESCE(v_category_record.name, NULL) as category_name;
    RETURN;
  END IF;
  
  -- Not found - Level 3 would be handled by application (show create form)
  RETURN QUERY
  SELECT 
    false, 
    NULL::text, 
    NULL::uuid, 
    NULL::uuid, 
    NULL::text, 
    NULL::text, 
    NULL::numeric, 
    NULL::text, 
    NULL::numeric,
    NULL::uuid,
    NULL::text;
END;
$$;

