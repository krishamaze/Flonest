# Invoice Flow Refactor - Step 1: Container Pattern

## Task 1: Mobile vs Desktop Container Pattern (P0)

### Goal
Different UI containers based on viewport size:
- **Desktop (≥768px)**: Modal over /inventory page
- **Mobile (<768px)**: Full-page route at /invoices/new

### Implementation Steps

#### 1. Create NewInvoicePage Component
**File**: `src/pages/NewInvoicePage.tsx`
- Full-page invoice creation view (mobile-specific)
- Contains header with back button and close icon
- Renders InvoiceForm in "page mode" (not modal/drawer)
- Handles browser back button navigation
- Shows draft save confirmation on close if data entered

#### 2. Update App Routing
**File**: `src/App.tsx`
- Add route: `/invoices/new` → `NewInvoicePage`
- Route should be protected (requires auth)
- Place under MainLayout for consistent navigation

#### 3. Modify InventoryPage
**File**: `src/pages/InventoryPage.tsx`
- Update "+ New Invoice" button click handler
- Check viewport width (window.innerWidth < 768)
- If mobile: `navigate('/invoices/new')`
- If desktop: `setIsInvoiceFormOpen(true)` (current behavior)
- Apply same logic to both "+ New Invoice" buttons (header and empty state)

#### 4. Update InvoiceForm Component
**File**: `src/components/forms/InvoiceForm.tsx`
- Add new props:
  - `mode?: 'modal' | 'page'` (default: 'modal')
  - `onBack?: () => void` (for page mode back navigation)
- When `mode === 'page'`:
  - Don't wrap in Modal/Drawer
  - Render form directly
  - Call `onBack` for navigation
- When `mode === 'modal'`:
  - Current behavior (Modal for desktop, Drawer for mobile)

### Validation Criteria

✅ **Mobile (375px viewport)**:
- Click "+ New Invoice" → Navigate to `/invoices/new` route
- URL shows: `/invoices/new`
- Full-page view (no overlay, full viewport height)
- Header contains:
  - Back arrow (left) → Returns to `/inventory`
  - Title: "New Invoice"
  - Close icon (right) → Exits to `/inventory`
- Browser back button works correctly
- Bottom navigation hides when keyboard opens

✅ **Desktop (1920px viewport)**:
- Click "+ New Invoice" → Open modal
- URL stays: `/inventory`
- Modal overlay visible
- Close button (X) returns to invoices list
- No URL change

✅ **Responsive transition**:
- Test resize from desktop to mobile viewport
- Test resize from mobile to desktop viewport

### Files to Modify
1. ✅ Create: `src/pages/NewInvoicePage.tsx`
2. ✅ Update: `src/App.tsx` (add route)
3. ✅ Update: `src/pages/InventoryPage.tsx` (viewport detection logic)
4. ✅ Update: `src/components/forms/InvoiceForm.tsx` (add page mode)

### Technical Notes
- Use `window.innerWidth` for viewport detection
- Consider using a custom hook for viewport detection to avoid code duplication
- Ensure draft auto-save works in both modes
- Maintain keyboard accessibility
- Test with screen readers for a11y compliance
