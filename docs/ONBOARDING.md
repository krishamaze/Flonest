# Onboarding Documentation

## Phase 1: Auto-Org Creation & Trial Banner

First-time owners automatically get:
- Default org created via RPC `create_default_org_for_user()`
- Owner role assigned
- Trial banner displayed on first dashboard visit

Internal users and users with existing memberships are unaffected.

### Implementation Details

**Auto-Org Creation:**
- Triggered in `AuthContext.loadUserProfile()` when a non-internal user has no active memberships
- Calls RPC function `create_default_org_for_user()` which creates:
  - A new org with auto-generated name and slug
  - A membership record with `role = 'owner'`
- On success, user context is updated with new `orgId` and `role`
- Errors are logged but don't block login (user can create org manually later)

**Trial Banner:**
- Displayed on `DashboardPage` for users who:
  - Are owners (`role === 'owner'`)
  - Have an org (`orgId` is set)
  - Are not internal users
  - Haven't dismissed the banner (localStorage key `ft_trial_banner_seen` not set)
- Banner message: "Welcome to Finetune! You're on a 3-month free trial worth ₹1999/month — ₹1000 off launch offer."
- Dismissal is stored in localStorage and persists across sessions

### Testing

1. **Fresh user (no memberships):**
   - Sign up with new email
   - On first login, org should be auto-created
   - Dashboard should show trial banner

2. **Internal user:**
   - Login as `internal@test.com`
   - Should skip org creation
   - Should not see trial banner

3. **Existing user (has membership):**
   - Login with existing account
   - Should skip org creation
   - Should not see trial banner (unless never dismissed)

4. **Banner dismissal:**
   - Click X button on banner
   - Banner should disappear
   - Refresh page - banner should not reappear

---

## Phase 1.5: Business Setup Flow

After auto-org creation, new owners are guided through a mandatory setup flow to collect essential organization information before accessing the dashboard.

### Implementation Details

**Setup Detection:**
- In `ProtectedRoute`, after verifying user has `orgId`, the org data is fetched
- Setup is required if `org.state === "Default"` (the default value from auto-creation)
- Internal users bypass this check entirely (short-circuited before org fetch)
- Users without orgs still see "Organization Required" page (existing behavior)

**Setup Page (`/setup`):**
- Standalone route (not wrapped in MainLayout) accessible to authenticated users
- Redirects to dashboard if setup already completed (prevents infinite loop)
- Form fields:
  - **Organization Name** (required): Business name
  - **State** (required): Dropdown with all Indian states and union territories
  - **Pincode** (required): 6-digit postal code with numeric validation
  - **GST Number** (optional): 15-character alphanumeric GSTIN (if registered)
- Form validation:
  - All required fields must be filled
  - Pincode must be exactly 6 digits (`/^\d{6}$/`)
  - GST number (if provided) must be 15 characters alphanumeric (`/^[A-Z0-9]{15}$/i`)
- On submit:
  - Generates unique slug from organization name (lowercase, hyphens, alphanumeric only)
  - Checks slug uniqueness and appends random suffix if collision detected
  - Updates org with: `name`, `state`, `pincode`, `gst_number`, `gst_enabled` (true if GST provided), and `slug`
  - Shows success toast and redirects to dashboard

**Database Changes:**
- Added `pincode VARCHAR(6)` column to `orgs` table (nullable for backward compatibility)
- Optional constraint can be added later: `CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$')`

**Slug Uniqueness:**
- Base slug generated from org name: lowercase, spaces → hyphens, special chars removed
- If slug exists, appends 4-character random suffix
- If still collision (very unlikely), uses timestamp-based suffix
- Ensures uniqueness for future multi-org support

### User Flow

1. User signs up → Auto-org created with `state = "Default"`
2. User logs in → `AuthContext` loads user with org
3. User navigates to `/` → `ProtectedRoute` checks `org.state === "Default"`
4. If true → Redirect to `/setup`
5. User fills form → Submits → Org updated
6. Redirect to `/` → Dashboard loads normally

### Edge Cases

- **Internal users**: Skip setup check (bypass org fetch entirely)
- **Users without org**: Still show "Organization Required" page (existing behavior)
- **Setup already completed**: Allow normal dashboard access
- **Direct `/setup` access when not needed**: Redirects to dashboard (prevents infinite loop)
- **Form validation errors**: Show inline error messages
- **Network errors**: Show error toast, allow retry
- **Slug collision**: Automatically handled with suffix generation

### Testing

1. **New user signup:**
   - Sign up with new email
   - On first login, should be auto-redirected to `/setup`
   - Fill form with valid data → Should update org and redirect to dashboard

2. **Existing user (setup completed):**
   - Login with account that has `state !== "Default"`
   - Should go straight to dashboard (no redirect)

3. **Internal user:**
   - Login as `internal@test.com`
   - Should bypass setup check entirely
   - Should go to reviewer dashboard

4. **Direct `/setup` access:**
   - After setup is complete, manually navigate to `/setup`
   - Should redirect to dashboard (prevents infinite loop)

5. **Form validation:**
   - Try submitting with empty fields → Should show errors
   - Try invalid pincode (non-6-digit) → Should show error
   - Try invalid GST (non-15-char) → Should show error

6. **Slug collision:**
   - Create org with name that would generate duplicate slug
   - Should append suffix automatically

