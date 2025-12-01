# ADR 0015: Customer Management UX Overhaul

**Status:** Proposed  
**Date:** 2025-12-01  
**Deciders:** Product, Engineering  

## Context

User feedback has identified several critical UX issues with customer management:
1. **No delete functionality** - Current system lacks customer deletion with transaction checks
2. **Scattered actions** - Edit button in card, no clear deletion path
3. **Navigation clutter** - Top/bottom nav appears on all screens, violating mobile UX best practices
4. **Not modern** - Doesn't align with 2025 mobile UI/UX standards

Reference screenshots show:
- **Image 1:** Party Details page with edit icon in top bar, transactions list
- **Image 2:** Edit Party form with Delete/Update buttons split at bottom
- **Image 3:** Edit Party page showing form fields

## Root Cause Analysis

### 1. **Missing Delete Functionality**

**Current State:**
- No `deleteCustomer` function in `src/hooks/useCustomers.ts`
- No `deleteCustomer` API in `src/lib/api/customers.ts`
- CustomerForm has no delete option (`CustomerForm.tsx`)

**Database Reality:**
```typescript
// Customer has org-level data
customers {
  id, org_id, master_customer_id
  alias_name, billing_address, notes
}

// Invoices reference customers
invoices {
  customer_id  // Foreign key
}
```

**Constraint Required:**
- Cannot delete customer if `invoices.customer_id` references exist
- Must check invoice count before deletion

### 2. **Scattered Action Pattern (Anti-Pattern)**

**Current Implementation:**
```tsx
// CustomersPage.tsx (lines 194-202)
// Edit button INSIDE card
<button onClick={() => handleEditClick(customer)}>
  <PencilIcon />
</button>

// CustomerForm.tsx (lines 163-169)
// Actions at bottom
<Button onClick={onClose}>Cancel</Button>
<Button type="submit">Update Customer</Button>
```

**Problem:**
- Edit action is in card (CustomersPage)
- Delete would be in modal footer (CustomerForm)
- No consistent action hierarchy

### 3. **Navigation Clutter**

**Current Architecture:**
```
App.tsx
├── Layout
│   ├── TopNav (all pages)
│   ├── BottomNav (all pages)
│   └── <Outlet />
```

**User Observation:** Top/bottom nav not necessary everywhere

**2025 Standards Violation:**
- Modern mobile apps use **bottom sheets** for secondary screens
- **Context-specific navigation** replaces persistent navbars
- **Gesture-based back** (swipe) preferred over static nav buttons

### 4. **Modern Mobile UX Standards (2025)**

**Research Findings:**

**✅ DO (Best Practices):**
1. **Bottom Sheets for Actions** - Edit/delete in contextual bottom sheet
2. **Thumb Zone Optimization** - Actions within bottom 1/3 of screen
3. **Clear Visual Hierarchy** - Primary action (Update) vs. destructive (Delete)
4. **Minimal Touch Targets** - 44x44 pixels minimum
5. **Gestural Navigation** - Swipe-to-go-back, long-press for context
6. **Confirmation for Destructive Actions** - Delete must confirm
7. **Clear Feedback** - Visual/haptic response for all actions

**❌ DON'T (Anti-Patterns):**
1. **Persistent Navigation on All Screens** - Use contextual navigation
2. **Scattered Actions** - Keep related actions together
3. **No Confirmation for Delete** - Always confirm destructive actions
4. **Complex Multi-Step Processes** - Streamline action flows

Reference: 
- Material Design 3 (Google)
- iOS Human Interface Guidelines (Apple)
- Mobile UX Research 2025 (Vertex AI)

## Decision

### **CONFIRMED APPROACH**
1. ✅ **Soft Delete with 30-Day Expiry** - Allows undo/restore and audit trail
2. ✅ **Ellipsis Menu Button** - On each customer card
3. ✅ **Full-Screen Navigation** - Hide top/bottom nav on Party Details and wherever possible

### **Phase 1: Soft Delete with Time Expiry (P0)**

