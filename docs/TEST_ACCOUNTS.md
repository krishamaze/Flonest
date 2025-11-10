# Test Accounts Setup

This document describes the test accounts created for testing the reviewer dashboard system.

## Test Accounts

### Reviewer Account
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

### 1. Create Auth Users

Create the auth users via Supabase Dashboard or Auth API:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" or use the Auth API
3. Create user with email `reviewer@test.com`
4. Create user with email `owner@test.com`
5. Set passwords (recommended: `Test123!@#`)

### 2. Run Migration

The migration `20251110150002_create_test_accounts.sql` will:
- Create profiles for the test users (if they exist in auth)
- Create test org for owner
- Create memberships
- Create sample pending products
- Create sample HSN codes

### 3. Mark Reviewer as Internal

After the migration runs, mark the reviewer as internal:

```sql
UPDATE profiles
SET is_internal = true
WHERE email = 'reviewer@test.com';
```

### 4. Verify Setup

1. Log in as `reviewer@test.com`
   - Should see "Reviewer" link in navigation
   - Can access `/reviewer` dashboard
   - Should see pending products in review queue

2. Log in as `owner@test.com`
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

