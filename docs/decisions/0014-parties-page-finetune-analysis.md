# ADR 0014: Parties Page - FINETUNE Analysis & Implementation Strategy

**Status:** Proposed  
**Date:** 2025-12-01  
**Deciders:** Product, Engineering  

## Context

(reference mobile app) has a sophisticated Parties management system with balance tracking, transaction history, and streamlined UX. Flonest currently has a basic Customers page that lacks:
- Balance/receivables tracking ("You'll Get" feature)
- Transaction history integration
- Party details view with payment status
- Partial payment indicators
- Mobile-optimized design with floating action buttons

## Current State: Flonest

### Existing Implementation

**File:** `src/pages/CustomersPage.tsx`
- **Size:** 209 lines
- **Features:**
  - Search by name, mobile, GSTIN, email
  - Edit customer (alias_name, billing_address, notes)
  - Display basic customer info
  - Pull-to-refresh support
  
**Data Schema:**
```typescript
CustomerWithMaster {
  id, org_id, master_customer_id
  alias_name, billing_address, shipping_address, notes
  master_customer: {
    legal_name, mobile, gstin, email, address
  }
}
```

**Missing in Schema:**
- ❌ Balance/receivables tracking
- ❌ Last transaction date
- ❌ Total invoiced amount
- ❌ Paid amount
- ❌ Payment status aggregation

### Database Reality Check

**Invoice Schema** (verified):
```sql
invoices {
  id, org_id, customer_id, invoice_number
  status (draft, pending, posted, paid, cancelled)
  subtotal, cgst_amount, sgst_amount, igst_amount
  total_amount, paid_amount
  payment_status, payment_method
  created_at, updated_at
}
```

**No balance tracking columns exist in `customers` table**

## FINETUNE Analysis (from screenshots)

### Parties List View

**UI Components:**
1. **Header Stats Cards**
   - "You'll Get" total receivables
   - "Sale (Dec)" monthly revenue with % change
   - Additional metric (truncated in screenshot)

2. **Party List Items**
   - Primary: Party name (e.g., "Jaswin Mantharasalam 86101...")
   - Secondary: Date (e.g., "01 Dec 2025")
   - Right-aligned: Balance amount with "You'll Get" label
   - Visual hierarchy with green accent color

3. **Search & Actions**
   - Search bar: "SEARCH PARTY"
   - Filter button
   - "+ New Party" button
   - Bottom FAB: "Take Payment", "+", "Add Sale"

### Party Details View

**UI Components:**
1. **Header Card** (Light blue background)
   - Party name with ID/phone
   - "Receivable: ₹ 4,798.00" (green)
   - "No Credit Limit Set"
   - Action buttons: "Send Reminder", "Send Statement"

2. **Transaction List**
   - Card-based design
   - Sale number (e.g., "#2526FT1534")
   - Date (01 Dec, 25)
   - "PARTIAL" status badge (cyan)
   - Total: ₹ 12,999.00
   - Balance: ₹ 4,178.00
   - Actions: Print, Share, More (...)

3. **Bottom Actions**
   - Same FAB pattern as list view

### Key Features Identified

1. **Balance Tracking**
   - Aggregated "You'll Get" receivables
   - Per-party receivable amount
   - Payment status tracking (PARTIAL, PAID)

2. **Transaction History**
   - Linked to party details
   - Partial payment support
   - Sale document references

3. **Mobile-First UX**
   - Floating Action Buttons (FAB)
   - Card-based layouts
   - Touch-optimized spacing (min 44px)
   - Visual status indicators

4. **Quick Actions**
   - Take Payment (primary action)
   - Add Sale
   - Send reminders/statements

## Gap Analysis

### Critical Missing Features

| Feature | FINETUNE | Flonest | Priority |
|---------|----------|---------|----------|
| Balance tracking | ✅ | ❌ | **P0** |
| Transaction history | ✅ | ❌ | **P0** |
| Payment status | ✅ | ❌ | **P0** |
| Partial payment UI | ✅ | ❌ | P1 |
| Dashboard stats | ✅ | ❌ | P1 |
| FAB actions | ✅ | ❌ | P2 |
| Send reminders | ✅ | ❌ | P3 |
| Credit limits | ✅ | ❌ | P3 |

### Database Gaps

**Need to implement:**
1. ❌ Materialized view or RPC for balance aggregation
2. ❌ Query to fetch customer invoices sorted by date
3. ❌ Payment status derivation logic

**Existing (can leverage):**
✅ `invoices` table with `total_amount`, `paid_amount`  
✅ `customers` table with org scoping  
✅ RPC infrastructure (`search_org_customers`)