**1.1 Database Schema Update**
```sql
-- Add deleted_at column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create index for soft-deleted customers
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at 
ON customers(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- RPC: can_delete_customer(customer_id)
-- Returns: { can_delete: boolean, invoice_count: integer }
CREATE OR REPLACE FUNCTION can_delete_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_count integer;
BEGIN
  -- Check if customer has any invoices (excluding drafts)
  SELECT COUNT(*) INTO v_invoice_count
  FROM invoices 
  WHERE customer_id = p_customer_id 
  AND status != 'draft';
  
  RETURN json_build_object(
    'can_delete', v_invoice_count = 0,
    'invoice_count', v_invoice_count
  );
END;
$$;

-- RPC: soft_delete_customer(customer_id)
-- Soft deletes customer if no transactions exist
CREATE OR REPLACE FUNCTION soft_delete_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_can_delete_result json;
  v_can_delete boolean;
  v_invoice_count integer;
BEGIN
  -- Check if deletion is allowed
  SELECT can_delete_customer(p_customer_id) INTO v_can_delete_result;
  v_can_delete := (v_can_delete_result->>'can_delete')::boolean;
  v_invoice_count := (v_can_delete_result->>'invoice_count')::integer;
  
  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'Cannot delete customer with % existing transactions', v_invoice_count
      USING HINT = 'Customer has active invoices and cannot be deleted';
  END IF;
  
  -- Soft delete: set deleted_at timestamp
  UPDATE customers 
  SET deleted_at = NOW()
  WHERE id = p_customer_id 
  AND deleted_at IS NULL;
  
  RETURN json_build_object(
    'success', true, 
    'deleted_at', NOW(),
    'expires_at', NOW() + INTERVAL '30 days'
  );
END;
$$;

-- RPC: restore_customer(customer_id)
-- Restores a soft-deleted customer if within 30-day window
CREATE OR REPLACE FUNCTION restore_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_at timestamptz;
  v_days_since_delete integer;
BEGIN
  -- Get deletion timestamp
  SELECT deleted_at INTO v_deleted_at
  FROM customers
  WHERE id = p_customer_id;
  
  IF v_deleted_at IS NULL THEN
    RAISE EXCEPTION 'Customer is not deleted'
      USING HINT = 'Only soft-deleted customers can be restored';
  END IF;
  
  -- Check if within 30-day restore window
  v_days_since_delete := EXTRACT(DAY FROM NOW() - v_deleted_at);
  
  IF v_days_since_delete > 30 THEN
    RAISE EXCEPTION 'Restore window expired (% days ago)', v_days_since_delete
      USING HINT = 'Customers can only be restored within 30 days of deletion';
  END IF;
  
  -- Restore customer
  UPDATE customers 
  SET deleted_at = NULL
  WHERE id = p_customer_id;
  
  RETURN json_build_object(
    'success', true,
    'restored_at', NOW(),
    'was_deleted_for_days', v_days_since_delete
  );
END;
$$;

-- Scheduled cleanup: Auto-purge customers deleted > 30 days ago
-- This would typically be run as a cron job or pg_cron task
CREATE OR REPLACE FUNCTION cleanup_expired_deleted_customers()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purged_count integer;
BEGIN
  -- Hard delete customers deleted > 30 days ago
  WITH deleted AS (
    DELETE FROM customers
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_purged_count FROM deleted;
  
  RETURN json_build_object(
    'purged_count', v_purged_count,
    'purged_at', NOW()
  );
END;
$$;
```

