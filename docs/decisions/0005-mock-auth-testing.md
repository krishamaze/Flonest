# ADR-0005: Mock Authentication for E2E Testing

**Date:** 2025-11-27
**Status:** Accepted

## Context

End-to-end (E2E) testing with Playwright requires authentication to test protected routes and user flows. Testing against the real Supabase authentication system presents several challenges:

1. **Network Dependency**: Each test must make HTTP requests to Supabase auth API (~100-500ms per request)
2. **Test Isolation**: Tests can conflict if using shared test accounts
3. **Rate Limiting**: Supabase may rate-limit auth requests during test runs
4. **Cost**: Auth operations count toward Supabase usage limits
5. **Flakiness**: Network issues or Supabase downtime causes test failures
6. **Speed**: Slow auth flows make test suite sluggish (critical for CI/CD)
7. **Complexity**: Managing test user cleanup and state reset

Real authentication also requires:
- Valid Supabase credentials in test environment
- Database setup with test users
- Email verification (or bypass configuration)
- Session management across test runs

For a test suite with 50+ tests, real auth could add 5-25 seconds of overhead, plus introduce flakiness.

## Decision

We will implement a **mock authentication system** for E2E testing that bypasses Supabase entirely:

### Architecture

1. **Environment Flag**: `VITE_USE_MOCK=true` enables mock mode
2. **Provider Switch**: `AuthProviderSwitch` selects `MockAuthProvider` or real `AuthProvider`
3. **Mock Implementation**: `src/lib/mockAuth.ts` provides in-memory auth client
4. **Deterministic Users**: Predefined test users with consistent IDs
5. **localStorage Session**: Session stored locally (no network calls)
6. **Contract Enforcement**: `AuthClientType` interface ensures mock matches real auth

### Mock Users

```typescript
// src/lib/mockAuth.ts
const MOCK_USERS = {
  'owner@test.com': {
    id: 'mock-owner-test-com',
    email: 'owner@test.com',
    role: 'org_owner',
    org_id: 'mock-org-finetune',
    org_name: 'Test Organization',
  },
  'branch@test.com': { role: 'branch_head', ... },
  'advisor@test.com': { role: 'advisor', ... },
  'agent@test.com': { role: 'agent', ... },
  'internal@test.com': { role: 'platform_admin', ... },
}
```

### Usage in Tests

```typescript
// Playwright test
test('owner can create product', async ({ page }) => {
  // Mock mode enabled via env var
  await page.goto('/')

  // Login with any password (mock doesn't validate)
  await page.fill('[name="email"]', 'owner@test.com')
  await page.fill('[name="password"]', 'any-password')
  await page.click('button[type="submit"]')

  // Now authenticated as mock owner
  await expect(page).toHaveURL('/owner')
})
```

### Implementation Details

```typescript
// src/contexts/AuthProviderSwitch.tsx
export function AuthProviderSwitch({ children }: { children: React.ReactNode }) {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true'

  if (useMock) {
    return <MockAuthProvider>{children}</MockAuthProvider>
  }

  return <AuthProvider>{children}</AuthProvider>
}

// src/lib/mockAuth.ts
export const mockAuthClient = {
  auth: {
    signInWithPassword: async ({ email, password }) => {
      const user = MOCK_USERS[email]
      if (!user) {
        return { data: null, error: new Error('Invalid credentials') }
      }

      const session = {
        user: { id: user.id, email: user.email },
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000,
      }

      localStorage.setItem('mock_auth_session', JSON.stringify(session))
      return { data: { session, user: session.user }, error: null }
    },
    signOut: async () => {
      localStorage.removeItem('mock_auth_session')
      return { error: null }
    },
    getSession: async () => {
      const stored = localStorage.getItem('mock_auth_session')
      if (!stored) return { data: { session: null }, error: null }
      const session = JSON.parse(stored)
      return { data: { session }, error: null }
    },
    onAuthStateChange: (callback) => {
      // Trigger callback immediately with current session
      const stored = localStorage.getItem('mock_auth_session')
      const session = stored ? JSON.parse(stored) : null
      setTimeout(() => callback('SIGNED_IN', session), 0)
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
  },
}
```

## Alternatives Considered

### Alternative 1: Real Auth with Test Accounts
- **Pros**: Tests real auth flow, catches auth-related bugs
- **Cons**: Slow (~100-500ms per test), network dependency, flaky
- **Why rejected**: Speed and reliability more important for E2E suite

