# CLAUDE.md - AI Assistant Guide for Flonest

> **Last Updated**: November 27, 2025
> **Repository**: bill.finetune.store
> **Production URL**: https://bill.finetune.store
> **Main Branch**: main

This document provides comprehensive guidance for AI assistants working on the Flonest codebase. It explains the project structure, development workflows, coding conventions, and critical patterns to follow.

**⚠️ IMPORTANT**: Before making any changes, read [.cursorrules](.cursorrules) for critical project-specific rules and constraints.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Architecture](#project-architecture)
4. [Directory Structure](#directory-structure)
5. [Development Workflows](#development-workflows)
6. [Code Conventions & Patterns](#code-conventions--patterns)
7. [Authentication System](#authentication-system)
8. [Testing & Mock Auth](#testing--mock-auth)
9. [Database Operations](#database-operations)
10. [Deployment Process](#deployment-process)
11. [Critical Rules & Constraints](#critical-rules--constraints)
12. [Common Tasks](#common-tasks)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Flonest** (bill.finetune.store) is a **mobile-first Progressive Web App (PWA)** for multi-tenant inventory & sales SaaS with GST invoicing and product governance.

### Branding & Domain Strategy

- **Brand Name**: Flonest (rebranded from FineTune)
- **Current Production**: bill.finetune.store (legacy domain)
- **Target Domain**: flonest.app (purchased, pending migration)
- **First Tenant**: finetune.store — our own electronics store, powered by Flonest
- **Future**: finetune.store becomes an e-commerce storefront; Flonest powers it as SaaS

#### Target Users & Value Proposition

**Target Customers**: Electronics retailers, multi-store franchises, gadget repair centers, wholesalers & distributors (later stage).

**Industry Vertical**: Consumer electronics retail & service segment.

**Primary Value Proposition**:
- Unified platform for GST billing, inventory control, job sheets & e-commerce
- One system to run offline and online business together
- We power our own store (finetune.store) — customers use the same infrastructure

This positions Flonest as a SaaS company, not just an internal tool.

### Recent Changes (Nov 2025)

#### Authentication System Refactor
- **React Query Integration** - Migrated auth state management to React Query, achieving 70% code reduction
- **Password Detection** - Added `check_user_has_password()` function to differentiate OAuth vs password-based users
- **Mock Auth System** - Implemented comprehensive mock authentication for Playwright E2E testing
- **Auth Contract Enforcement** - Type-safe auth client interface ensures consistency between real and mock implementations

#### UI/UX Improvements
- **Role-Based Routing** - Canonical landing paths for each role (/owner, /branch, /advisor)
- **Input Normalization** - Auto-lowercase email, auto-uppercase GSTIN
- **Autofocus** - Improved form UX with automatic field focusing
- **Submission Protection** - Double-submit protection and loading states
- **Branding** - Updated to "Flonest" throughout the app

#### Database Schema Updates
- Added `check_user_has_password()` RPC function (migration 20251126000000)
- Enhanced RLS policies for agent relationships
- Added org lifecycle state management
- GST verification and tax status improvements

#### Testing Infrastructure
- Playwright configuration added
- Mock auth system for E2E tests without network calls
- Test user definitions for all roles

### Core Features
- 📱 **Mobile-First Design** - Optimized for tablets and phones
- 🔄 **Offline Support** - PWA with service worker
- 🏢 **Multi-Tenant** - Support for multiple organizations with RLS
- 📦 **Product Management** - Products, SKUs, serial numbers, stock tracking
- 📊 **Inventory Tracking** - Stock ledger with detailed audit trail
- 🧾 **GST Invoicing** - GST-compliant invoices (CGST/SGST/IGST)
- 📸 **Barcode Scanning** - Camera-based product scanning
- 👥 **Team Management** - Role-based access (PlatformAdmin, OrgOwner, BranchHead, Advisor, Agent)
- **Master Product Governance** - Internal review workflow for product catalog

### User Roles
- **PlatformAdmin** - Internal governance workspace (global access)
- **OrgOwner** - Full organization management
- **BranchHead** - Branch-level operations
- **Advisor** - Day-to-day sales and inventory workflows
- **Agent** - External agent portal access

---

## Technology Stack

### Frontend
- **React** 18.3.1 - UI framework
- **TypeScript** 5.6.3 - Type safety (strict mode enabled)
- **Vite** 6.0.1 - Build tool and dev server
- **React Router** 7.9.5 - Client-side routing
- **TailwindCSS** 4.1.16 - Utility-first styling with design tokens

### State Management & Data Fetching
- **@tanstack/react-query** 5.90.10 - Server state management, caching, optimistic updates
- **React Context** - Auth, service worker, refresh contexts

### Backend & Database
- **Supabase** 2.79.0 - Backend, PostgreSQL database, authentication, RLS
- **PostgreSQL** - Multi-tenant database with Row Level Security (RLS)

### PWA & Offline
- **vite-plugin-pwa** 1.1.0 - PWA support
- **Workbox** 7.3.0 - Service worker caching strategies

### Additional Libraries
- **Framer Motion** 11.11.17 - Animations
- **html5-qrcode** 2.3.8 - Barcode/QR code scanning
- **@heroicons/react** 2.2.0 - Icons
- **react-toastify** 11.0.5 - Toast notifications

---

## Project Architecture

### Multi-Tenant Architecture
- **Organization-scoped data** - All data belongs to an org (via `org_id`)
- **Row Level Security (RLS)** - Database-enforced access control
- **Membership-based access** - Users join orgs via memberships with roles
- **Org context switching** - Users can switch between organizations
- **Agent context support** - External agents can access specific org contexts

### Authentication Flow
1. User signs in via Supabase Auth (or mock auth in test mode)
2. System checks for profile and memberships via React Query
3. If no profile → redirect to `/unregistered`
4. If no memberships → redirect to setup flow
5. If multiple orgs → user selects org (context stored in localStorage + server-side via `set_current_org_context` RPC)
6. RLS policies enforce org-scoped data access
7. Password check performed via `check_user_has_password()` function for OAuth vs password-based users

### Data Flow Pattern
```
User Action → React Component → Custom Hook (useProducts, useInvoices, etc.)
    ↓
React Query (useQuery/useMutation)
    ↓
API Function (lib/api/*.ts)
    ↓
Supabase Client (with RLS) → PostgreSQL Database
    ↓
React Query Cache Update (optimistic or on success)
    ↓
UI Re-render
```

### State Management Strategy
- **Server State**: React Query (queries, mutations, cache) - Primary state management
- **Auth State**: AuthContext (React Query powered via `useAuthQuery` hooks - see [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx))
- **UI State**: React local state (useState, useReducer)
- **Global UI State**: Context API (RefreshContext, ServiceWorkerContext, VersionCheckContext)

**CRITICAL**: AuthContext achieved ~70% code reduction by delegating to React Query. All auth operations (session, profile, memberships, agent relationships) are managed via React Query with automatic caching, deduplication, and race-condition handling.

---

## Directory Structure

```
/
├── .cursor/               # Cursor IDE configuration
├── .cursorrules           # AI assistant coding rules (READ THIS!)
├── docs/                  # Documentation (deployment, setup, workflows)
├── public/                # Static assets (PWA icons, manifest)
├── scripts/               # Node.js utility scripts (setup, migration, etc.)
├── supabase/
│   └── migrations/        # Database migration files (SQL)
├── src/
│   ├── components/        # React components (organized by domain)
│   │   ├── ui/           # Reusable UI components (Button, Card, Input, etc.)
│   │   ├── forms/        # Form components (Product, Invoice, Customer)
│   │   ├── layout/       # Layout components (Header, BottomNav, MainLayout)
│   │   ├── invoice/      # Invoice-specific components
│   │   ├── platformAdmin/# Platform admin components
│   │   ├── advisors/     # Advisor management
│   │   ├── customers/    # Customer management
│   │   ├── notifications/# Notification components
│   │   ├── identity/     # Org/user identity components
│   │   ├── orgs/         # Organization components
│   │   ├── entry/        # Smart entry components
│   │   ├── security/     # Security (MFA, password)
│   │   └── pwa/          # PWA components (Install, Update)
│   ├── pages/            # Page components (Dashboard, Products, Invoices, etc.)
│   │   └── agent/        # Agent-specific pages
│   ├── hooks/            # Custom React hooks (useProducts, useInvoices, etc.)
│   ├── contexts/         # React contexts (AuthContext, ServiceWorkerContext, etc.)
│   ├── lib/
│   │   ├── api/         # API functions (organized by domain: products.ts, invoices.ts, etc.)
│   │   ├── utils/       # Utility functions
│   │   ├── constants/   # Constants and enums
│   │   ├── data/        # Static data
│   │   └── supabase.ts  # Supabase client configuration
│   ├── types/
│   │   ├── database.ts  # Auto-generated Supabase types (DO NOT EDIT MANUALLY)
│   │   ├── index.ts     # Application types (Product, Invoice, etc.)
│   │   └── gst.ts       # GST-related types
│   ├── styles/
│   │   ├── design-tokens.css       # Design token CSS variables
│   │   ├── design-token-classes.css# Utility classes based on tokens
│   │   └── index.css               # Global styles and imports
│   ├── config/          # Configuration files
│   ├── App.tsx          # Root app component with routing
│   └── main.tsx         # Application entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
├── vercel.json          # Vercel deployment configuration
└── .env.example         # Environment variable template
```

### Key Files to Understand

| File | Purpose |
|------|---------|
| `.cursorrules` | **READ THIS FIRST** - Contains critical coding rules, deployment workflows, and project-specific conventions |
| `src/lib/supabase.ts` | Supabase client configuration with auth settings |
| `src/contexts/AuthContext.tsx` | Auth state management (React Query powered) |
| `src/types/database.ts` | Auto-generated database types from Supabase schema |
| `src/hooks/useProducts.ts` | Example of React Query hook pattern (read this to understand the pattern) |
| `docs/DEPLOYMENT.md` | Complete deployment workflow and version management |
| `docs/MCP_WORKFLOW.md` | MCP-first workflow for database operations |

---

## Development Workflows

### 1. Local Development Setup

```bash
# 1. Clone and install
git clone <repo-url>
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Link to Supabase project (requires SUPABASE_ACCESS_TOKEN)
npm run supabase:link

# 4. Start dev server
npm run dev
# Visit http://localhost:3000
```

### 2. Working with Database

**CRITICAL**: Always use **Supabase MCP** for database operations. Never use Supabase CLI for applying migrations.

#### Creating a New Migration

```bash
# Step 1: Create migration file (CLI required - file creation only)
npm run supabase:migration:new add_new_feature

# Step 2: Write SQL in supabase/migrations/[timestamp]_add_new_feature.sql

# Step 3: Apply migration (ALWAYS use MCP - NEVER CLI)
# In Cursor: "Apply migration add_new_feature using Supabase MCP"

# Step 4: Generate TypeScript types (use MCP)
# In Cursor: "Generate TypeScript types"
```

**Never run**: `npm run supabase:db:push` or `supabase db push` - always use MCP `apply_migration` tool.

#### Common MCP Commands (via Cursor Chat)

| Task | Command |
|------|---------|
| Apply migration | "Apply migration [name]" |
| Generate types | "Generate TypeScript types" |
| Query database | "Query my database: SELECT..." |
| List tables | "List my tables" |
| View logs | "Show Supabase logs" |
| List migrations | "List all migrations" |

### 3. Git Workflow & Deployment

#### Branch Strategy
- **`main`** — Production branch (auto-deploys to bill.finetune.store)
- **`beta`** — Beta testing (auto-deploys to beta environment)
- **`marketing`** — Marketing site (SEPARATE Vercel project — DO NOT MIX)

**⚠️ Branch Cleanup Required**: Evaluate and merge/archive stale branches:
- `ui_role_flow` — pending evaluation for merge to main
- `flonest_branding` — pending evaluation
- `dev_db_testing` — experimental, evaluate for deletion
- `solid_refactor` — evaluate for merge or archive

**Active Development**: Trunk-based on `main` after branch cleanup. Use short-lived `claude/*` branches for AI-assisted features.

#### Deployment Process

**For Production (main branch):**

```bash
# 1. Make changes
git checkout main
git pull origin main

# 2. Make your changes
# ... edit files ...

# 3. Commit with descriptive message
git add .
git commit -m "feat: add new feature"

# 4. Push to trigger deployment
git push -u origin main

# 5. Verify deployment
# Vercel automatically deploys on push to main
# Check deployment status in Vercel dashboard or via Vercel MCP
```

**For Feature Branches:**

```bash
# 1. Create feature branch
git checkout -b claude/feature-name

# 2. Make changes and commit
git add .
git commit -m "feat: implement feature"

# 3. Push feature branch (use claude/ prefix)
git push -u origin claude/feature-name

# 4. Create pull request for review
```

**CRITICAL Git Rules:**
- ❌ **NEVER** merge `marketing` branch into `main`
- ❌ **NEVER** merge `main` branch into `marketing`
- ❌ **NEVER** run `vercel deploy` command - always deploy via git push
- ✅ **DO** push directly to respective branches
- ✅ **DO** let Vercel auto-deploy from branch commits
- ✅ **DO** use `git push -u origin <branch-name>` for first push
- ✅ **DO** retry push up to 4 times with exponential backoff if network fails

### 4. Version Management

The app uses a **dual version system**:

#### App Version (Automated)
- Tracks frontend code/UI changes (e.g., "1.0.1")
- Updated automatically via GitHub Action on deployment
- Defined in `package.json` and `src/lib/api/version.ts`

#### Schema Version (Manual)
- Tracks database schema changes (e.g., "2.3.0")
- Requires manual update with review, testing, and backups
- Updated via Supabase MCP or SQL Editor

**App Version Update Process:**
1. Update `version` in `package.json`
2. Update `FRONTEND_VERSION` in `src/lib/api/version.ts`
3. Commit and push to `main`
4. GitHub Action automatically updates database version

**Schema Version Update Process:**
- See `docs/SCHEMA_MIGRATION_WORKFLOW.md` for detailed guide
- Requires migration creation, testing, backup, and careful rollout

---

## Code Conventions & Patterns

### TypeScript Conventions

- **Strict mode enabled** - All TS strict checks are on
- **No `any` types** - Use proper types or `unknown` with type guards
- **Path aliases** - Use `@/` for imports from `src/` (e.g., `@/components/ui/Button`)
- **Type definitions** - Application types in `src/types/index.ts`, database types auto-generated in `src/types/database.ts`

### React Patterns

#### 1. Data Fetching with React Query

**Query Example:**
```typescript
// hooks/useProducts.ts
export const useProducts = (orgId: string | null, params: GetProductsParams = {}) => {
  return useQuery({
    queryKey: ['products', orgId, params],
    queryFn: async () => {
      if (!orgId) throw new Error('Org ID required')
      return getProducts(orgId, params)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  })
}
```

**Mutation Example with Optimistic Updates:**
```typescript
export const useCreateProduct = (orgId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (product: Partial<Product>) => {
      if (!orgId) throw new Error('Org ID required')
      return createProduct(product, orgId)
    },
    // Optimistically update cache before server responds
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ['products', orgId] })
      const previousProducts = queryClient.getQueryData(['products', orgId])

      queryClient.setQueryData(['products', orgId], (old: any) => ({
        ...old,
        data: [...(old?.data || []), { ...newProduct, id: 'temp-id' }]
      }))

      return { previousProducts }
    },
    // Revert on error
    onError: (err, newProduct, context) => {
      queryClient.setQueryData(['products', orgId], context.previousProducts)
    },
    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', orgId] })
    },
  })
}
```

#### 2. Component Organization

**Pattern: Separate UI and Logic**
- UI components in `src/components/ui/` (reusable, no business logic)
- Business logic in custom hooks (e.g., `useProducts`, `useInvoices`)
- Form components in `src/components/forms/`
- Page components in `src/pages/`

**Example Structure:**
```typescript
// components/ui/Button.tsx (pure UI component)
export const Button = ({ children, onClick, variant }: ButtonProps) => {
  return <button className={buttonClasses[variant]} onClick={onClick}>{children}</button>
}

// hooks/useProducts.ts (business logic)
export const useProducts = (orgId: string) => { /* React Query hooks */ }

// pages/ProductsPage.tsx (composition)
export const ProductsPage = () => {
  const { currentOrg } = useAuth()
  const { data: products, isLoading } = useProducts(currentOrg?.org_id)

  return <div>{/* Compose UI components */}</div>
}
```

#### 3. Context Usage

- **Minimize context usage** - Use React Query for server state
- **Use context for**: Auth, theme, global UI state
- **Don't use context for**: Data fetching, caching, server state

### Styling Conventions

**CRITICAL: Always use design tokens - NEVER hardcoded values**

#### Design Token Variables (from `src/styles/design-tokens.css`)

**Colors:**
```css
--color-primary: #E2C33D;       /* Flonest yellow */
--color-secondary: #1F2937;     /* Dark slate */
--text-primary: #000000;
--text-secondary: #374151;
--bg-page: #F5F7FA;
--bg-card: #FFFFFF;
```

**Spacing (8pt grid):**
```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
```

**Usage:**
```tsx
// ✅ CORRECT - Use utility classes from design tokens
<div className="bg-bg-card text-text-primary p-md rounded-md">

// ❌ WRONG - Hardcoded Tailwind values
<div className="bg-white text-black p-4 rounded">

// ✅ CORRECT - Use CSS variables directly if needed
<div style={{ backgroundColor: 'var(--color-primary)' }}>

// ❌ WRONG - Inline hardcoded values
<div style={{ backgroundColor: '#E2C33D' }}>
```

### API Function Patterns

**Organization:** API functions in `src/lib/api/` organized by domain

**Pattern:**
```typescript
// lib/api/products.ts
import { supabase } from '../supabase'
import type { Product } from '../../types'

export async function getProducts(
  orgId: string,
  params: GetProductsParams = {},
  options: GetProductsOptions = {}
): Promise<{ data: Product[]; total: number }> {
  // 1. Build query
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId) // Always scope to org

  // 2. Apply filters
  if (params.status) {
    query = query.eq('status', params.status)
  }

  // 3. Apply pagination
  const page = options.page || 1
  const pageSize = options.pageSize || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // 4. Execute and return
  const { data, error, count } = await query
  if (error) throw error

  return { data: data || [], total: count || 0 }
}
```

**Key Conventions:**
- Always scope queries to `org_id` (multi-tenancy)
- Always handle errors (throw or return error object)
- Use TypeScript types for parameters and return values
- Use RLS policies to enforce access control (don't bypass)

### Code Style & Philosophy

**From `.cursorrules`:**

- **Cognitive Clarity over Cleverness** - Code should be easy to understand
- **PRY over DRY** - Repeat code when it reduces cognitive load
- **Local Context** - Prefer local context over deep abstractions
- **Avoid Over-Engineering** - Only add what's needed now
- **No Premature Abstraction** - Don't create helpers for one-time operations
- **Clean Repository** - Remove temporary/unused files
- **Direct Communication** - Be clear and concise, no sugarcoating

**Examples:**

```typescript
// ✅ GOOD - Three similar lines, easy to understand
const firstName = user.firstName || 'Unknown'
const lastName = user.lastName || 'Unknown'
const email = user.email || 'Unknown'

// ❌ BAD - Premature abstraction for simple operation
const getFieldOrDefault = (obj: any, field: string) => obj[field] || 'Unknown'
const firstName = getFieldOrDefault(user, 'firstName')
```

```typescript
// ✅ GOOD - Minimal error handling for internal functions
async function getProducts(orgId: string) {
  const { data, error } = await supabase.from('products').select('*').eq('org_id', orgId)
  if (error) throw error
  return data
}

// ❌ BAD - Over-engineered error handling for internal function
async function getProducts(orgId: string) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('org_id', orgId)
    if (error) {
      logger.error('Failed to fetch products', { orgId, error })
      throw new CustomError('PRODUCTS_FETCH_FAILED', error.message)
    }
    return { success: true, data, error: null }
  } catch (err) {
    return { success: false, data: null, error: err }
  }
}
```

### Security Best Practices

- **Never commit secrets** - Use `.env` (gitignored)
- **Use RLS policies** - Enforce access control at database level
- **Validate user input** - Sanitize and validate all user-provided data
- **Avoid XSS** - Use React's built-in escaping (don't use `dangerouslySetInnerHTML`)
- **Avoid SQL injection** - Use Supabase query builder (parameterized queries)
- **No command injection** - Never execute user input as shell commands

---

## Authentication System

### React Query-Powered Auth

The authentication system is built on React Query for optimal performance and reliability. See [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx:1-459).

#### Key Features
- **70% code reduction** from manual state management
- **Automatic deduplication** - Multiple components requesting auth data trigger single query
- **Race condition prevention** - React Query handles concurrent requests
- **Optimistic updates** - UI updates immediately with server sync
- **Automatic retry** - Failed requests retry with exponential backoff
- **Cache invalidation** - Auth state updates propagate automatically

#### Auth Query Hooks

Located in [src/hooks/useAuthQuery.ts](src/hooks/useAuthQuery.ts):

```typescript
// Session query - tracks Supabase session
useSessionQuery()

// Auth data query - loads profile, memberships, agent relationships
useAuthDataQuery(session)

// Admin MFA requirement check
useAdminMfaRequirementQuery(user)

// Password check - determines if user has password vs OAuth-only
useUserPasswordCheck(userId, enabled)
```

#### Authentication Bridge

The `onAuthStateChange` listener in AuthContext bridges Supabase auth events to React Query:

```typescript
supabase.auth.onAuthStateChange((event, newSession) => {
  // Update session in React Query cache
  queryClient.setQueryData(['auth', 'session'], newSession)

  // Invalidate auth data to refetch profile/memberships
  if (newSession?.user) {
    queryClient.invalidateQueries({ queryKey: ['auth', 'data'] })
  } else {
    queryClient.removeQueries({ queryKey: ['auth'] })
  }
})
```

#### Password vs OAuth Users

The system differentiates between password-based and OAuth-only users:

**Database Function**: `check_user_has_password()` ([migration](supabase/migrations/20251126000000_add_check_user_has_password_function.sql:1-32))
- Checks `auth.users.encrypted_password` field
- Returns `true` if user has password, `false` for OAuth-only
- Used by ProtectedRoute for password reset flows

**Usage**:
```typescript
const { hasPassword, checkingPassword } = useAuth()

if (hasPassword === false) {
  // OAuth user - redirect to set password
}
```

#### Context Switching

**Organization Context**:
```typescript
// Switch to different org
await switchToOrg(orgId)
// Updates localStorage + server-side via set_current_org_context RPC
```

**Agent Context**:
```typescript
// Switch to agent mode for external agent portal
await switchToAgentMode(senderOrgId)
// Updates context mode and agent relationship
```

#### Auth State Flow

```
Initial Load
  ↓
useSessionQuery → Load session from Supabase
  ↓
useAuthDataQuery → Load profile + memberships (if session exists)
  ↓
Org Selection → Set currentOrg via switchToOrg
  ↓
RLS Policies → Database enforces org-scoped access
  ↓
React Query Cache → All components get consistent auth state
```

---

## Testing & Mock Auth

### Mock Authentication System

For E2E testing with Playwright, the app supports mock authentication mode that bypasses Supabase entirely.

#### Enabling Mock Mode

Set environment variable:
```bash
VITE_USE_MOCK=true
```

#### Mock Auth Architecture

**Files**:
- [src/lib/mockAuth.ts](src/lib/mockAuth.ts:1-145) - Mock auth implementation
- [src/contexts/MockAuthProvider.tsx](src/contexts/MockAuthProvider.tsx) - Mock auth provider
- [src/contexts/AuthProviderSwitch.tsx](src/contexts/AuthProviderSwitch.tsx) - Switches between real/mock auth

**Mock Users** (defined in mockAuth.ts):
```typescript
'owner@test.com'    → org_owner role
'branch@test.com'   → branch_head role
'advisor@test.com'  → advisor role
'agent@test.com'    → agent role
'internal@test.com' → platform_admin role
```

#### How Mock Auth Works

1. **Environment Detection**: Check `VITE_USE_MOCK === 'true'`
2. **Provider Switch**: AuthProviderSwitch selects MockAuthProvider or real AuthProvider
3. **Mock Session**: Stores session in localStorage (`mock_auth_session`)
4. **Deterministic IDs**: User IDs generated from email (e.g., `mock-owner-test-com`)
5. **Client Contract**: MockAuthProvider implements same interface as AuthContext

#### Mock Auth Contract

The mock system enforces the auth client contract via `AuthClientType`:

```typescript
// Both real and mock auth clients must implement this interface
interface AuthClientType {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<AuthResponse>
    signOut: (options?: { scope?: 'global' | 'local' }) => Promise<{ error: Error | null }>
    onAuthStateChange: (callback: AuthChangeCallback) => { data: { subscription: { unsubscribe: () => void } } }
    // ... other methods
  }
}
```

#### Usage in Tests

```typescript
// Playwright test
test('owner can create product', async ({ page }) => {
  // Set mock mode env var before starting app
  process.env.VITE_USE_MOCK = 'true'

  await page.goto('/')
  await page.fill('[name="email"]', 'owner@test.com')
  await page.fill('[name="password"]', 'any-password')
  await page.click('button[type="submit"]')

  // Now authenticated as mock owner
})
```

#### Mock vs Real Auth

| Feature | Real Auth | Mock Auth |
|---------|-----------|-----------|
| Backend | Supabase | localStorage |
| Network | Required | None |
| User Database | PostgreSQL | In-memory map |
| Speed | ~100-500ms | ~1-5ms |
| Use Case | Production, Development | E2E Tests |

#### Playwright Test Setup

The repository includes Playwright configuration:
- [playwright.config.ts](playwright.config.ts) - Playwright configuration
- [tests/](tests/) - E2E test files

**IMPORTANT**: Mock auth is for testing only. Never enable in production.

---

## Database Operations

### Schema Overview

**Key Tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (synced with auth.users) |
| `orgs` | Organizations (tenants) |
| `memberships` | User-org relationships with roles |
| `products` | Organization products |
| `master_products` | Global product catalog with governance |
| `invoices` | Sales invoices |
| `invoice_items` | Invoice line items |
| `stock_ledger` | Inventory transactions (audit trail) |
| `master_customers` | Global customer database |
| `hsn_master` | HSN codes with GST rates |
| `notifications` | User notifications |
| `purchase_bills` | Purchase bills |
| `delivery_challans` | Delivery challans for agents |
| `agent_relationships` | Agent-org relationships |

### RLS (Row Level Security)

- **Enabled on all tables** - Database enforces access control
- **Org-scoped policies** - Users can only access data from orgs they belong to
- **Role-based policies** - Different policies for different roles
- **Never bypass RLS** - Don't use service role key in client code

### Type Generation

Database types are **auto-generated** from Supabase schema:

```bash
# Generate types (use MCP)
# In Cursor: "Generate TypeScript types"

# Or via CLI (not recommended - use MCP)
npm run supabase:types
```

**Output:** `src/types/database.ts` (DO NOT EDIT MANUALLY)

**Usage:**
```typescript
import type { Database } from '@/types/database'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
```

---

## Deployment Process

### Deployment Targets

| Branch | Environment | URL | Vercel Project ID |
|--------|-------------|-----|-------------------|
| `main` | Production | https://bill.finetune.store | `prj_aMdpWV1naJP2u5F3G2CXvBVAyYBk` |
| `beta` | Beta | (beta URL) | Same project |
| `marketing` | Marketing Site | https://bizfinetunestore.vercel.app | `prj_hQdOUX5qE3jafJ8Q8iVwmJ6MWBt9` |

### Deployment Steps

1. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: description"
   ```

2. **Push to trigger deployment**
   ```bash
   git push -u origin main  # For production
   # Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) if network fails
   ```

3. **Vercel auto-deploys** - No manual intervention needed

4. **Verify deployment**
   - Use Vercel MCP to check deployment status
   - Monitor build logs if needed
   - Test deployed app

**NEVER** run `vercel deploy` command - always deploy via git push.

### Post-Deployment Verification

**ALWAYS verify deployment after push:**

```bash
# Use Vercel MCP
# In Cursor: "Check deployment status for main branch"
# Or: "List recent deployments for prj_aMdpWV1naJP2u5F3G2CXvBVAyYBk"

# Wait until state is READY (not BUILDING or ERROR)
# If ERROR, check build logs and fix immediately
```

### Environment Variables

**Required for Production (set in Vercel dashboard):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Required for GitHub Actions (set in GitHub Secrets):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (for version updates)

**Never commit** `.env` or `.env.local` to git.

---

## Critical Rules & Constraints

### 🚨 Must Follow (from `.cursorrules`)

1. **NEVER mix branches**
   - ❌ Don't merge `marketing` into `main`
   - ❌ Don't merge `main` into `marketing`
   - ✅ Keep branches completely separate

2. **ALWAYS use MCP for database operations**
   - ❌ Don't use `supabase db push` or CLI commands for migrations
   - ✅ Use Supabase MCP `apply_migration` tool

3. **NEVER create .md documentation files unless explicitly requested**
   - ❌ Don't create test results, summaries, deployment logs
   - ✅ Communicate via chat instead

4. **ALWAYS use design tokens for styling**
   - ❌ No hardcoded colors, spacing, or font sizes
   - ✅ Use CSS variables and utility classes from design-tokens.css

5. **NEVER bypass RLS policies**
   - ❌ Don't use service role key in client code
   - ✅ Trust RLS to enforce access control

6. **Avoid over-engineering**
   - ❌ No premature abstractions
   - ❌ No "future-proofing" for hypothetical requirements
   - ✅ Keep solutions simple and focused on current needs

7. **Prefer editing over creating**
   - ❌ Don't create new files if existing ones can be extended
   - ✅ Extend existing components, functions, and patterns

8. **Use React Query for server state**
   - ❌ Don't manage server state in local useState or context
   - ✅ Use useQuery/useMutation with proper cache keys

### 📝 Documentation Philosophy

- **Minimal documentation** - Document only what's necessary for future development
- **Code over comments** - Code should be self-documenting when possible
- **Prefer chat** - Communicate information via chat instead of creating docs
- **Only create .md files when explicitly requested by user**

---

## Common Tasks

### Task: Add a New Feature

**Example: Add "Favorites" to Products**

1. **Read existing code first**
   ```bash
   # Read related files
   - src/hooks/useProducts.ts
   - src/lib/api/products.ts
   - src/components/forms/ProductForm.tsx
   - src/pages/ProductsPage.tsx
   ```

2. **Update database schema**
   ```bash
   # Create migration
   npm run supabase:migration:new add_favorite_to_products

   # Write SQL in migration file
   # ALTER TABLE products ADD COLUMN is_favorite BOOLEAN DEFAULT false;

   # Apply via MCP
   # In Cursor: "Apply migration add_favorite_to_products"

   # Generate types via MCP
   # In Cursor: "Generate TypeScript types"
   ```

3. **Update API function**
   ```typescript
   // src/lib/api/products.ts
   export async function toggleProductFavorite(productId: string, isFavorite: boolean) {
     const { data, error } = await supabase
       .from('products')
       .update({ is_favorite: isFavorite })
       .eq('id', productId)
       .select()
       .single()

     if (error) throw error
     return data
   }
   ```

4. **Add React Query hook**
   ```typescript
   // src/hooks/useProducts.ts
   export const useToggleProductFavorite = (orgId: string) => {
     const queryClient = useQueryClient()

     return useMutation({
       mutationFn: ({ productId, isFavorite }: { productId: string, isFavorite: boolean }) =>
         toggleProductFavorite(productId, isFavorite),
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['products', orgId] })
       },
     })
   }
   ```

5. **Update UI component**
   ```typescript
   // src/pages/ProductsPage.tsx
   const { mutate: toggleFavorite } = useToggleProductFavorite(currentOrg?.org_id)

   <button onClick={() => toggleFavorite({ productId: product.id, isFavorite: !product.is_favorite })}>
     {product.is_favorite ? '★' : '☆'}
   </button>
   ```

6. **Test, commit, and deploy**
   ```bash
   # Test locally
   npm run dev

   # Commit
   git add .
   git commit -m "feat: add favorites to products"

   # Push to deploy
   git push -u origin claude/add-favorites
   ```

### Task: Fix a Bug

1. **Reproduce the bug**
   - Understand the expected vs actual behavior
   - Check browser console for errors
   - Check network tab for failed requests

2. **Locate the problematic code**
   - Use grep to search for relevant functions/components
   - Read related files to understand context
   - Check git history if needed (`git log --follow <file>`)

3. **Fix the issue**
   - Make minimal, focused changes
   - Follow existing patterns in the codebase
   - Don't refactor unrelated code

4. **Test the fix**
   - Verify the bug is resolved
   - Check for regressions
   - Test edge cases

5. **Commit and deploy**
   ```bash
   git add .
   git commit -m "fix: resolve issue with product filtering"
   git push -u origin claude/fix-product-filter
   ```

### Task: Update Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm install <package>@latest

# Update all patch/minor versions
npm update

# Test thoroughly after updates
npm run build
npm run lint

# Commit
git add package.json package-lock.json
git commit -m "chore: update dependencies"
git push -u origin main
```

### Task: Database Migration with Schema Change

See `docs/SCHEMA_MIGRATION_WORKFLOW.md` for detailed guide.

**Quick Reference:**
1. Create migration file: `npm run supabase:migration:new <name>`
2. Write SQL in migration file
3. Review SQL for correctness
4. Apply via MCP: "Apply migration [name]"
5. Generate types via MCP: "Generate TypeScript types"
6. Update schema version if needed
7. Update frontend code if API contracts changed
8. Test thoroughly
9. Commit and deploy

---

## Additional Resources

### Documentation Files (in `docs/`)

| File | Purpose |
|------|---------|
| `GETTING_STARTED.md` | Initial setup guide |
| `DEPLOYMENT.md` | Complete deployment workflow |
| `SCHEMA_MIGRATION_WORKFLOW.md` | Database migration process |
| `MCP_WORKFLOW.md` | MCP-first workflow |
| `ENV_SETUP.md` | Environment variable setup |
| `SUPABASE_CLI_SETUP.md` | Supabase CLI configuration |
| `CREATE_INTERNAL_USER.md` | Create platform admin accounts |
| `TEST_ACCOUNTS.md` | Test user credentials |

### Key Configuration Files

| File | Purpose |
|------|---------|
| `.cursorrules` | **READ THIS** - Critical coding rules |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Build configuration |
| `vercel.json` | Deployment configuration |
| `.env.example` | Environment variable template |

---

## Summary

When working on this codebase:

1. ✅ **Read `.cursorrules` first** - Contains critical project-specific rules
2. ✅ **Read existing code before making changes** - Understand patterns
3. ✅ **Use MCP for database operations** - Never use CLI for migrations
4. ✅ **Use React Query for data fetching** - Follow existing hook patterns
5. ✅ **Use design tokens for styling** - No hardcoded values
6. ✅ **Deploy via git push** - Never use `vercel deploy`
7. ✅ **Keep it simple** - Avoid over-engineering
8. ✅ **Test thoroughly** - Especially multi-tenant and RLS behavior
9. ✅ **Follow existing patterns** - Consistency is key

**When in doubt, ask the user for clarification before proceeding.**

---

## Troubleshooting

### Common Issues

#### 1. Local Supabase Issues

**Problem**: Storage container fails with "Migration iceberg-catalog-ids not found"

**Solution**: See [docs/LOCAL_SUPABASE_POSTMORTEM.md](docs/LOCAL_SUPABASE_POSTMORTEM.md) for complete analysis.

**Quick Fix**:
```bash
# Stop and clean Docker state
npx supabase stop
docker rm -f $(docker ps -aq --filter "name=supabase")
docker volume rm $(docker volume ls -q --filter label=com.supabase.cli.project=Flonest)

# Start fresh with latest CLI
npx supabase start
```

**Root Cause**: CLI version mismatch or corrupted Docker volumes

#### 2. Authentication Errors

**Problem**: `profile_not_found` error after login

**Cause**: User exists in auth.users but not in profiles table

**Solution**: Profile should be auto-created via trigger. Check:
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Manually create profile if needed
INSERT INTO profiles (id, email, is_internal)
VALUES ('user-id', 'user@email.com', false);
```

**Problem**: `profile_access_denied` error

**Cause**: RLS policy denying access to profile

**Solution**: Check RLS policies on profiles table

#### 3. Build Errors

**Problem**: TypeScript errors about missing types

**Solution**: Regenerate types from Supabase schema
```bash
npm run supabase:types
# Or use Supabase MCP: "Generate TypeScript types"
```

**Problem**: Vite build fails with dependency errors

**Solution**: Clean install
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 4. Deployment Issues

**Problem**: Vercel deployment stuck in BUILDING state

**Solution**:
1. Check build logs via Vercel MCP: `get_deployment_build_logs`
2. Look for errors in build output
3. Fix errors and push again

**Problem**: Deployment succeeds but app doesn't work

**Check**:
- Environment variables set correctly in Vercel dashboard
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are production values
- Database migrations applied successfully

#### 5. React Query Issues

**Problem**: Stale data showing after mutation

**Solution**: Ensure mutation invalidates correct query keys
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['products', orgId] })
}
```

**Problem**: Infinite re-renders or request loops

**Cause**: Query key changing on every render

**Solution**: Stabilize query keys with useMemo or move to constants
```typescript
// ❌ BAD - creates new object every render
queryKey: ['products', { status: 'active' }]

// ✅ GOOD - stable reference
const params = useMemo(() => ({ status: 'active' }), [])
queryKey: ['products', orgId, params]
```

#### 6. Git/Deployment Workflow

**Problem**: Push rejected or conflicts

**Solution**:
```bash
git pull origin main
# Resolve conflicts
git add .
git commit -m "fix: resolve conflicts"
git push origin main
```

**Problem**: Accidentally merged wrong branches

**CRITICAL**: Never merge `marketing` ↔ `main`

**Recovery**:
```bash
# Reset to before merge
git reset --hard HEAD~1
# Or revert merge commit
git revert -m 1 <merge-commit-hash>
```

#### 7. Mock Auth Not Working

**Problem**: Tests still hitting Supabase

**Check**:
1. `VITE_USE_MOCK=true` is set before app starts
2. Check console logs: `[mockAuth] MOCK_ENABLED: true`
3. Verify AuthProviderSwitch is using MockAuthProvider

**Problem**: Mock user not recognized

**Cause**: Email not in MOCK_USERS map

**Solution**: Use exact test emails from mockAuth.ts:
- owner@test.com
- branch@test.com
- advisor@test.com
- agent@test.com
- internal@test.com

### Debug Tools

#### React Query Devtools

Not currently enabled, but can be added:
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Add to App.tsx
<ReactQueryDevtools initialIsOpen={false} />
```

#### Browser DevTools

**Check Auth State**:
```javascript
// Console
localStorage.getItem('currentOrgId')
localStorage.getItem('mock_auth_session')
```

**Check React Query Cache**:
```javascript
// In React DevTools
// Find QueryClientProvider context
// Inspect queryClient.getQueryCache()
```

#### Supabase Logs

**Via MCP**: "Show Supabase logs"

**Via CLI**:
```bash
npx supabase logs --db
npx supabase logs --api
```

### Getting Help

1. **Check existing documentation** in `/docs/`
2. **Search codebase** for similar patterns
3. **Read .cursorrules** for project-specific rules
4. **Check recent commits** for context: `git log --oneline -20`
5. **Review migration history**: Use Supabase MCP `list_migrations`

---

**Last Updated**: November 27, 2025
**Maintained by**: FineTune Team
**Questions?** Check documentation in `/docs/` or ask in chat.
