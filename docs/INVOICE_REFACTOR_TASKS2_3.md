# Invoice Flow Refactor - Tasks 2 & 3: IN PROGRESS

## Tasks Completed

### ✅ Task 1: Container Pattern (COMPLETE)
- Mobile responsive navigation
- Full-page `/invoices/new` route
- Desktop modal behavior maintained

### ✅ Infrastructure for Tasks 2 & 3 (COMPLETE)

**Created Components:**
1. `CustomerSearchCombobox` (`src/components/customers/CustomerSearchCombobox.tsx`)
   - Autocomplete dropdown with 300ms debounce
   - Keyboard navigation (↑↓ arrows, Enter, Escape)
   - "+ Add New Party" as first dropdown item (always visible)
   - Dynamic `inputMode` (tel/text) based on first character
   - Click-outside to close
   - Loading spinner during search
   - "No matching customers" message
   - Last invoice date display (optional metadata)

**Created API Functions:**
2. `searchCustomersByPartialIdentifier` (`src/lib/api/customers.ts`)
   - Searches mobile (starts-with) and GSTIN (contains)
   - Sorts by `last_invoice_date` DESC (most recent first)
   - Limits to 10 results
   - Returns `CustomerWithMaster[]`

## Next Steps: Integration into InvoiceForm

### Task 2: Visual Hierarchy Reorder

**Current State (INCORRECT):**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-md">
  {/* Add New Customer Card - GREEN BOX */}
  <Card>...</Card>
  
  {/* Identifier Input */}
  <IdentifierInput />
</div>
```

**Target State (CORRECT):**
```tsx
{/* Move search to TOP - no grid layout */}
<CustomerSearchCombobox
  orgId={orgId}
  value={identifier}
  onChange={setIdentifier}
  onCustomerSelect={handleCustomerSelect}
  onAddNewPartyClick={() => setShowAddNewForm(true)}
  autoFocus={isOpen && currentStep === 1}
  disabled={isSubmitting}
/>

{/* "Add New Party" appears INSIDE dropdown, not as separate card */}
```

### Files to Modify

**File:** `src/components/forms/InvoiceForm.tsx` (1851 lines)
**Strategy:** Single-line replacements only

**Changes Required:**

1. **Add import** (line ~13):
   ```tsx
   import { CustomerSearchCombobox } from '../customers/CustomerSearchCombobox'
   ```

2. **Remove entire "Add New Customer" Card** (lines ~1247-1287):
   - Delete the green card with PlusIcon
   - Delete the grid layout wrapper
   
3. **Replace IdentifierInput with CustomerSearchCombobox** (lines ~1289-1309):
   - OLD: `<IdentifierInput ... />`
   - NEW: `<CustomerSearchCombobox ... />`

4. **Update state management**:
   - Keep existing `identifier` state
   - Keep existing `selectedCustomer` state
   - Remove `identifierValid`, `identifierType` states (handled by combobox)
   - Remove `searching`, `lookupPerformed` states

5. **Update handlers**:
   - Remove `handleLookupCustomer` (search happens automatically)
   - Update `handleCustomerSelect` to accept `CustomerWithMaster | null`
   - Keep `handleCreateMasterCustomer` (called from "+ Add New Party")

### Implementation Plan

Since InvoiceForm.tsx is >1800 lines, we canNOT use replace_file_content for multi-line blocks.

**Option A: Manual Edits (RECOMMENDED)**
- User makes changes manually following the guide above
- Agent provides exact code snippets to copy/paste

**Option B: Single-Line Replacements**
- Import statement: Single line addition
- Component swap: Single line replacement
- State cleanup: Multiple single-line deletions

**Option C: Rewrite Step 1 Section Only**
- Extract Step 1 rendering logic into separate component
- Rewrite that smaller component file

## Testing Checklist (After Integration)

- [ ] Type 3 characters → Dropdown appears with results
- [ ] "+ Add New Party" is first item in dropdown
- [ ] Click customer from dropdown → Populates and advances to Step 2
- [ ] Click "+ Add New Party" → Shows inline form
- [ ] Keyboard navigation works (↑↓ arrows, Enter, Escape)
- [ ] Mobile: inputMode switches to `tel` when typing digits
- [ ] Desktop: inputMode switches to `text` when typing letters
- [ ] Loading spinner shows during search
- [ ] "No matching customers" shows when no results

## Notes

- Green "Add New Customer" card is DEPRECATED - will be removed entirely
- All customer selection happens through autocomplete dropdown
- Validation removed from input level (search accepts any 3+ characters)
- Exact mobile/GSTIN validation happens on form submission