**1.2 Add API Functions**
```typescript
// lib/api/customers.ts

export interface DeleteCheckResult {
  can_delete: boolean
  invoice_count: number
}

export interface DeleteResult {
  success: boolean
  deleted_at: string
  expires_at: string
}

export interface RestoreResult {
  success: boolean
  restored_at: string
  was_deleted_for_days: number
}

export async function canDeleteCustomer(customerId: string): Promise<DeleteCheckResult> {
  const { data, error } = await supabase
    .rpc('can_delete_customer', { p_customer_id: customerId })
  
  if (error) throw new Error(`Failed to check delete eligibility: ${error.message}`)
  return data as DeleteCheckResult
}

export async function softDeleteCustomer(customerId: string): Promise<DeleteResult> {
  const { data, error } = await supabase
    .rpc('soft_delete_customer', { p_customer_id: customerId })
  
  if (error) {
    if (error.message.includes('existing transactions')) {
      throw new Error(error.message)
    }
    throw new Error(`Failed to delete customer: ${error.message}`)
  }
  
  return data as DeleteResult
}

export async function restoreCustomer(customerId: string): Promise<RestoreResult> {
  const { data, error } = await supabase
    .rpc('restore_customer', { p_customer_id: customerId })
  
  if (error) {
    if (error.message.includes('not deleted')) {
      throw new Error('Customer is not deleted')
    }
    if (error.message.includes('expired')) {
      throw new Error(error.message)
    }
    throw new Error(`Failed to restore customer: ${error.message}`)
  }
  
  return data as RestoreResult
}

// Update existing queries to filter out soft-deleted customers
export async function getCustomersByOrg(orgId: string): Promise<CustomerWithMaster[]> {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      master_customer:master_customers(*)
    `)
    .eq('org_id', orgId)
    .is('deleted_at', null)  // ← Filter out soft-deleted
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch customers: ${error.message}`)
  return data as CustomerWithMaster[]
}
```

**1.3 Add React Query Hooks**
```typescript
// hooks/useCustomers.ts

export const useSoftDeleteCustomer = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<DeleteResult, Error, { customerId: string }>({
    mutationFn: async ({ customerId }) => softDeleteCustomer(customerId),
    
    onMutate: async ({ customerId }) => {
      // Optimistic update: remove from list
      await queryClient.cancelQueries({ queryKey: ['customers', orgId] })
      const previousCustomers = queryClient.getQueryData<CustomerWithMaster[]>(['customers', orgId])
      
      if (previousCustomers) {
        queryClient.setQueryData<CustomerWithMaster[]>(
          ['customers', orgId],
          previousCustomers.filter(c => c.id !== customerId)
        )
      }
      
      return { previousCustomers }
    },
    
    onError: (_error, _variables, context) => {
      // Revert optimistic update
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers', orgId], context.previousCustomers)
      }
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      queryClient.invalidateQueries({ queryKey: ['customer-balances', orgId] })
    }
  })
}

export const useRestoreCustomer = (orgId: string | null | undefined) => {
  const queryClient = useQueryClient()

  return useMutation<RestoreResult, Error, { customerId: string }>({
    mutationFn: async ({ customerId }) => restoreCustomer(customerId),
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', orgId] })
      queryClient.invalidateQueries({ queryKey: ['customer-balances', orgId] })
    }
  })
}

export const useCanDeleteCustomer = (customerId: string | null | undefined) => {
  return useQuery<DeleteCheckResult>({
    queryKey: ['can-delete-customer', customerId],
    queryFn: async () => {
      if (!customerId) return { can_delete: false, invoice_count: 0 }
      return canDeleteCustomer(customerId)
    },
    enabled: !!customerId,
    staleTime: 0, // Always check fresh
  })
}
```

### **Phase 2: Ellipsis Menu Pattern (P0)**

**2.1 Create ActionSheet Component**

```tsx
// components/ui/ActionSheet.tsx
import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'

export interface ActionSheetItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface ActionSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  items: ActionSheetItem[]
}

export function ActionSheet({ isOpen, onClose, title, items }: ActionSheetProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        {/* Sheet Container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="translate-y-0"
              leaveTo="translate-y-full"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-2xl bg-bg-card shadow-xl transition-all">
                {/* Header */}
                {title && (
                  <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                    <Dialog.Title className="text-base font-medium text-primary-text">
                      {title}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="rounded-md p-1.5 text-muted-text hover:bg-neutral-100"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="p-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        item.onClick()
                        onClose()
                      }}
                      disabled={item.disabled}
                      className={`
                        flex w-full items-center gap-3 rounded-lg px-4 py-3
                        min-h-[44px] text-left transition-colors
                        ${item.variant === 'destructive' 
                          ? 'text-error hover:bg-error/10' 
                          : 'text-primary-text hover:bg-neutral-100'
                        }
                        ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* Safe area for mobile */}
                <div className="h-safe-bottom" />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
