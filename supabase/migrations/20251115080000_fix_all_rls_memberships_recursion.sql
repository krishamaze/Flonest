-- Migration: Fix ALL RLS policies with memberships recursion
-- Comprehensive fix for all tables that have direct subqueries on memberships table
-- Replaces all direct memberships subqueries with helper functions to prevent infinite recursion

BEGIN;

-- ============================================================================
-- TABLE: agent_cash_ledger
-- ============================================================================

-- Policy: agent_cash_ledger_sender_admin_view
-- BEFORE: sender_org_id IN (SELECT m.org_id FROM memberships m WHERE m.profile_id = auth.uid() AND m.role = 'admin')
-- AFTER: sender_org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS agent_cash_ledger_sender_admin_view ON agent_cash_ledger;
CREATE POLICY agent_cash_ledger_sender_admin_view ON agent_cash_ledger
  FOR SELECT
  USING (
    sender_org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- Policy: agent_cash_ledger_sender_admin_verify
-- BEFORE: sender_org_id IN (SELECT m.org_id FROM memberships m WHERE m.profile_id = auth.uid() AND m.role = 'admin')
-- AFTER: sender_org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS agent_cash_ledger_sender_admin_verify ON agent_cash_ledger;
CREATE POLICY agent_cash_ledger_sender_admin_verify ON agent_cash_ledger
  FOR UPDATE
  USING (
    sender_org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: agent_portal_permissions
-- ============================================================================

-- Policy: agent_portal_permissions_sender_view
-- BEFORE: agent_relationship_id IN (SELECT ar.id FROM agent_relationships ar JOIN memberships m ON m.org_id = ar.sender_org_id WHERE m.profile_id = auth.uid() AND m.role = 'admin')
-- AFTER: Uses helper function to check admin role
DROP POLICY IF EXISTS agent_portal_permissions_sender_view ON agent_portal_permissions;
CREATE POLICY agent_portal_permissions_sender_view ON agent_portal_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM agent_relationships ar
      WHERE ar.id = agent_portal_permissions.agent_relationship_id
        AND ar.sender_org_id = current_user_org_id()
        AND current_user_role() = 'admin'
    )
  );

-- ============================================================================
-- TABLE: agent_relationships
-- ============================================================================

-- Policy: agent_relationships_sender_admin_manage
-- BEFORE: sender_org_id IN (SELECT memberships.org_id FROM memberships WHERE memberships.profile_id = auth.uid() AND memberships.role = 'admin')
-- AFTER: sender_org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS agent_relationships_sender_admin_manage ON agent_relationships;
CREATE POLICY agent_relationships_sender_admin_manage ON agent_relationships
  FOR ALL
  USING (
    sender_org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: dc_items
-- ============================================================================

-- Policy: dc_items_sender_manage
-- BEFORE: dc_id IN (SELECT delivery_challans.id FROM delivery_challans WHERE delivery_challans.sender_org_id IN (SELECT memberships.org_id FROM memberships WHERE ...))
-- AFTER: Uses helper function
DROP POLICY IF EXISTS dc_items_sender_manage ON dc_items;
CREATE POLICY dc_items_sender_manage ON dc_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM delivery_challans dc
      WHERE dc.id = dc_items.dc_id
        AND dc.sender_org_id = current_user_org_id()
        AND current_user_role() = 'admin'
    )
  );

-- ============================================================================
-- TABLE: dc_stock_ledger
-- ============================================================================

-- Policy: dc_stock_ledger_sender_view
-- BEFORE: sender_org_id IN (SELECT memberships.org_id FROM memberships WHERE memberships.profile_id = auth.uid() AND memberships.role = 'admin')
-- AFTER: sender_org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS dc_stock_ledger_sender_view ON dc_stock_ledger;
CREATE POLICY dc_stock_ledger_sender_view ON dc_stock_ledger
  FOR SELECT
  USING (
    sender_org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: delivery_challans
-- ============================================================================

-- Policy: delivery_challans_sender_manage
-- BEFORE: sender_org_id IN (SELECT memberships.org_id FROM memberships WHERE memberships.profile_id = auth.uid() AND memberships.role = 'admin')
-- AFTER: sender_org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS delivery_challans_sender_manage ON delivery_challans;
CREATE POLICY delivery_challans_sender_manage ON delivery_challans
  FOR ALL
  USING (
    sender_org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: inventory
-- ============================================================================

-- Policy: Inventory: Users can manage org inventory
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: org_id = current_user_org_id()
DROP POLICY IF EXISTS "Inventory: Users can manage org inventory" ON inventory;
CREATE POLICY "Inventory: Users can manage org inventory" ON inventory
  FOR ALL
  USING (org_id = current_user_org_id());

-- ============================================================================
-- TABLE: invoice_item_serials
-- ============================================================================

-- Policy: invoice_item_serials_tenant_isolation
-- BEFORE: EXISTS (SELECT 1 FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE ii.id = invoice_item_serials.invoice_item_id AND i.org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid()))
-- AFTER: Uses helper function
DROP POLICY IF EXISTS invoice_item_serials_tenant_isolation ON invoice_item_serials;
CREATE POLICY invoice_item_serials_tenant_isolation ON invoice_item_serials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_serials.invoice_item_id
        AND i.org_id = current_user_org_id()
    )
  );

