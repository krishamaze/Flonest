# Create Internal User Account

This guide explains how to create an internal user account for testing reviewer/internal user features.

## Overview

Internal users have `is_internal = true` in their profile, which grants them access to:
- `/reviewer` dashboard
- Product review functionality
- HSN code management
- Blocked invoices viewing
- All internal/admin features

## Method 1: Using Script (Recommended)

The easiest way to create an internal user account is using the provided script.

### Prerequisites

You need `SUPABASE_SERVICE_KEY` in your `.env` file:

```env
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Get this from:**
- Supabase Dashboard → Project Settings → API → Service Role Key
- ⚠️  **Important:** This is different from:
  - `VITE_SUPABASE_ANON_KEY` (anon key)
  - `SUPABASE_ACCESS_TOKEN` (CLI access token)

### Steps

1. **Add Service Role Key to .env:**
   ```env
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

2. **Run the script:**
   ```bash
   # Default credentials (internal@test.com / InternalTest123!@#)
   npm run create:internal-user

   # Or with custom credentials
   node scripts/create-internal-user.cjs internal@test.com YourPassword123!@#
   ```

3. **Verify:**
   - Script will create auth user, profile, and verify setup
   - Log in with the credentials to test

### What the Script Does

1. Creates auth user in Supabase Auth
2. Creates profile with `is_internal = true`
3. Verifies the setup
4. Tests the `is_internal_user()` function

## Method 2: Using SQL (Alternative)

If you prefer SQL or don't have `SUPABASE_SERVICE_KEY`, you can use SQL with your transaction pooler connection.

### Prerequisites

- User must be created in Supabase Auth first (via Dashboard or Auth API)
- Database connection (transaction pooler or direct connection)

### Steps

1. **Create Auth User:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter email: `internal@test.com`
   - Enter password: `InternalTest123!@#`
   - Click "Create User"

2. **Run SQL Script:**
   ```bash
   # Using transaction pooler (from .env)
   psql $DATABASE_URL -f scripts/create-internal-user-sql.sql

   # Or using direct connection
   psql $DATABASE_DIRECT_URL -f scripts/create-internal-user-sql.sql

   # Or paste the SQL into Supabase Dashboard → SQL Editor
   ```

3. **Verify:**
   ```sql
   SELECT 
     id,
     email,
     is_internal,
     is_internal_user(id) as function_test
   FROM profiles
   WHERE email = 'internal@test.com';
   ```

### SQL Script Location

- `scripts/create-internal-user-sql.sql`

## Method 3: Manual Setup via Supabase Dashboard

You can also create an internal user manually via the Supabase Dashboard.

### Steps

1. **Create Auth User:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter email: `internal@test.com`
   - Enter password: `InternalTest123!@#`
   - Click "Create User"
   - Copy the User ID

2. **Create Profile:**
   - Go to Supabase Dashboard → SQL Editor
   - Run this SQL (replace `USER_ID` with the actual user ID):
   ```sql
   INSERT INTO profiles (id, email, full_name, is_internal)
   VALUES (
     'USER_ID',  -- Replace with actual user ID
     'internal@test.com',
     'Internal Test User',
     true
   )
   ON CONFLICT (id) DO UPDATE
   SET is_internal = true;
   ```

3. **Verify:**
   ```sql
   SELECT 
     id,
     email,
     is_internal,
     is_internal_user(id) as function_test
   FROM profiles
   WHERE email = 'internal@test.com';
   ```

## Verification

After creating the internal user, verify the setup:

### 1. Check Profile
```sql
SELECT id, email, is_internal, full_name
FROM profiles
WHERE email = 'internal@test.com';
```

### 2. Test Function
```sql
SELECT is_internal_user(
  (SELECT id FROM profiles WHERE email = 'internal@test.com')
);
```

### 3. Test Login
- Log in with `internal@test.com` / `InternalTest123!@#`
- Should see "Reviewer" link in navigation
- Can access `/reviewer` dashboard
- Can review products, manage HSN codes, view blocked invoices

## Troubleshooting

### User Already Exists
If the user already exists, the script will:
- Update the existing profile to set `is_internal = true`
- Verify the setup
- Test the function

### Missing Service Role Key
If you don't have `SUPABASE_SERVICE_KEY`:
- Use Method 2 (SQL) instead
- Or get the Service Role Key from Supabase Dashboard

### User Not Found in auth.users
If you get "User not found" error:
- Create the user first via Supabase Dashboard → Authentication → Users
- Or use the script which creates the user automatically

### is_internal_user() Returns False
If the function returns false:
- Check that `profiles.is_internal = true`
- Verify the user ID matches
- Check RLS policies (should not block service role)

## Default Credentials

- **Email:** `internal@test.com`
- **Password:** `password`
- **Role:** Internal Reviewer (`is_internal = true`)

## Security Notes

- ⚠️  **Service Role Key:** Has admin access (bypasses RLS), keep it secret
- ⚠️  **Access Token:** Used for CLI operations, different from Service Role Key
- ⚠️  **Anon Key:** Used for frontend, different from Service Role Key
- ✅ **Never commit:** Service Role Key to Git
- ✅ **Use environment variables:** Store keys in `.env` file

## Related Documentation

- [Test Accounts Setup](./TEST_ACCOUNTS.md)
- [Environment Variables Setup](../ENV_SETUP.md)
- [Authentication System](../AUTHENTICATION_SYSTEM.md)

