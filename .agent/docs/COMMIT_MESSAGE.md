refactor: eliminate god components using controller hook pattern

Major architectural refactor to decouple UI from business logic across 5 core components.
Implements the Controller Hook Pattern defined in ADR 009.

### 📊 Impact Metrics
- **Total Lines Eliminated:** 1,171 lines (-38% reduction in target files)
- **Components Refactored:** 5 major "God Components"
- **Hooks Created:** 10 domain-specific hooks
- **Build Status:** 100% Passing

### 🔄 Changes by Phase

**Phase 1: InvoiceForm.tsx (-409 lines, -40%)**
- Extracted `useInvoiceScanner` (Camera/Barcode logic)
- Extracted `useInvoiceItems` (Line item management)
- Extracted `useInvoiceCustomer` (Customer selection/creation)
- Extracted `useInvoiceTax` (GST calculations)

**Phase 2: Customer API Layer (-67 lines, -14%)**
- Refactored `customers.ts` to use React Query hooks
- Created `useSearchCustomersAutocomplete` (Debounced search)
- Created `useAddOrgCustomer` (Creation with cache invalidation)
- Eliminated all direct API calls from UI components

**Phase 3: PurchaseBillView.tsx (-124 lines, -29%)**
- Created `usePurchaseBill` workflow hook
- Encapsulated Approve/Post/Revert state machine logic
- Converted view to pure presentational component

**Phase 4: CreateDCSalePage.tsx (-195 lines, -37%)**
- Created `useCreateDCSale` business logic hook
- Isolated complex Section 269ST validation logic
- Centralized multi-step submission flow

**Phase 4B: ProductsPage.tsx (-376 lines, -56%)**
- Created `useProductManagement` controller hook
- Encapsulated search, filter, pagination, and CRUD logic
- Preserved optimistic UI updates within the hook

### 🏗️ New Hooks Inventory
1. `src/hooks/invoice/useInvoiceScanner.ts`
2. `src/hooks/invoice/useInvoiceItems.ts`
3. `src/hooks/invoice/useInvoiceCustomer.ts`
4. `src/hooks/invoice/useInvoiceTax.ts`
5. `src/hooks/useCustomers.ts` (Expanded)
6. `src/hooks/usePurchaseBill.ts`
7. `src/hooks/agent/useCreateDCSale.ts`
8. `src/hooks/useProductManagement.ts`

### 🏛️ Architecture Benefits
- **Separation of Concerns:** UI is now purely presentational.
- **Testability:** Business logic can be unit tested in isolation.
- **Reusability:** Hooks like `useInvoiceCustomer` are reused across flows.
- **Maintainability:** "God Files" decomposed into manageable units.

Ref: ADR-009 (Controller Hook Pattern)
