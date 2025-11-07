<!-- c755cfc1-5794-4b29-aed9-e5d6618455eb f31a01b5-ecec-4c79-a509-ee677c5db53f -->
# Invoice Cards and Metric Cards Layout Improvements

## 1. Standardize Customer Cards in Invoice Flow

**File: `src/components/customers/CustomerResultCard.tsx`**

- Update to use consistent padding (`p-md`), border radius, and typography
- Keep yellow border (`border-primary-light`) and "Use This Customer" button

**File: `src/components/forms/InvoiceForm.tsx` (lines 396-420)**

- Restructure "Add New Customer" card to match `CustomerResultCard` layout:
- Same padding structure (`p-md` with `space-y-md` internal spacing)
- Same typography (title: `text-base font-semibold`, subtitle: `text-xs text-secondary-text`)
- Same button placement and styling at bottom
- Change border to green (`border-success` or `border-success-light`)
- Change button label to "Add New Customer" (or similar)
- Remove centered layout, use left-aligned content matching customer card structure
- Keep icon but integrate it into the layout (top section, similar size)

## 2. Make Metric Cards More Compact

**File: `src/pages/DashboardPage.tsx` (lines 90-148)**

- Reduce gap from `gap-3` (12px) to `gap-2` (8px)
- Reduce padding from `p-4` (16px) to `p-3` (12px) 
- Reduce icon container size from `h-8 w-8` to `h-6 w-6`
- Reduce icon size from `h-5 w-5` to `h-4 w-4`
- Reduce value font size from `text-xl` to `text-lg`
- Reduce label font size from `text-xs` to `text-[10px]` or keep `text-xs` but reduce line height
- Keep grid: `grid-cols-1` (mobile) → `sm:grid-cols-2` → `lg:grid-cols-4` (horizontal on larger screens)

**File: `src/pages/InventoryPage.tsx` (lines 318-350)**

- Reduce gap from `gap-3` (12px) to `gap-2` (8px)
- Reduce padding from `p-md` (16px) to `p-3` (12px)
- Reduce icon size from `h-5 w-5` to `h-4 w-4`
- Reduce value font size from `text-xl` to `text-lg`
- Reduce label font size from `text-xs` to `text-[10px]` or keep `text-xs` but reduce line height
- Reduce icon margin bottom from `mb-sm` to `mb-xs`
- Keep grid: `grid-cols-1` (mobile) → `sm:grid-cols-3` (horizontal on larger screens)

## Implementation Notes

- Use design tokens for spacing (`--spacing-xs`, `--spacing-sm`, `--spacing-md`)
- Maintain accessibility (minimum touch targets, readable text)
- Ensure cards remain visually balanced despite reduced spacing

### To-dos

- [ ] Update CustomerResultCard and Add New Customer card to share same layout, padding, typography - only differ in border color and button label
- [ ] Reduce spacing and sizing of metric cards on DashboardPage for better info density
- [ ] Reduce spacing and sizing of invoice metric cards on InventoryPage for better info density