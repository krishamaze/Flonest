-- FIN-12: Multi-Tenant Data Model Migration
-- Replace tenants/team_members with profiles/orgs/memberships
-- Implement RLS policies for tenant isolation

BEGIN;

-- Step 1: Drop old tables (CASCADE will handle dependent objects)
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Step 2: Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create orgs table (replaces tenants)
CREATE TABLE orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    gst_number VARCHAR(15),
    gst_enabled BOOLEAN DEFAULT false,
    state VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create memberships table (replaces team_members)
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('owner', 'staff', 'viewer')) DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, org_id)
);

-- Step 5: Update inventory table foreign key (tenant_id → org_id)
-- First, drop old RLS policies that depend on tenant_id
DROP POLICY IF EXISTS "Inventory: Users can view own tenant inventory" ON inventory;

-- Drop the old foreign key constraint if it exists
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_tenant_id_fkey;

-- Add new org_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory' AND column_name = 'org_id'
    ) THEN
        ALTER TABLE inventory ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Drop old tenant_id column
ALTER TABLE inventory DROP COLUMN IF EXISTS tenant_id;

-- Add foreign key constraint for org_id
ALTER TABLE inventory 
    ADD CONSTRAINT inventory_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;

-- Step 6: Update invoices table foreign key (tenant_id → org_id)
-- Drop old RLS policies that depend on tenant_id
DROP POLICY IF EXISTS "Invoices: Users can manage own tenant invoices" ON invoices;
DROP POLICY IF EXISTS "Invoice items: Users can manage own tenant invoice items" ON invoice_items;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_tenant_id_fkey;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'org_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN org_id UUID;
    END IF;
END $$;

-- Drop old tenant_id column
ALTER TABLE invoices DROP COLUMN IF EXISTS tenant_id;

-- Add foreign key constraint for org_id
ALTER TABLE invoices 
    ADD CONSTRAINT invoices_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON orgs(slug);
CREATE INDEX IF NOT EXISTS idx_memberships_profile_org ON memberships(profile_id, org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_org_product ON inventory(org_id, product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(org_id, status);

-- Step 8: Create helper functions

-- Function to get current user's org_id from memberships
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT m.org_id 
        FROM memberships m
        INNER JOIN profiles p ON p.id = m.profile_id
        WHERE p.id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is org owner
CREATE OR REPLACE FUNCTION current_user_is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT m.role = 'owner' 
        FROM memberships m
        INNER JOIN profiles p ON p.id = m.profile_id
        WHERE p.id = auth.uid() 
          AND m.org_id = current_user_org_id()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Step 10: Drop old policies if they exist (tables may already be dropped)
DO $$ 
BEGIN
    -- Drop policies on tables that might still exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        DROP POLICY IF EXISTS "Tenants: Users can view own tenant" ON tenants;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        DROP POLICY IF EXISTS "Team members: Users can view own team" ON team_members;
    END IF;
    
    -- These policies are already dropped earlier, but just in case:
    DROP POLICY IF EXISTS "Inventory: Users can view own tenant inventory" ON inventory;
    DROP POLICY IF EXISTS "Invoices: Users can manage own tenant invoices" ON invoices;
    DROP POLICY IF EXISTS "Invoice items: Users can manage own tenant invoice items" ON invoice_items;
END $$;

-- Step 11: Create RLS policies

-- Profiles: Users can SELECT/UPDATE/INSERT their own profile only
CREATE POLICY "Profiles: Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profiles: Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles: Users can update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Orgs: Users can SELECT orgs they have memberships in
CREATE POLICY "Orgs: Users can view orgs they belong to" ON orgs
    FOR SELECT USING (
        id IN (
            SELECT org_id FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid()
        )
    );

-- Memberships: Users can SELECT memberships in orgs they belong to
CREATE POLICY "Memberships: Users can view memberships in their orgs" ON memberships
    FOR SELECT USING (
        org_id IN (
            SELECT m.org_id FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid()
        )
    );

-- Memberships: Owners can INSERT/UPDATE/DELETE memberships in their org
CREATE POLICY "Memberships: Owners can manage memberships" ON memberships
    FOR ALL USING (
        org_id IN (
            SELECT m.org_id FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid() AND m.role = 'owner'
        )
    );

-- Inventory: Users can SELECT/INSERT/UPDATE/DELETE for orgs they're members of
CREATE POLICY "Inventory: Users can manage org inventory" ON inventory
    FOR ALL USING (
        org_id IN (
            SELECT m.org_id FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid()
        )
    );

-- Invoices: Users can SELECT/INSERT/UPDATE/DELETE for orgs they're members of
CREATE POLICY "Invoices: Users can manage org invoices" ON invoices
    FOR ALL USING (
        org_id IN (
            SELECT m.org_id FROM memberships m
            INNER JOIN profiles p ON p.id = m.profile_id
            WHERE p.id = auth.uid()
        )
    );

-- Invoice items: Users can manage items for invoices in their orgs
CREATE POLICY "Invoice items: Users can manage org invoice items" ON invoice_items
    FOR ALL USING (
        invoice_id IN (
            SELECT i.id FROM invoices i
            WHERE i.org_id IN (
                SELECT m.org_id FROM memberships m
                INNER JOIN profiles p ON p.id = m.profile_id
                WHERE p.id = auth.uid()
            )
        )
    );

-- Master products: All authenticated users can SELECT active products (unchanged)
DROP POLICY IF EXISTS "Master products: All authenticated users can read active" ON master_products;
CREATE POLICY "Master products: All authenticated users can read active" ON master_products
    FOR SELECT USING (status = 'active' AND auth.role() = 'authenticated');

COMMIT;

