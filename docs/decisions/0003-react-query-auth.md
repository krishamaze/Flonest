# ADR-0003: React Query for Auth State Management

**Date:** 2025-11-27
**Status:** Accepted

## Context

The Flonest application requires robust authentication state management with the following requirements:

1. **Multiple Data Sources**: Session (Supabase Auth), Profile (PostgreSQL), Memberships (PostgreSQL), Agent Relationships (PostgreSQL)
2. **Real-Time Updates**: Auth state must update immediately when session changes
3. **Caching**: Avoid redundant database queries for auth data
4. **Race Conditions**: Multiple components requesting auth data simultaneously
5. **Org Context Switching**: Support switching between multiple organizations
6. **Agent Mode**: Support external agent portal with separate context

The initial implementation used manual state management in `AuthContext` with `useState`, `useEffect`, and custom caching logic. This resulted in:

- **~450 lines of boilerplate** for cache management, loading states, error handling
- **Race conditions** when multiple components mounted simultaneously
- **Stale data** due to manual cache invalidation logic
- **Duplication** across similar hooks (useProfile, useMemberships, etc.)
- **Complex logic** for coordinating multiple async operations

## Decision

We will use **React Query** as the foundation for auth state management:

1. **Replace manual state** with React Query's `useQuery` for session, profile, memberships, and agent relationships
2. **Use query keys** like `['auth', 'session']`, `['auth', 'data', userId]` for granular caching
3. **Bridge Supabase events** to React Query via `onAuthStateChange` → `queryClient.setQueryData`
4. **Centralize in AuthContext** with React Query powered hooks
5. **Export custom hooks** from `src/hooks/useAuthQuery.ts` for specific auth operations

### Architecture

```typescript
// Core auth queries (src/hooks/useAuthQuery.ts)
useSessionQuery()              // Loads Supabase session
useAuthDataQuery(session)      // Loads profile + memberships + agent relationships
useUserPasswordCheck(userId)   // Checks if user has password vs OAuth-only
useAdminMfaRequirementQuery()  // Checks if admin MFA is required

// AuthContext bridges Supabase events to React Query
supabase.auth.onAuthStateChange((event, newSession) => {
  queryClient.setQueryData(['auth', 'session'], newSession)
  if (newSession?.user) {
    queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
  } else {
    queryClient.removeQueries({ queryKey: ['auth'] })
  }
})

// Components consume via AuthContext
const { session, profile, memberships, currentOrg, isLoading } = useAuth()
```

## Alternatives Considered

### Alternative 1: Redux Toolkit
- **Pros**: Industry standard, powerful dev tools, time-travel debugging
- **Cons**: Significant boilerplate, separate from server state management (React Query), steep learning curve
- **Why rejected**: Over-engineered for auth state; React Query already handles server state

### Alternative 2: Zustand
- **Pros**: Lightweight, minimal boilerplate, simple API
- **Cons**: Still manual cache invalidation, no built-in request deduplication, separate from data fetching
- **Why rejected**: Doesn't solve the core problem (server state synchronization)

### Alternative 3: Manual State (Original Approach)
- **Pros**: Full control, no dependencies, straightforward
- **Cons**: Boilerplate-heavy, prone to race conditions, manual cache management
- **Why rejected**: 450+ lines of code vs. ~150 with React Query (70% reduction)

### Alternative 4: SWR
- **Pros**: Similar to React Query, minimal API, lightweight
- **Cons**: Less powerful mutation handling, smaller ecosystem, fewer features
- **Why rejected**: React Query has better TypeScript support and more robust mutation system

## Consequences

### Positive

- **70% Code Reduction**: From ~450 lines to ~150 lines in AuthContext
- **Automatic Deduplication**: Multiple components requesting auth data trigger single query
- **Race Condition Prevention**: React Query handles concurrent requests safely
- **Optimistic Updates**: UI updates immediately, server syncs in background
- **Automatic Retry**: Failed requests retry with exponential backoff
- **Cache Invalidation**: Declarative query key system makes invalidation simple
- **DevTools**: React Query DevTools for debugging (when enabled)
- **TypeScript Support**: Excellent type inference for query results
- **Consistency**: Same pattern used for products, invoices, etc. throughout app

### Negative

- **Dependency Added**: React Query as critical dependency (~40KB gzipped)
- **Learning Curve**: Team must understand React Query concepts (query keys, cache, invalidation)
- **Debug Complexity**: Harder to trace state flow compared to simple useState (mitigated by DevTools)
- **Abstraction**: Another layer between component and data (vs. direct state management)

### Neutral

- **Query Keys**: Must maintain consistent query key naming convention
- **Stale Time**: Requires tuning `staleTime` and `cacheTime` for optimal UX
- **Invalidation Strategy**: Must decide when to invalidate vs. refetch

## Implementation Notes

### File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx              # React Query powered auth context
├── hooks/
│   └── useAuthQuery.ts              # Auth-specific React Query hooks
└── lib/
    ├── api/
    │   └── auth.ts                  # Auth API functions
    └── supabase.ts                  # Supabase client
```

### Query Key Convention

```typescript
['auth', 'session']                    // Session query
['auth', 'data', userId]               // Profile + memberships + agent relationships
['auth', 'password-check', userId]     // Password check
['auth', 'admin-mfa', userId]          // Admin MFA requirement
```

### Migration Checklist

- [x] Install @tanstack/react-query
- [x] Create QueryClientProvider in App.tsx
- [x] Extract auth queries to useAuthQuery.ts
- [x] Refactor AuthContext to use React Query
- [x] Bridge onAuthStateChange to queryClient
- [x] Remove manual state management
- [x] Update all components using auth
- [x] Test session persistence
- [x] Test org switching
- [x] Test agent mode
- [x] Verify no regression in auth flows

### Breaking Changes

None - the AuthContext API remains the same. Internal implementation changed without affecting consumers.

## References

- [AuthContext.tsx](../../src/contexts/AuthContext.tsx) - Implementation
- [useAuthQuery.ts](../../src/hooks/useAuthQuery.ts) - Auth query hooks
- [React Query Docs](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)

---

**Author**: Development Team
**Last Updated**: 2025-11-27
