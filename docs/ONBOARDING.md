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