```

**2.2 Update Customer Card with Ellipsis Menu**

```tsx
// CustomersPage.tsx - Update card rendering

{filteredCustomers.map((customer) => {
  const master = customer.master_customer
  const displayName = customer.alias_name || master?.legal_name || 'Unknown'
  
  return (
    <div key={customer.id} className="relative">
      <Link to={`/customers/${customer.id}`}>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Customer info... */}
              
              {/* Ellipsis Menu Button */}
              <div className="shrink-0">
                <button
                  onClick={(e) => {
                    e.preventDefault() // Don't navigate
                    e.stopPropagation()
                    setActiveCustomer(customer)
                    setShowActionSheet(true)
                  }}
                  className="rounded-md p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-secondary-text hover:bg-neutral-100"
                  aria-label="More actions"
                >
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
})}

{/* Action Sheet */}
<ActionSheet
  isOpen={showActionSheet}
  onClose={() => setShowActionSheet(false)}
  title={activeCustomer?.alias_name || activeCustomer?.master_customer?.legal_name}
  items={[
    {
      id: 'edit',
      label: 'Edit Customer',
      icon: <PencilIcon className="h-5 w-5" />,
      onClick: () => handleEditClick(activeCustomer!)
    },
    {
      id: 'delete',
      label: 'Delete Customer',
      icon: <TrashIcon className="h-5 w-5" />,
      onClick: () => handleDeleteClick(activeCustomer!),
      variant: 'destructive',
      disabled: deleteCheck?.invoice_count > 0
    }
  ]}
/>
```

### **Phase 3: Full-Screen Navigation (P1)**

**3.1 Conditional Layout Rendering**

```tsx
// components/layout/Layout.tsx

import { useLocation, matchPath } from 'react-router-dom'

const FULL_SCREEN_PATHS = [
  '/customers/:id',
  '/invoices/:id',
  '/purchase-bills/:id'
]

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  
  const isFullScreen = FULL_SCREEN_PATHS.some(pattern => 
    matchPath(pattern, location.pathname)
  )
  
  return (
    <div className="flex min-h-screen flex-col">
      {!isFullScreen && <TopNav />}
      
      <main className="flex-1 bg-bg-primary">
        {children}
      </main>
      
      {!isFullScreen && <BottomNav />}
    </div>
  )
}
```

**3.2 Update PartyDetailsPage for Full-Screen**

```tsx
// pages/PartyDetailsPage.tsx

