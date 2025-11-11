# Test Accounts Setup

This document describes the test accounts created for testing the reviewer dashboard system.

## Test Accounts

### Demo Account (Regular User)
- **Email**: `demo@example.com`
- **Password**: `password`
- **Role**: Org Owner (`is_internal = false`)
- **Access**: Regular user features (products, invoices, inventory, etc.)

### Internal User Account (Reviewer)
- **Email**: `internal@test.com` (default, can be customized)
- **Password**: `password` (default, can be customized)
- **Role**: Internal Reviewer (`is_internal = true`)
- **Access**: Can access `/reviewer` dashboard, review products, manage HSN codes, view blocked invoices

### Reviewer Account (Alternative)
- **Email**: `reviewer@test.com`
- **Password**: Set via Supabase Auth (recommended: `Test123!@#`)
- **Role**: Internal Reviewer (`is_internal = true`)
- **Access**: Can access `/reviewer` dashboard, review products, manage HSN codes

### Org Owner Account
- **Email**: `owner@test.com`
- **Password**: Set via Supabase Auth (recommended: `Test123!@#`)
- **Role**: Org Owner
- **Org**: Test Org (slug: `test-org-owner`)
- **Access**: Can submit products, view pending products at `/pending-products`

## Setup Instructions

### Quick Setup: Create Internal User Account

**Method 1: Using Script (Recommended)**

The easiest way to create an internal user account is using the provided script:

```bash
# Create internal user with default credentials (internal@test.com / InternalTest123!@#)
npm run create:internal-user

# Or with custom email and password
node scripts/create-internal-user.cjs internal@test.com YourPassword123!@#
```

**Prerequisites:** You need `SUPABASE_SERVICE_KEY` in your `.env` file (different from `SUPABASE_ACCESS_TOKEN`).

This script will:
1. Create auth user in Supabase Auth
2. Create profile with `is_internal = true`
3. Verify the setup
4. Test the `is_internal_user()` function

**Method 2: Using SQL (Alternative)**

If you don't have `SUPABASE_SERVICE_KEY`, you can use SQL with your transaction pooler:

1. Create auth user via Supabase Dashboard → Authentication → Users
2. Run SQL script:
   ```bash
   psql $DATABASE_URL -f scripts/create-internal-user-sql.sql
   ```
   Or paste the SQL from `scripts/create-internal-user-sql.sql` into Supabase Dashboard → SQL Editor

**For detailed instructions, see [Create Internal User Guide](./CREATE_INTERNAL_USER.md)**

### Manual Setup: Create Internal User via SQL

Alternatively, you can create an internal user manually:

#### 1. Create Auth User

Create the auth user via Supabase Dashboard:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter email: `internal@test.com`
4. Enter password: `InternalTest123!@#`
5. Click "Create User"

#### 2. Create Profile and Set is_internal

Run this SQL in Supabase SQL Editor:

```sql
-- Get the user ID from auth.users (replace email if different)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from auth
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'internal@test.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User internal@test.com not found in auth.users';
  END IF;

  -- Create or update profile with is_internal = true
  INSERT INTO profiles (id, email, full_name, is_internal)
  VALUES (v_user_id, 'internal@test.com', 'Internal Test User', true)
  ON CONFLICT (id) DO UPDATE
  SET is_internal = true;

  RAISE NOTICE 'Internal user created/updated: %', v_user_id;
END $$;
```

#### 3. Verify Setup

Verify the internal user was created correctly:

```sql
-- Check profile
SELECT id, email, is_internal, full_name
FROM profiles
WHERE email = 'internal@test.com';

-- Test is_internal_user function
SELECT is_internal_user((SELECT id FROM profiles WHERE email = 'internal@test.com'));
```

### Setup Other Test Accounts

#### 1. Create Auth Users

Create the auth users via Supabase Dashboard or Auth API:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" or use the Auth API
3. Create user with email `reviewer@test.com`
4. Create user with email `owner@test.com`
5. Set passwords (recommended: `Test123!@#`)

#### 2. Run Migration

The migration `20251110150002_create_test_accounts.sql` will:
- Create profiles for the test users (if they exist in auth)
- Create test org for owner
- Create memberships
- Create sample pending products
- Create sample HSN codes

#### 3. Mark Reviewer as Internal

After the migration runs, mark the reviewer as internal:

```sql
UPDATE profiles
SET is_internal = true
WHERE email = 'reviewer@test.com';
```

### 4. Verify Setup

1. Log in as `internal@test.com` (or `reviewer@test.com`)
   - Should see "Reviewer" link in navigation
   - Can access `/reviewer` dashboard
   - Should see pending products in review queue
   - Can manage HSN codes
   - Can view blocked invoices

2. Log in as `demo@example.com`
   - Should see regular user features
   - Can access products, invoices, inventory
   - Cannot access `/reviewer` dashboard

3. Log in as `owner@test.com`
   - Should see "My Submissions" link in navigation
   - Can access `/pending-products` page
   - Should see test products with pending status

## Test Data

### Sample Products
- **TEST-PRODUCT-001**: Test Product 1 (pending, no HSN)
- **TEST-PRODUCT-002**: Test Product 2 (pending, no HSN)

### Sample HSN Codes
- **8471**: Automatic data processing machines (18% GST)
- **8517**: Telephone sets (18% GST)
- **8528**: Monitors and projectors (18% GST)

## Testing Workflow

1. **As Owner**:
   - Submit a new product via product form
   - View pending products at `/pending-products`
   - See status updates when reviewed

2. **As Reviewer**:
   - View pending products in review queue
   - Approve/reject products with notes
   - Add HSN codes via HSN Manager
   - View blocked invoices
   - Monitor submissions

3. **Notifications**:
   - Owner receives notification when product is approved/rejected
   - Notifications appear in bell icon and `/notifications` page

## Troubleshooting

### Reviewer can't access `/reviewer`
- Check that `profiles.is_internal = true` for reviewer user
- Verify user is logged in as `reviewer@test.com`

### Owner can't see pending products
- Verify products have `submitted_org_id` matching owner's org
- Check that products have `approval_status IN ('pending', 'auto_pass', 'rejected')`

### Notifications not appearing
- Check that notification triggers are enabled
- Verify `created_by` is set on master_products
- Check notifications table for entries