### Alternative 2: Supabase Auth Mock Library
- **Pros**: Official support, maintained by Supabase
- **Cons**: No official mock library exists; would need to build anyway
- **Why rejected**: Not available

### Alternative 3: MSW (Mock Service Worker)
- **Pros**: Intercept network requests, mock at HTTP level
- **Cons**: More complex setup, still involves network layer, harder to debug
- **Why rejected**: Over-engineered for auth mocking; custom solution simpler

### Alternative 4: Test Database with Real Auth
- **Pros**: Tests full integration, realistic environment
- **Cons**: Requires separate Supabase project for testing, costly, slow
- **Why rejected**: Too expensive and slow for CI/CD

## Consequences

### Positive

- **50-100x Faster**: ~1-5ms vs. ~100-500ms for real auth
- **Zero Network Dependency**: Tests run offline
- **Perfect Isolation**: Each test gets fresh mock session
- **Deterministic**: Same email always produces same user ID
- **No Rate Limiting**: Unlimited auth operations
- **Cost Savings**: No Supabase auth usage during tests
- **Simplified Setup**: No test user management
- **Reliable**: No network flakiness

### Negative

- **Not Testing Real Auth**: Auth bugs won't be caught by E2E tests
- **Divergence Risk**: Mock behavior could drift from real auth
- **Maintenance Overhead**: Must keep mock in sync with auth changes
- **False Confidence**: Passing tests don't guarantee real auth works
- **No OAuth Testing**: Cannot test Google/GitHub login flows

### Neutral

- **Additional Code**: ~150 lines for mock implementation
- **Environment Variable**: Must set `VITE_USE_MOCK=true` for tests
- **Test-Only**: Mock never used in production (enforced by env var)

## Implementation Notes

### File Structure

```
src/
├── lib/
│   └── mockAuth.ts                  # Mock auth client implementation
├── contexts/
│   ├── MockAuthProvider.tsx         # Mock auth context provider
│   ├── AuthProviderSwitch.tsx       # Switches based on env var
│   └── AuthContext.tsx              # Real auth context
└── types/
    └── authClient.ts                # AuthClientType interface
```

### Contract Enforcement

The mock must implement `AuthClientType` interface:

```typescript
// src/types/authClient.ts
interface AuthClientType {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<AuthResponse>
    signOut: (options?: { scope?: 'global' | 'local' }) => Promise<{ error: Error | null }>
    getSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>
    onAuthStateChange: (callback: AuthChangeCallback) => { data: { subscription: { unsubscribe: () => void } } }
    // ... other methods
  }
}
```

This ensures the mock provides the same interface as real Supabase client.

### Safety Guards

**Production Protection**:
```typescript
// src/lib/mockAuth.ts
if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCK === 'true') {
  console.error('[mockAuth] CRITICAL: Mock auth enabled in production!')
  throw new Error('Mock auth cannot be used in production')
}
```

**Console Warnings**:
```typescript
console.warn('[mockAuth] MOCK_ENABLED: Using mock authentication')
console.warn('[mockAuth] This should only be used in testing')
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'VITE_USE_MOCK=true npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Testing Checklist

- [x] Implement mockAuth.ts with all auth methods
- [x] Create MockAuthProvider matching AuthProvider API
- [x] Add AuthProviderSwitch with env var check
- [x] Define MOCK_USERS for all roles
- [x] Add production safety guards
- [x] Configure Playwright to use mock mode
- [x] Write test examples for each role
- [x] Verify localStorage session persistence
- [x] Test sign in/sign out flows
- [x] Verify no network calls in mock mode

## References

- [mockAuth.ts](../../src/lib/mockAuth.ts) - Mock implementation
- [MockAuthProvider.tsx](../../src/contexts/MockAuthProvider.tsx) - Mock provider
- [AuthProviderSwitch.tsx](../../src/contexts/AuthProviderSwitch.tsx) - Provider switch
- [playwright.config.ts](../../playwright.config.ts) - Test configuration
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Notes

**When to Use Real Auth:**
- Manual testing before production deployment
- Testing auth edge cases (expired sessions, token refresh, etc.)
- Debugging auth-related issues

**When to Use Mock Auth:**
- Automated E2E test suite (Playwright, Cypress)
- Local development when Supabase is down
- CI/CD pipeline tests

**Important:** Mock auth is a **testing tool only**. Production deployments must never have `VITE_USE_MOCK=true`.

---

**Author**: Development Team
**Last Updated**: 2025-11-27
