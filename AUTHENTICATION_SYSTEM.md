# Authentication System Documentation

## Overview

The application now uses **Supabase Auth UI** for authentication with automatic user profile synchronization to the `team_members` table. This hybrid approach combines the elegant Supabase Auth UI components with our custom multi-tenant architecture.

---

## Architecture

### Components

1. **Supabase Auth UI** (`@supabase/auth-ui-react`)
   - Handles login/signup UI
   - Manages authentication state
   - Provides password reset functionality
   - Styled to match dashboard theme

2. **Custom User Sync** (`src/lib/userSync.ts`)
   - Automatically syncs `auth.users` to `team_members` table
   - Creates default tenant for new users
   - Links users to tenants with appropriate roles

3. **Auth Context** (`src/contexts/AuthContext.tsx`)
   - Maintains existing context structure
   - Automatically triggers profile sync on login
   - Provides user state to entire application

---

## Features

### ✅ Implemented Features

- **Elegant Login UI**: Supabase Auth UI styled with gray/blue theme
- **Sign Up Support**: New users can create accounts
- **Password Reset**: Forgot password functionality
- **Automatic Profile Sync**: Users automatically added to `team_members`
- **Automatic Tenant Creation**: New users get their own tenant
- **Multi-tenant Support**: Users linked to tenants with roles
- **Session Persistence**: Sessions persist across page reloads
- **Mobile Responsive**: Touch-friendly 44px minimum targets

---

## User Flow

### New User Sign Up

1. User clicks "Sign up" on login page
2. Enters email and password
3. Supabase creates account in `auth.users`
4. User receives confirmation email (if email confirmation enabled)
5. On first login:
   - `syncUserProfile()` is called automatically
   - Checks if user exists in `team_members`
   - If not, creates a new tenant: `{email}'s Company`
   - Creates `team_members` record with role `owner`
   - User is redirected to dashboard

### Existing User Login

1. User enters email and password
2. Supabase authenticates against `auth.users`
3. `AuthContext` loads user profile from `team_members`
4. If profile doesn't exist (edge case), triggers sync
5. User is redirected to dashboard with tenant context

### Password Reset

1. User clicks "Forgot your password?"
2. Enters email address
3. Receives password reset email
4. Clicks link in email
5. Sets new password
6. Redirected to login page

---

## File Structure

```
src/
├── lib/
│   ├── authTheme.ts          # Custom Auth UI theme
│   ├── userSync.ts            # User profile sync logic
│   └── supabase.ts            # Supabase client (typed)
├── contexts/
│   └── AuthContext.tsx        # Auth state management
├── pages/
│   └── LoginPage.tsx          # Login/signup UI
└── styles/
    └── index.css              # Auth UI custom styles
```

---

## Configuration

### Theme Customization

The Auth UI theme is defined in `src/lib/authTheme.ts`:

```typescript
export const customAuthTheme = {
  default: {
    colors: {
      brand: '#0284c7',           // primary-600
      brandAccent: '#0369a1',     // primary-700
      inputBorder: '#d1d5db',     // gray-300
      inputBorderFocus: '#0284c7', // primary-600
      // ... more colors
    },
    // ... fonts, spacing, radii
  },
}
```

**To customize:**
1. Edit colors in `src/lib/authTheme.ts`
2. Update CSS variables in `src/styles/index.css`
3. Rebuild the application

### Email Templates

Configure email templates in Supabase Dashboard:
1. Go to **Authentication** → **Email Templates**
2. Customize:
   - Confirmation email
   - Password reset email
   - Magic link email (if enabled)

---

## Database Schema

### `auth.users` (Managed by Supabase)

```sql
-- Supabase Auth table (read-only for us)
id          UUID PRIMARY KEY
email       VARCHAR
created_at  TIMESTAMP
-- ... other Supabase fields
```

### `team_members` (Our Profile Table)

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('owner', 'staff', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);
```

### Sync Logic

```typescript
// Automatic sync on login
if (!profileExists) {
  // Create tenant if none exists
  if (!tenantExists) {
    createTenant({
      name: `${email}'s Company`,
      slug: `${email}-${timestamp}`,
      state: 'Default',
    })
  }
  
  // Create team_members record
  createTeamMember({
    tenant_id: tenantId,
    user_id: authUser.id,
    email: authUser.email,
    role: 'owner',
  })
}
```

---

## API Reference

### `syncUserProfile(authUser: User)`

Syncs authenticated user to `team_members` table.

**Parameters:**
- `authUser`: Supabase Auth user object

**Returns:**
- `TeamMember | null`: The created/existing team member record

**Behavior:**
1. Checks if user exists in `team_members`
2. If exists, returns existing record
3. If not, creates tenant (if needed) and team member
4. Returns new team member record

**Example:**
```typescript
import { syncUserProfile } from '@/lib/userSync'

