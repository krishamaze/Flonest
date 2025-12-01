# ADR 005: Controller Hook Pattern for Complex Components

**Status:** Accepted  
**Date:** 2025-12-01  
**Deciders:** Engineering Team  
**Tags:** architecture, react, refactoring, patterns

---

## Context

Our codebase had several "god components" (500-1000+ lines) that mixed data fetching, business logic, UI state, and presentation concerns. These components were:

- **InvoiceForm.tsx** (1,011 lines)
- **PurchaseBillView.tsx** (431 lines)
- **CreateDCSalePage.tsx** (522 lines)
- **ProductsPage.tsx** (670 lines)

### Problems Identified

1. **Poor Separation of Concerns**: Data, logic, and UI were tightly coupled
2. **Hard to Test**: Business logic embedded in React components
3. **Low Reusability**: Logic couldn't be shared across views
4. **Difficult Maintenance**: Changes required touching 500+ line files
5. **Complex State Management**: Multiple `useState` hooks created interdependencies

## Decision

We will adopt the **Controller Hook Pattern** for complex components. This pattern extracts all non-presentational logic into custom hooks that act as view-models/controllers.

### Three Refactoring Patterns

#### Pattern 1: Controller Hook (Best for CRUD pages)

**Use When:** Managing lists with filters, pagination, and CRUD operations

```typescript
// ✅ Hook manages ALL non-UI logic
export function useProductManagement(user: User) {
  const queryClient = useQueryClient()
  
  // State
  const [searchInput, setSearchInput] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Queries
  const productsQuery = useQuery({ ... })
  const categoriesQuery = useQuery({ ... })
  
  // Mutations with optimistic updates
  const createMutation = useMutation({ ... })
  const updateMutation = useMutation({ ... })
  
  // Handlers
  const handleCreate = async (data) => { ... }
  
  return {
    // Data
    products, categories, isLoading,
    // State
    searchInput, setSearchInput, currentPage,
    // Actions
    handleCreate, handleUpdate, handleDelete
  }
}

// ✅ Component is PURELY presentational
export function ProductsPage() {
  const { products, handleCreate } = useProductManagement(user)
  return <div>{/* Just render */}</div>
}
```

**Examples:** `ProductsPage.tsx`, `CreateDCSalePage.tsx`

#### Pattern 2: Multi-Hook Decomposition (Best for large forms)

**Use When:** Complex forms with distinct domains (customer, items, tax, etc.)

```typescript
// ✅ Break into domain-specific hooks
export function InvoiceForm() {
  const scanner = useInvoiceScanner()
  const items = useInvoiceItems()
  const customer = useInvoiceCustomer()
  const tax = useInvoiceTax()
  
  return (
    <form>
      <CustomerSection {...customer} />
      <ItemsSection {...items} scanner={scanner} />
      <TaxSection {...tax} />
    </form>
  )
}
```

**Examples:** `InvoiceForm.tsx`

#### Pattern 3: Workflow Hook (Best for state machines)

**Use When:** Multi-step workflows with actions (approve, reject, revert)

```typescript
// ✅ Encapsulate workflow state + actions
export function usePurchaseBill(billId: string) {
  const [bill, setBill] = useState<Bill | null>(null)
  const [loading, setLoading] = useState(false)
  
  const approveBill = async () => { ... }
  const postBill = async () => { ... }
  const revertToDraft = async () => { ... }
  
  return { bill, loading, approveBill, postBill, revertToDraft }
}
```

**Examples:** `PurchaseBillView.tsx`

### Refactoring Workflow: Duplicate → Switch → Delete

```bash
# Step 1: DUPLICATE - Create hook with logic
# - Copy state, effects, handlers to new hook file
# - Keep component unchanged

# Step 2: SWITCH - Integrate hook
# - Import hook in component with "hook" prefix
# - Replace local state reads with hookState

# Step 3: DELETE - Remove duplicates
# - Delete local state declarations
# - Rename hookState → state
# - Remove unused imports
```

## Consequences

### Positive

✅ **Testability**: Business logic can be unit tested in isolation  
✅ **Reusability**: Hooks can be consumed by multiple views (modals, pages)  
✅ **Maintainability**: UI changes don't touch business logic  
✅ **Discoverability**: `src/hooks/` directory is single source of truth for logic  
✅ **Type Safety**: Hooks enforce clear interfaces between data and UI