export function PartyDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showActionMenu, setShowActionMenu] = useState(false)
  
  // ... existing code ...
  
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-bg-card border-b border-neutral-200">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md p-2 hover:bg-neutral-100"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          
          <h1 className="text-lg font-semibold text-primary-text">
            Party Details
          </h1>
          
          <button
            onClick={() => setShowActionMenu(true)}
            className="rounded-md p-2 hover:bg-neutral-100"
            aria-label="More actions"
          >
            <EllipsisVerticalIcon className="h-6 w-6" />
          </button>
        </div>
      </header>
      
      {/* Scrollable Content */}
      <main className="p-4 pb-safe space-y-4">
        {/* Customer info, transactions... */}
      </main>
      
      {/* Action Sheet */}
      <ActionSheet
        isOpen={showActionMenu}
        onClose={() => setShowActionMenu(false)}
        items={[
          {
            id: 'edit',
            label: 'Edit Customer',
            icon: <PencilIcon className="h-5 w-5" />,
            onClick: () => handleEdit()
          },
          {
            id: 'delete',
            label: 'Delete Customer',
            icon: <TrashIcon className="h-5 w-5" />,
            onClick: () => handleDelete(),
            variant: 'destructive'
          }
        ]}
      />
    </div>
  )
}
```

## Implementation Plan

### Files to Create
1. `supabase/migrations/YYYYMMDDHHSS_add_customer_delete_functions.sql` - RPC functions
2. `src/components/ui/ActionSheet.tsx` - Reusable bottom sheet for actions
3. `src/components/customer/CustomerActions.tsx` - Customer-specific action sheet

### Files to Modify
1. `src/hooks/useCustomers.ts` - Add delete hooks
2. `src/lib/api/customers.ts` - Add delete functions
3. `src/components/forms/CustomerForm.tsx` - Add delete button, conditional rendering
4. `src/pages/CustomersPage.tsx` - Remove edit button from card, add action sheet
5. `src/pages/PartyDetailsPage.tsx` - Add full-screen header with context menu
6. `src/components/layout/Layout.tsx` - Conditional nav rendering

### Migration Steps
1. ✅ Create and test RPC functions in Supabase (use MCP)
2. ✅ Add CustomerForm delete button (conditional on `canDelete`)
3. ✅ Test delete with transaction check
4. ✅ Create ActionSheet component
5. ✅ Refactor CustomersPage to use action sheet
6. ✅ Update PartyDetailsPage for full-screen UX
7. ✅ Implement conditional navigation
8. ✅ User testing validation

## Consequences

### Positive
- ✅ Modern 2025 mobile UX compliance
- ✅ Transaction safety (cannot delete customers with invoices)
- ✅ Cleaner, less cluttered UI
- ✅ Gesture-based, intuitive interactions
- ✅ Consistent action patterns across app

### Negative
- ⚠️ Requires learning new navigation pattern (mitigated by standard gestures)
- ⚠️ More complex conditional rendering logic
- ⚠️ Additional RPC functions (minor overhead)

### Risks
- **Data Safety:** Accidental deletion
  - **Mitigation:** Transaction check + confirmation dialog
- **UX Confusion:** Hidden actions
  - **Mitigation:** Visual hints (ellipsis icon), onboarding tooltips
- **Performance:** RPC call overhead
  - **Mitigation:** React Query caching, optimistic updates

## Validation Criteria

### Functional Requirements
- [ ] Customer with invoices cannot be deleted
- [ ] Customer without invoices deletes successfully
- [ ] Delete confirmation dialog appears
- [ ] Error message shows transaction count on failed delete
- [ ] Optimistic update reverts on error

### UX Requirements
- [ ] Actions accessible within 44px touch target
- [ ] Action sheet opens on long-press
- [ ] Delete button clearly marked as destructive (red text)
- [ ] Top/bottom nav hidden on details pages
- [ ] Back gesture works on Party Details
- [ ] All actions provide haptic/visual feedback

### Performance Requirements
- [ ] Delete check completes in <200ms
- [ ] Optimistic update feels instant
- [ ] No UI jank during action sheet animations

## References

- Screenshots: User-provided Party Details/Edit screens
- ADR 0014: Parties Page FINETUNE Analysis
- Material Design 3: Bottom Sheets ([link](https://m3.material.io/components/bottom-sheets))
- iOS HIG: Action Sheets ([link](https://developer.apple.com/design/human-interface-guidelines/action-sheets))
- Mobile UX 2025 Research: Vertex AI web search results
- Existing Patterns: `useDeleteProduct` in `hooks/useProducts.ts`

## Next Steps

1. **Pause for Clarification (if needed):** Confirm understanding with user
2. **Create Migration:** Add RPC functions via Supabase MCP
3. **Implement Delete Backend:** API + hooks
4. **Build ActionSheet Component:** Reusable UI element
5. **Refactor Customer Pages:** Apply new patterns
6. **User Testing:** Validate UX improvements

---

**Decision:** Approved for implementation pending user confirmation of approach.
