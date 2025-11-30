# Invoice Creation Flow - Automated Tests

## Test Coverage

This test suite validates the complete invoice creation flow including:

### ✅ Tested Scenarios

1. **Mobile (375px): Full-page route `/invoices/new`**
   - Verifies mobile navigation to dedicated route
   - Confirms full-page layout (not modal)

2. **Desktop (1920px): Modal opens, URL stays `/inventory`**
   - Verifies modal/dialog opens on desktop
   - Confirms URL remains unchanged

3. **Autofocus: Customer Identifier field focused on load**
   - Verifies cursor is in search field without user interaction
   - Tests accessibility and UX best practices

4. **Search trigger: Type 3 chars → 300ms debounce → dropdown appears**
   - Validates minimum 3-character search requirement
   - Confirms 300ms debounce delay
   - Verifies dropdown visibility

5. **Search priority: Most recent customers at top**
   - Checks for "Last invoice" date display
   - Validates recency-based sorting

6. **Add New Party: Click → inline form expands**
   - Verifies "+ Add New Party" button in dropdown
   - Confirms inline form expansion
   - Tests autofocus on name field

7. **Name-only customer: Create with status `name_only`**
   - Creates customer with only name (no mobile/GST)
   - Verifies success toast
   - Validates customer creation

8. **Verified customer: Create with mobile + GST → status `edited`**
   - Creates customer with full details
   - Verifies change request creation
   - Tests validation for mobile (10 digits) and GSTIN format

9. **Next button: Disabled on load, enabled when customer selected**
   - Verifies initial disabled state
   - Confirms enabled state after customer selection

10. **Auto-save: Select customer → toast "Draft auto-saved"**
    - Validates automatic draft creation
    - Confirms toast notification
    - Tests draft persistence

11. **Draft recovery: Exit → Drafts tab → Continue Draft**
    - Creates draft and exits
    - Navigates to Drafts filter
    - Clicks draft to reopen
    - Verifies customer pre-selection

12. **Full mobile E2E flow**
    - Combines all validations in single test
    - End-to-end mobile user journey

## Prerequisites

### 1. Development Server Running
```bash
npm run dev
```
Server should be running on `http://localhost:5173`

### 2. Test Database Setup
- Use test account: `owner@test.com` / `password`
- Ensure Supabase connection is active
- Database should have test organization data

### 3. Install Playwright (if not already installed)
```bash
npm install -D @playwright/test
npx playwright install
```

## Running Tests

### Run All Tests
```bash
npx playwright test tests/invoice-creation-flow.spec.ts
```

### Run Specific Test
```bash
npx playwright test tests/invoice-creation-flow.spec.ts -g "Mobile.*Full-page route"
```

### Run with UI Mode (Interactive)
```bash
npx playwright test tests/invoice-creation-flow.spec.ts --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test tests/invoice-creation-flow.spec.ts --headed
```

### Run Only Mobile Tests
```bash
npx playwright test tests/invoice-creation-flow.spec.ts --project=mobile-chromium
```

### Run Only Desktop Tests
```bash
npx playwright test tests/invoice-creation-flow.spec.ts --project=desktop-chromium
```

### Debug Mode
```bash
npx playwright test tests/invoice-creation-flow.spec.ts --debug
```

## Test Reports

### View HTML Report
```bash
npx playwright show-report
```

### Generate Report After Run
Reports are automatically generated in `playwright-report/`

## Test Configuration

- **Base URL**: `http://localhost:5173`
- **Mobile Viewport**: 375×667 (iPhone SE)
- **Desktop Viewport**: 1920×1080
- **Timeout**: 30s per test (default)
- **Retries**: 0 (local), 2 (CI)

## Troubleshooting

### Test Fails: "Timeout waiting for element"
- Ensure dev server is running
- Check if test account exists in database
- Verify network connectivity to Supabase

### Test Fails: "Element not found"
- UI may have changed - update selectors
- Check if feature is behind feature flag
- Verify test data exists

### Auto-save toast not appearing
- Check browser console for errors
- Verify Supabase RPC functions are working
- Increase wait timeout if network is slow

### Draft recovery fails
- Ensure drafts are being saved (check database)
- Verify draft session ID persistence
- Check if draft is older than 7 days (filtered out)

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run Invoice Flow Tests
  run: npx playwright test tests/invoice-creation-flow.spec.ts
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}

- name: Upload Test Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Test Maintenance

### When to Update Tests
- UI component changes (selectors may break)
- New validation rules added
- Customer creation flow modified
- Draft auto-save logic changes

### Selector Strategy
Tests use multiple fallback selectors for resilience:
```typescript
// Primary: Accessible role
page.locator('[role="listbox"]')

// Fallback: ID
page.locator('[id*="search-results"]')

// Last resort: Class
page.locator('.dropdown')
```

## Expected Results

All 12 tests should pass:
```
✓ Mobile (375px): Full-page route /invoices/new
✓ Desktop (1920px): Modal opens, URL stays /inventory
✓ Autofocus: Customer Identifier field focused on load
✓ Search trigger: 3 chars → 300ms → dropdown appears
✓ Search priority: Most recent customers at top
✓ Add New Party: Click → inline form expands
✓ Name-only customer: Create with status name_only
✓ Verified customer: Create with mobile + GST → status edited
✓ Next button: Disabled on load, enabled when customer selected
✓ Auto-save: Select customer → toast "Draft auto-saved"
✓ Draft recovery: Exit → Drafts tab → Continue Draft
✓ Full flow: Mobile end-to-end with all validations

12 passed (Xm Xs)
```

## Contact

For test failures or questions, check:
- `docs/INVOICE_FLOW_AUDIT_V2.md` - UX audit findings
- `src/components/forms/InvoiceForm.tsx` - Main form component
- `src/components/customers/CustomerSearchCombobox.tsx` - Search component