-- ============================================================================
-- TABLE: invoice_items
-- ============================================================================

-- Policy: Invoice items: Users can manage org invoice items
-- BEFORE: invoice_id IN (SELECT i.id FROM invoices i WHERE i.org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid()))
-- AFTER: Uses helper function
DROP POLICY IF EXISTS "Invoice items: Users can manage org invoice items" ON invoice_items;
CREATE POLICY "Invoice items: Users can manage org invoice items" ON invoice_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.org_id = current_user_org_id()
    )
  );

-- ============================================================================
-- TABLE: invoices
-- ============================================================================

-- Policy: Invoices: Users can select org invoices
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: org_id = current_user_org_id()
DROP POLICY IF EXISTS "Invoices: Users can select org invoices" ON invoices;
CREATE POLICY "Invoices: Users can select org invoices" ON invoices
  FOR SELECT
  USING (org_id = current_user_org_id());

-- Policy: Invoices: Users can insert org invoices
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: org_id = current_user_org_id()
DROP POLICY IF EXISTS "Invoices: Users can insert org invoices" ON invoices;
CREATE POLICY "Invoices: Users can insert org invoices" ON invoices
  FOR INSERT
  WITH CHECK (org_id = current_user_org_id());

-- Policy: Invoices: Users can update org invoices
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: org_id = current_user_org_id()
DROP POLICY IF EXISTS "Invoices: Users can update org invoices" ON invoices;
CREATE POLICY "Invoices: Users can update org invoices" ON invoices
  FOR UPDATE
  USING (org_id = current_user_org_id())
  WITH CHECK (org_id = current_user_org_id());

-- Policy: Invoices: Users can delete org invoices
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: org_id = current_user_org_id()
DROP POLICY IF EXISTS "Invoices: Users can delete org invoices" ON invoices;
CREATE POLICY "Invoices: Users can delete org invoices" ON invoices
  FOR DELETE
  USING (org_id = current_user_org_id());

-- ============================================================================
-- TABLE: memberships
-- ============================================================================

-- Policy: Memberships: Admins can manage memberships
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid() AND m.role = 'admin')
-- AFTER: org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS "Memberships: Admins can manage memberships" ON memberships;
CREATE POLICY "Memberships: Admins can manage memberships" ON memberships
  FOR ALL
  USING (
    org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: org_cash_settings
-- ============================================================================

-- Policy: org_cash_settings_admin_manage
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m WHERE m.profile_id = auth.uid() AND m.role = 'admin')
-- AFTER: org_id = current_user_org_id() AND current_user_role() = 'admin'
DROP POLICY IF EXISTS org_cash_settings_admin_manage ON org_cash_settings;
CREATE POLICY org_cash_settings_admin_manage ON org_cash_settings
  FOR ALL
  USING (
    org_id = current_user_org_id() 
    AND current_user_role() = 'admin'
  );

-- ============================================================================
-- TABLE: orgs
-- ============================================================================

-- Policy: Orgs: Users can view orgs they belong to
-- BEFORE: id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: id = current_user_org_id()
DROP POLICY IF EXISTS "Orgs: Users can view orgs they belong to" ON orgs;
CREATE POLICY "Orgs: Users can view orgs they belong to" ON orgs
  FOR SELECT
  USING (id = current_user_org_id());

-- ============================================================================
-- TABLE: product_serials
-- ============================================================================

-- Policy: product_serials_tenant_isolation
-- BEFORE: org_id IN (SELECT m.org_id FROM memberships m JOIN profiles p ON p.id = m.profile_id WHERE p.id = auth.uid())
-- AFTER: org_id = current_user_org_id()
DROP POLICY IF EXISTS product_serials_tenant_isolation ON product_serials;
CREATE POLICY product_serials_tenant_isolation ON product_serials
  FOR ALL
  USING (org_id = current_user_org_id());

COMMIT;

