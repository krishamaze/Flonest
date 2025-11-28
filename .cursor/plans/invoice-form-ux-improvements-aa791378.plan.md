<!-- aa791378-ef75-4cb9-8329-77d51208b9de aeaa1152-7d64-4cd9-8893-1787d9b466f7 -->
# Invoice Form UX Improvements

**Branch:** invoice-form-ux

## Fix 1: Smart Input Handling for Mobile/GSTIN

### Changes to `src/components/customers/IdentifierInput.tsx`

- Remove `inputMode="numeric"` attribute (line 99) to allow alphanumeric keyboard
- Add helper text: "Enter Mobile No (10 digits) or GSTIN (15 chars)" below input
- Add `autoFocus` prop support
- Update placeholder to match helper text

### Implementation Details

- Keep `type="text"` (already correct)
- Validation logic already handles both mobile and GSTIN correctly
- Helper text shows when input is empty or invalid
- Success message (mobile/GSTIN detected) remains when valid

## Fix 2: Add "Add New Customer" Card

### Changes to `src/components/forms/InvoiceForm.tsx`

#### Step 1 UI Updates

- Add "Add New Customer" card at top of customer selection area (before identifier input)
- Card styling: green border/background to distinguish from existing customer cards
- Card shows "+ Add New Customer" with icon
- Clicking card opens inline form (replaces `showMasterForm` logic)

#### New Customer Form Fields

- **Legal Name** (required, always shown)
- **Email** (optional)
- **Address** (optional, textarea)
- **Dynamic Identifier Field**:
  - If user entered mobile → show **GSTIN** field (optional)
  - If user entered GSTIN → show **Mobile Number** field (optional)
  - Prefill with what was typed in identifier input if valid

#### Form Behavior

- When "Add New Customer" card is clicked:
  - Hide identifier input and lookup button
  - Show inline form with all fields
  - Prefill dynamic field with identifier value if valid
  - Show cancel button to go back
- On form submit:
  - Call `lookupOrCreateCustomer` with both identifiers (if provided)
  - Auto-select created customer
  - Auto-advance to Step 2

#### State Management

- Add `showAddNewForm` state (replaces/extends `showMasterForm`)
- Track entered identifier type to determine which dynamic field to show
- Store both mobile and GSTIN when creating customer

### Changes to `src/lib/api/customers.ts`

- Update `lookupOrCreateCustomer` function signature to accept both mobile and GSTIN in `masterData`:
  ```typescript
  masterData?: {
    legal_name?: string
    address?: string
    email?: string
    mobile?: string  // Add this
    gstin?: string   // Add this
  }
  ```

- Modify RPC call to pass both identifiers:
  - If identifier type is 'mobile', pass it as `p_mobile` and `masterData.gstin` as `p_gstin`
  - If identifier type is 'gstin', pass it as `p_gstin` and `masterData.mobile` as `p_mobile`

### UI Styling

- Use design tokens for colors (green for "new" card, grey for existing)
- Follow existing card pattern from `CustomerResultCard`
- Ensure touch-friendly button sizes (min 44px height)

## Files to Modify

1. `src/components/customers/IdentifierInput.tsx` - Remove inputMode, add helper text
2. `src/components/forms/InvoiceForm.tsx` - Create horizontal swipeable customer selection area with "Add New Customer" card, form with "Customer Name" field
3. `src/lib/api/customers.ts` - Update to accept both mobile and GSTIN

## Testing Considerations

- Verify numeric keyboard doesn't appear when typing GSTIN
- Verify both mobile and GSTIN can be entered in new customer form
- Verify customer creation with both identifiers works
- Verify duplicate prevention (mobile/GSTIN unique constraints)
- Verify form validation and error handling

### To-dos

- [x] Remove inputMode='numeric' from IdentifierInput and add helper text
- [x] Add 'Add New Customer' card UI in InvoiceForm Step 1
- [x] Implement dynamic identifier field (mobile/GSTIN) based on entered identifier
- [x] Update lookupOrCreateCustomer to accept both mobile and GSTIN in masterData
- [x] Wire new customer form submission to create customer with both identifiers and auto-advance