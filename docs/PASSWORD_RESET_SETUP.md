# Password Reset Flow Setup

## Overview

The application implements a complete password reset flow using Supabase Auth. Users can request a password reset, receive an email with a recovery link, and set a new password.

## Implementation Details

### 1. Password Reset Request (`LoginPage.tsx`)

When a user clicks "Forgot your password?" and enters their email:

```typescript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
})
```

The `redirectTo` URL points to `/reset-password` route.

### 2. Reset Password Page (`ResetPasswordPage.tsx`)

- **Route**: `/reset-password`
- **URL Parameters**: 
  - `type=recovery` (required)
  - `access_token=...` (required, provided by Supabase)
- **Functionality**:
  - Validates the recovery token
  - Shows form to enter new password (min 6 characters)
  - Confirms password match
  - Updates password via `supabase.auth.updateUser({ password })`
  - Redirects to `/login` with success message on completion

### 3. AuthContext Recovery Flow Handling

The `AuthContext` is configured to:
- Skip profile loading during password recovery flow
- Prevent auto-redirect away from `/reset-password` page
- Allow the temporary session created by recovery token to exist without triggering normal auth flow

### 4. App Routes Recovery Flow Handling

The `AppRoutes` component:
- Detects when user is on `/reset-password` with recovery params
- Skips loading/error states during recovery flow
- Allows ResetPasswordPage to handle its own state

## Supabase Configuration

### Automated Configuration (Recommended)

Use the provided script to configure redirect URLs automatically:

```bash
npm run configure:redirect-urls -- \
  --site-url "https://biz-finetune-store.vercel.app" \
  --redirect-urls "https://biz-finetune-store.vercel.app/reset-password,http://localhost:3000/reset-password"
```

Or set environment variables in `.env`:
```bash
SITE_URL=https://biz-finetune-store.vercel.app
REDIRECT_URLS="https://biz-finetune-store.vercel.app/reset-password,http://localhost:3000/reset-password"
```

Then run:
```bash
npm run configure:redirect-urls
```

### Manual Configuration (Alternative)

If you prefer to configure manually via Supabase Dashboard:

1. **Allowed Redirect URLs** (Authentication → URL Configuration):
   - Add your production URL: `https://biz-finetune-store.vercel.app/reset-password`
   - Add your development URL: `http://localhost:3000/reset-password`
   - Add your preview URL: `https://your-preview-url.vercel.app/reset-password`

2. **Site URL** (Authentication → URL Configuration):
   - Set to your production domain: `https://biz-finetune-store.vercel.app`
   - This is used as the base URL for email links

### Email Template

The password reset email template should include:
```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

The `{{ .ConfirmationURL }}` variable automatically includes the `redirectTo` URL we specified in code.

## User Flow

1. User clicks "Forgot your password?" on login page
2. Enters email address and submits
3. Receives email with password reset link
4. Clicks link → lands on `/reset-password?type=recovery&access_token=...`
5. Enters new password (min 6 characters) and confirms
6. Password update succeeds
7. Redirected to `/login` with success toast: "Password reset successfully! Please sign in with your new password."

## Testing

### Test Password Reset Flow:

1. Go to `/login`
2. Click "Forgot your password?"
3. Enter a valid user email
4. Check email inbox for reset link
5. Click link (should redirect to `/reset-password` with recovery params)
6. Enter new password and confirm
7. Should redirect to `/login` with success message
8. Sign in with new password to verify

### Edge Cases Handled:

- ✅ Invalid or missing recovery token → Shows error message
- ✅ Password mismatch → Shows validation error
- ✅ Password too short → Shows validation error
- ✅ Network errors → Shows error message with retry option
- ✅ Auto-redirect prevention → User stays on reset page during recovery flow

## Security Notes

- Recovery tokens expire after 1 hour (default Supabase setting)
- Tokens are single-use (consumed after password update)
- Password validation enforced (min 6 characters)
- No spaces allowed in password fields
- Passwords are trimmed before submission