const profile = await syncUserProfile(authUser)
if (profile) {
  console.log('User synced:', profile)
}
```

### `getUserProfile(userId: string)`

Gets user profile from `team_members` table.

**Parameters:**
- `userId`: User ID from Supabase Auth

**Returns:**
- `TeamMember | null`: The team member record

**Example:**
```typescript
import { getUserProfile } from '@/lib/userSync'

const profile = await getUserProfile(userId)
```

### `needsProfileSync(userId: string)`

Checks if user needs profile sync.

**Parameters:**
- `userId`: User ID from Supabase Auth

**Returns:**
- `boolean`: True if sync is needed

---

## Styling

### Custom CSS Classes

```css
/* Auth UI container */
.auth-container { width: 100%; }

/* Auth buttons */
.auth-button {
  min-height: 44px !important;
  font-weight: 500 !important;
}

/* Auth inputs */
.auth-input {
  min-height: 44px !important;
  font-size: 16px !important;
}

/* Auth labels */
.auth-label {
  font-weight: 500 !important;
  color: rgb(55 65 81) !important;
}

/* Auth links */
.auth-anchor {
  color: var(--color-primary-600) !important;
}
```

### Mobile Optimization

- **Minimum touch targets**: 44px (Apple HIG standard)
- **Font size**: 16px (prevents iOS zoom on focus)
- **Responsive padding**: Adapts to screen size
- **Safe area insets**: Respects device notches

---

## Security

### Best Practices

✅ **Implemented:**
- Session persistence in localStorage
- Auto token refresh
- HTTPS-only cookies (production)
- Row Level Security (RLS) on all tables
- Tenant isolation via RLS policies

⚠️ **Recommended:**
- Enable email confirmation in Supabase Dashboard
- Set up password strength requirements
- Configure rate limiting for auth endpoints
- Enable MFA (Multi-Factor Authentication)

### RLS Policies

```sql
-- team_members: Users can only see their own tenant
CREATE POLICY "Users can view own tenant members"
  ON team_members FOR SELECT
  USING (tenant_id = current_user_tenant_id());

-- tenants: Users can only see their own tenant
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  USING (id = current_user_tenant_id());
```

---

## Testing

### Manual Testing Checklist

- [ ] Sign up with new email
- [ ] Verify email confirmation (if enabled)
- [ ] Login with existing account
- [ ] Test password reset flow
- [ ] Verify tenant creation for new users
- [ ] Verify team_members record creation
- [ ] Test session persistence (refresh page)
- [ ] Test logout functionality
- [ ] Test mobile responsiveness
- [ ] Test with different screen sizes

### Test Accounts

**Demo Account:**
- Email: `demo@example.com`
- Password: (set in Supabase Dashboard)
- Tenant: FineTuneTechCraft

---

## Troubleshooting

### User not appearing in team_members

**Cause:** Sync failed during signup/login

**Solution:**
1. Check browser console for errors
2. Verify database connection
3. Check RLS policies allow INSERT
4. Manually run sync:
   ```typescript
   import { syncUserProfile } from '@/lib/userSync'
   await syncUserProfile(authUser)
   ```

### Login redirects to login page

**Cause:** User profile not found in `team_members`

**Solution:**
1. Check if user exists in `auth.users`
2. Run profile sync manually
3. Verify tenant exists
4. Check RLS policies

### Auth UI not styled correctly

**Cause:** CSS not loading or theme not applied

**Solution:**
1. Clear browser cache
2. Rebuild application: `npm run build`
3. Check `src/styles/index.css` is imported
4. Verify theme in `src/lib/authTheme.ts`

---

## Future Enhancements

### Planned Features

- [ ] Social login (Google, GitHub)
- [ ] Magic link authentication
- [ ] Multi-factor authentication (MFA)
- [ ] User invitation system
- [ ] Team member management UI
- [ ] Role-based permissions UI
- [ ] Audit log for auth events

### Configuration Options

```typescript
// Future: Enable social providers
<Auth
  providers={['google', 'github']}
  // ...
/>

// Future: Enable magic link
<Auth
  magicLink={true}
  // ...
/>
```

---

## Support

For issues or questions:
1. Check Supabase Auth documentation
2. Review browser console for errors
3. Check database logs in Supabase Dashboard
4. Verify environment variables are set

---

**Last Updated:** 2025-11-05  
**Version:** 1.0.0  
**Author:** Augment Agent

