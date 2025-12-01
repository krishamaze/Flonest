# 9. Controller Hook Pattern for God Component Refactoring

Date: 2025-12-01
Status: Accepted

## Context

The codebase contained several "God Components"—large, monolithic React components (500-1000+ lines) that combined:
- UI Rendering
- Complex Form State
- Business Logic
- API Data Fetching
- Validation Rules
- Workflow Management

Examples included:
- `InvoiceForm.tsx` (~1,011 lines)
- `ProductsPage.tsx` (~670 lines)
- `CreateDCSalePage.tsx` (~522 lines)

These components were difficult to maintain, test, and extend. State management was intertwined with UI logic, making it impossible to unit test business rules without rendering the full component.

## Decision

We have adopted the **Controller Hook Pattern** (and related decomposition patterns) to refactor these components. This pattern separates the "View" (UI) from the "Controller" (Logic/State).

### 1. The Patterns

#### A. Controller Hook (For Pages/Views)
A single custom hook that manages all state, data fetching, and handlers for a specific page.
- **Responsibility**: Expose only the data and actions the UI needs.
- **Naming**: `use[PageName]Controller` or `use[Feature]Management`.
- **Example**: `useProductManagement` for `ProductsPage`.

#### B. Multi-Hook Decomposition (For Complex Forms)
Breaking a large form into domain-specific hooks.
- **Responsibility**: Each hook manages a slice of the form's complexity.
- **Naming**: `use[Feature][Domain]`.
- **Example**: `useInvoiceScanner`, `useInvoiceItems`, `useInvoiceTax` for `InvoiceForm`.

#### C. Workflow Hook (For State Machines)
Encapsulates multi-step processes or status transitions.
- **Responsibility**: Manage transitions (e.g., Draft -> Approved -> Posted).
- **Naming**: `use[Entity]Workflow` or `use[Entity]`.
- **Example**: `usePurchaseBill` for `PurchaseBillView`.

### 2. The Refactoring Workflow: Duplicate → Switch → Delete

To ensure safety during refactoring, we follow this strict process:

1.  **Duplicate**: Create the new hook and replicate the logic/state from the component. Initialize the hook in the component alongside the original code.
2.  **Switch**: Update the component's JSX to use the hook's return values instead of local state/handlers.
3.  **Delete**: Remove the dead local state, handlers, and imports from the component.

## Consequences

### Positive
- **Code Reduction**: Average component size reduced by ~40-50%.
- **Separation of Concerns**: UI is purely presentational; Logic is purely functional.
- **Testability**: Hooks can be unit tested independently of the DOM/UI.
- **Reusability**: Hooks can be reused in different views (e.g., `useInvoiceCustomer` in both Invoice and DC Sale flows).
- **Performance**: Better control over re-renders via hook memoization.

### Negative
- **Indirection**: Logic is no longer co-located in the `.tsx` file (requires jumping to the hook).
- **Boilerplate**: Requires creating separate files and interfaces for hooks.

## Implementation Guidelines

1.  **Return Interfaces**: Hooks should return a structured object with `state` and `actions` (or flat if simple).
2.  **Naming**: Prefix hooks with `use`.
3.  **Dependencies**: Hooks should encapsulate API calls (using React Query where appropriate).
4.  **Optimistic Updates**: Complex UI logic (like optimistic updates) should reside in the hook.

## Verification

Refactors must pass:
1.  `npm run build` (TypeScript checks)
2.  Manual verification of critical flows.
3.  No regression in existing functionality.

## References

- Refactoring of `InvoiceForm.tsx` (Phase 1)
- Refactoring of `ProductsPage.tsx` (Phase 4B)