### Measured Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Avg Component Size | 660 lines | 307 lines | -53% |
| Total Code | 3,097 lines | 1,926 lines | -38% |
| TypeScript Errors | 0 | 0 | Maintained |
| Build Success | ✅ | ✅ | Maintained |

### Negative

⚠️ **More Files**: Each refactor creates 1-5 new hook files  
⚠️ **Learning Curve**: New team members must understand the pattern  
⚠️ **Indirection**: Logic is no longer co-located with UI (but this is acceptable given the benefits)

### Mitigations

- Document hooks with JSDoc comments
- Use clear naming: `use[Domain][Action]` (e.g., `useInvoiceCustomer`, `useProductManagement`)
- Keep hooks focused (Single Responsibility Principle)
- Co-locate related hooks in subdirectories (`hooks/invoice/`, `hooks/agent/`)

## Implementation Guidelines

### Hook Naming Convention

```typescript
// Domain + Action
useInvoiceItems()      // Manages invoice line items
useInvoiceCustomer()   // Manages customer selection
useProductManagement() // Manages product CRUD
useCreateDCSale()      // Manages DC sale creation

// Avoid generic names
useForm()   // ❌ Too vague
useData()   // ❌ No semantic meaning
```

### Hook Return Pattern

```typescript
export function useControllerHook() {
  return {
    // 1. Data (read-only)
    data, isLoading, error,
    
    // 2. Derived state (computed)
    filteredData, total, hasMore,
    
    // 3. UI state (user can modify)
    searchInput, setSearchInput,
    isOpen, setIsOpen,
    
    // 4. Actions (user triggers)
    handleCreate,
    handleUpdate,
    handleDelete,
  }
}
```

### Testing Strategy

```typescript
// ✅ Test hooks independently
import { renderHook, act } from '@testing-library/react'
import { useProductManagement } from './useProductManagement'

test('creates product and updates cache', async () => {
  const { result } = renderHook(() => useProductManagement(mockUser))
  
  await act(async () => {
    await result.current.handleCreate(mockProductData)
  })
  
  expect(result.current.products).toContainEqual(...)
})
```

## Examples

### Before: God Component (670 lines)

```typescript
export function ProductsPage() {
  // 50+ lines of state
  const [searchInput, setSearchInput] = useState('')
  const [products, setProducts] = useState([])
  // ... 20 more useState
  
  // 100+ lines of queries
  const productsQuery = useQuery({ ... })
  const categoriesQuery = useQuery({ ... })
  
  // 150+ lines of mutations
  const createMutation = useMutation({ ... })
  
  // 200+ lines of handlers
  const handleCreate = async () => { ... }
  
  // 200+ lines of JSX
  return <div>...</div>
}
```

### After: Controller Hook Pattern (294 lines component + 335 lines hook)

```typescript
// useProductManagement.ts (335 lines - testable!)
export function useProductManagement(user: User) {
  // All state, queries, mutations, handlers
  return { products, handleCreate, ... }
}

// ProductsPage.tsx (294 lines - purely presentational!)
export function ProductsPage() {
  const { products, handleCreate } = useProductManagement(user)
  return <div>{/* Just render */}</div>
}
```

**Net Result:** -41 lines total, but 56% reduction in component complexity

## Alternatives Considered

### Alternative 1: Redux/Zustand State Management

**Rejected Because:**
- Adds boilerplate (actions, reducers, selectors)
- Overkill for component-local state
- React Query already handles server state

### Alternative 2: Keep Logic in Components

**Rejected Because:**
- Violates Single Responsibility Principle
- Makes testing difficult (requires rendering)
- Low reusability across views

### Alternative 3: Extract Service Classes

**Rejected Because:**
- Non-idiomatic in React ecosystem
- Doesn't integrate with React lifecycle
- Requires manual dependency injection

## Related Decisions

- **ADR 003**: React Query for Server State (complements this pattern)
- **ADR 004**: API Layer Organization (hooks consume from `lib/api/`)

## References

- [React Hooks Documentation](https://react.dev/reference/react)
- [Kent C. Dodds: Application State Management](https://kentcdodds.com/blog/application-state-management-with-react)
- [Tao of React: Separation of Concerns](https://alexkondov.com/tao-of-react/#separate-business-logic-from-ui)

## Revision History

- **2025-12-01**: Initial decision after refactoring 5 god components
