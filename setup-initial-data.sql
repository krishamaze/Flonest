-- Initial Setup Script for biz.finetune.store
-- Run this AFTER applying schema.sql

-- Step 1: Create your first tenant
-- Replace values with your actual business information
INSERT INTO tenants (name, slug, state, gst_number, gst_enabled)
VALUES (
  'My Business',           -- Your business name
  'my-business',           -- URL-friendly slug (lowercase, no spaces)
  'Maharashtra',           -- Your state (for GST calculation)
  '27XXXXX1234X1Z5',      -- Your GST number (optional, or NULL)
  true                     -- Enable GST calculations
)
RETURNING id, name, slug;

-- Note the tenant ID from the result above, you'll need it for the next step

-- Step 2: Link your user account to the tenant
-- First, get your user ID by running this query:
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then insert into team_members (replace the UUIDs and email):
INSERT INTO team_members (tenant_id, user_id, email, role)
VALUES (
  'PASTE_TENANT_ID_HERE',     -- From Step 1
  'PASTE_YOUR_USER_ID_HERE',  -- From auth.users query
  'your-email@example.com',   -- Your email
  'owner'                      -- Your role (owner has full access)
)
RETURNING *;

-- Step 3: Add some sample products to master catalog
INSERT INTO master_products (sku, name, base_price, min_selling_price, status)
VALUES 
  ('PROD-001', 'Sample Product 1', 100.00, 120.00, 'active'),
  ('PROD-002', 'Sample Product 2', 200.00, 250.00, 'active'),
  ('PROD-003', 'Sample Product 3', 50.00, 75.00, 'active')
RETURNING id, sku, name, base_price;

-- Note the product IDs from the result above

-- Step 4: Add products to your inventory
-- Replace TENANT_ID and PRODUCT_IDs with actual values
INSERT INTO inventory (tenant_id, product_id, quantity, cost_price, selling_price)
VALUES 
  ('PASTE_TENANT_ID_HERE', 'PASTE_PRODUCT_1_ID_HERE', 100, 100.00, 150.00),
  ('PASTE_TENANT_ID_HERE', 'PASTE_PRODUCT_2_ID_HERE', 50, 200.00, 300.00),
  ('PASTE_TENANT_ID_HERE', 'PASTE_PRODUCT_3_ID_HERE', 200, 50.00, 90.00)
RETURNING *;

-- Step 5: Verify everything is set up correctly
-- Check your tenant
SELECT * FROM tenants;

-- Check your team membership
SELECT * FROM team_members;

-- Check master products
SELECT * FROM master_products WHERE status = 'active';

-- Check your inventory
SELECT 
  i.id,
  i.quantity,
  i.cost_price,
  i.selling_price,
  p.sku,
  p.name as product_name
FROM inventory i
JOIN master_products p ON i.product_id = p.id
WHERE i.tenant_id = current_user_tenant_id();

-- All done! Your database is ready to use.