## Decision

### Phase 1: Balance Tracking (P0)

**Create Database Function:**
```sql
-- RPC: get_customer_balances(org_id)
-- Returns: customer_id, total_invoiced, total_paid, balance_due, last_invoice_date
```

**Update Customers API:**
```typescript
// lib/api/customers.ts
export async function getCustomersWithBalances(orgId: string): Promise<CustomerWithBalance[]>
```

**Update Types:**
```typescript
interface CustomerWithBalance extends CustomerWithMaster {
  total_invoiced: number
  total_paid: number
  balance_due: number
  last_invoice_date: string | null
}
```

### Phase 2: Party Details View (P0)

**New Component:** `src/pages/PartyDetailsPage.tsx`
- Route: `/customers/:customerId`
- Displays customer header card
- Lists invoices for customer
- Shows payment status badges

**Database Query:**
```sql
-- Get customer invoices with payment status
SELECT id, invoice_number, total_amount, paid_amount, created_at,
       CASE 
         WHEN paid_amount = 0 THEN 'unpaid'
         WHEN paid_amount >= total_amount THEN 'paid'
         ELSE 'partial'
       END as payment_status
FROM invoices
WHERE customer_id = $1 AND status != 'draft'
ORDER BY created_at DESC
```

### Phase 3: Dashboard Stats (P1)

**Top Stats Cards:**
- Total Receivables ("You'll Get")
- This Month Revenue
- Active Customers Count

**Implementation:**
```typescript
// hooks/useCustomerStats.ts
export function useCustomerStats(orgId: string) {
  // Aggregate from customer balances
}
```

### Phase 4: Mobile UX Enhancements (P2)

**FAB Component (Reusable):**
```typescript
// components/ui/FloatingActionButton.tsx
<FAB actions={[
  { label: 'Take Payment', icon: '💰', onClick: ... },
  { label: 'Add Sale', icon: '+', onClick: ... }
]} />
```

## Implementation Strategy

### Constraints
- **No code bloat:** Reuse existing components
- **No schema changes:** Use computed queries
- **Minimal migrations:** Only add RPC functions

### File Changes

**New Files (strict minimum):**
1. `lib/api/customers-balances.ts` - Balance aggregation logic
2. `hooks/useCustomerBalances.ts` - React Query hook
3. `pages/PartyDetailsPage.tsx` - Details view
4. `components/customer/CustomerBalanceCard.tsx` - Balance display

**Modified Files:**
1. `pages/CustomersPage.tsx` - Add balance display, link to details
2. `types/index.ts` - Add `CustomerWithBalance` type
3. `App.tsx` - Add route for party details

**Database:**
1. New migration: `create_customer_balance_rpc.sql`

### Anti-Bloat Measures

**DON'T:**
- ❌ Create new API layers
- ❌ Add state management libraries
- ❌ Create wrapper components
- ❌ Duplicate invoice query logic

**DO:**
- ✅ Extend existing `useCustomers` hook
- ✅ Reuse `Card`, `Button`, `Badge` from `ui/`
- ✅ Leverage React Query caching
- ✅ Use existing invoice fetching patterns

## Consequences

### Positive
- Matches FINETUNE's UX for balance tracking
- Enables payment collection workflows
- Provides business-critical receivables visibility
- Uses existing infrastructure (no tech debt)

### Negative
- Adds computed query overhead (mitigated by React Query cache)
- Requires careful index planning for balance aggregation
- Mobile FAB pattern may conflict with existing button layouts

### Risks
- **Performance:** Aggregating balances across many invoices
  - **Mitigation:** Add composite index on `(customer_id, status)`
  - **Mitigation:** Cache results in React Query for 30s
- **Data Accuracy:** Partial payment calculations
  - **Mitigation:** Use database-level computed fields
  - **Mitigation:** Add validation in RPC function

## Next Steps

1. **Review & Approve:** This ADR
2. **Create RPC Migration:** Balance aggregation function
3. **Implement Phase 1:** Balance tracking API + UI
4. **Test:** Verify performance with 100+ customers, 1000+ invoices
5. **Implement Phase 2:** Party details view
6. **User Testing:** Validate UX matches expectations

## References

- FINETUNE Screenshots: User-provided (Parties list, Party details)
- Existing Flonest Schema: `invoices` table verified via MCP
- Current Implementation: `src/pages/CustomersPage.tsx` (209 lines)
- Related: ADR 0008 Invoice Refactoring (hook patterns)
