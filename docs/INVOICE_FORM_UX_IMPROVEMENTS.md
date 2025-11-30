# Invoice Form UX Improvements (Preview Branch)

**Date:** 2025-11-30  
**Status:** To be re-applied after React Query merge  
**Related:** Merge of `claude/migrate-react-query-mutations` into `preview`

## Context

The `preview` branch contains critical UX improvements to `InvoiceForm.tsx` that were developed after the React Query refactor began on the `claude` branch. During merge, we kept the Claude version (React Query architecture) and need to re-apply these UX improvements.

## UX Improvements to Re-apply

### 1. **Customer Search with Autocomplete Combobox**
- **Component:** `CustomerSearchCombobox`
- **Location:** Customer selection (Step 1)
- **Features:**
  - Search triggers after 3+ characters
  - Results prioritized by recency (recent invoices first), then alphabetically
  - "+ Add New Party" shown as first option
  - Keyboard navigation support
  - Auto-populates hidden fields on selection
  - Enables "Next" button on selection
  - Handles "no results found" state

### 2. **Enhanced Customer Creation Flow**
- **Feature:** Inline customer creation with smart detection
- **Improvements:**
  - Auto-detects input type (mobile, GSTIN, partial GSTIN, or text/name)
  - Pre-fills appropriate field based on detection
  - Enhanced validation:
    - Mobile: 10-digit validation (optional)
    - GSTIN: Format validation with mandatory requirement if detected from search
    - Name: Minimum 2 characters (required)
  - Better error messaging
  - Improved UX with `CustomerResultCard` component

### 3. **Product Search and Selection**
- **Component:** `ProductSearchCombobox`
- **Features:**
  - Search-as-you-type for products
  - Quick product selection
  - Integration with scanner mode
  - Better mobile UX

### 4. **Product Confirmation Sheet**
- **Component:** `ProductConfirmSheet`
- **Purpose:** Confirm product and quantity before adding to invoice
- **Features:**
  - Quantity adjustment
  - Serial number entry (if applicable)
  - Continuation of scanner after confirmation
  - Better UX for mobile users

### 5. **Camera Scanner Integration**
- **Component:** `CameraScanner`
- **Modes:** `'closed' | 'scanning' | 'confirming'`
- **Features:**
  - Continuous scanning mode
  - Barcode validation via `validateScannerCodes` API
  - Product lookup from scanned codes
  - Error handling with user-friendly messages:
    - "Product not found. Ask your branch head to add this product."
    - "This product isn't in stock yet. Ask your branch head to add or stock it."
  - Scanner stays open during product confirmation
  - Auto-resume scanning after confirmation

### 6. **Draft Auto-Save System**
- **Hook:** `useAutoSave`
- **Features:**
  - Local debounce: 1.5s for localStorage
  - RPC interval: 5s for database saves
  - Session-based draft management with `draftSessionId`
  - Auto-save on:
    - Customer selection
    - Customer creation
    - Item changes
  - Manual save button with "Draft saved" toast
  - Saves draft metadata: customer_id, items (product_id, quantity, unit_price, line_total, serials)

### 7. **Draft Loading with Retry Logic**
- **Function:** `loadDraftWithRetry`
- **Features:**
  - Automatic retry on transient errors (max 1 retry)
  - Smart error classification:
    - Retry-able: schema cache errors, network errors, RLS policy errors, timeouts
    - Permanent: not found, deleted, invalid, unauthorized
  - Loading states: `loadingDraft`, `isRetrying`
  - Error state: `draftLoadError`
  - Restores:
    - Customer data
    - Invoice items with validation
    - Serial tracking state
    - Stock availability
  - Re-validates draft on load
  - Toast notifications for draft status

### 8. **Draft Session Management**
- **Functions:** `getDraftSessionId`, `setDraftSessionId`, `clearDraftSessionId`
- **Purpose:** Prevent draft conflicts between browser tabs/sessions
- **Features:**
  - Unique session ID per draft
  - Persists in sessionStorage
  - Prevents concurrent editing of same draft
  - Clears session on finalize

### 9. **Enhanced Toast System**
- **Hook:** `useToastDedupe`
- **Features:**
  - Deduplication to prevent toast spam
  - Auto-close timers
  - Unique toasts for critical errors
  - Smart timing (3s delay between duplicate auto-save toasts)

### 10. **Form Change Tracking**
- **Prop:** `onFormChange`
- **Purpose:** Track unsaved changes for navigation warnings
- **Triggers:** When customer is selected OR items are added
- **Use case:** Prevent accidental navigation loss

### 11. **Mobile-First Design Improvements**
- **Feature:** `mode` prop: `'modal' | 'page'`
- **Mobile optimizations:**
  - Full-page mode for mobile devices via `isMobileDevice()` detection
  - Better drawer UX
  - Touch-friendly components
  - Optimized scanner interface

### 12. **Better Error Handling**
- **Improvements:**
  - Field-level validation errors
  - Inline error messages
  - Smart validation (e.g., GSTIN mandatory only if detected from search)
  - User-friendly error messages
  - Error persistence across steps

## Components Added (from preview)

1. **`CustomerSearchCombobox`** - `src/components/customers/CustomerSearchCombobox.tsx`
2. **`CustomerResultCard`** - `src/components/customers/CustomerResultCard.tsx`
3. **`ProductSearchCombobox`** - `src/components/invoice/ProductSearchCombobox.tsx`
4. **`ProductConfirmSheet`** - `src/components/invoice/ProductConfirmSheet.tsx`
5. **`CameraScanner`** - `src/components/invoice/CameraScanner.tsx`

## API Functions Used

- `validateScannerCodes(orgId, codes)` - Validate barcode scanner codes
- `autoSaveInvoiceDraft(orgId, userId, sessionId, data)` - Auto-save draft
- `loadDraftInvoiceData(invoiceId)` - Load draft data
- `revalidateDraftInvoice(invoiceId, orgId)` - Re-validate draft
- `clearDraftSessionId(invoiceId)` - Clear session ID

## Utilities Added

- `detectIdentifierTypeEnhanced(identifier)` - Enhanced detection (mobile/GSTIN/partial/text)
- `validateMobile(mobile)` - 10-digit mobile validation
- `validateGSTIN(gstin)` - GSTIN format validation

## Migration Steps

### Phase 1: Verify Claude Version
1. ✅ Keep Claude's React Query version
2. ✅ Document UX improvements
3. Complete merge

### Phase 2: Re-apply UX Improvements (Next Session)
1. Add missing components (CustomerSearchCombobox, ProductSearchCombobox, etc.)
2. Add draft auto-save hooks
3. Add retry logic
4. Add session management
5. Add scanner integration
6. Add toast deduplication
7. Test each feature incrementally

### Phase 3: Testing
1. Test customer search flow
2. Test draft auto-save
3. Test scanner integration
4. Test draft recovery
5. Test mobile UX

## Notes

- The React Query version provides better state management architecture
- UX improvements are compatibility-layer features that work with any architecture
- Most UX features are self-contained components
- Re-application should be done incrementally, testing after each addition

## References

- Preview commits: `07c9daa`, `d6ab7f6`
- Claude commits: `2a5d595`, `f38bd5c`
- Related files:
  - `tests/invoice-creation-flow.spec.ts` - E2E tests for invoice flow
  - `docs/INVOICE_FLOW_AUDIT_V2.md` - UX audit findings
