# Quick Start: Invoice Flow Tests

## 🚀 Run Tests in 3 Steps

### Step 1: Start Dev Server
```bash
npm run dev
```
Wait for: `Local: http://localhost:5173/`

### Step 2: Run Tests
```bash
# All tests (headless)
npx playwright test tests/invoice-creation-flow.spec.ts

# With browser visible (recommended first time)
npx playwright test tests/invoice-creation-flow.spec.ts --headed

# Interactive UI mode (best for debugging)
npx playwright test tests/invoice-creation-flow.spec.ts --ui
```

### Step 3: View Results
```bash
# Open HTML report
npx playwright show-report
```

---

## 📋 Test Checklist

Before running tests, verify:

- [ ] Dev server running on `http://localhost:5173`
- [ ] Test account exists: `owner@test.com` / `password`
- [ ] Supabase connection active
- [ ] Playwright installed: `npx playwright install`

---

## 🎯 What Gets Tested

### Mobile (375px)
✅ Full-page route `/invoices/new`  
✅ Autofocus on customer search  
✅ 3-char search trigger  
✅ Add New Party inline form  
✅ Customer creation (name-only)  
✅ Auto-save draft  
✅ Draft recovery  

### Desktop (1920px)
✅ Modal opens (URL stays `/inventory`)  
✅ Search dropdown  
✅ Customer creation (with mobile + GST)  
✅ Next button state management  
✅ All mobile features  

---

## 🐛 Quick Troubleshooting

### "Connection refused"
→ Dev server not running. Run `npm run dev`

### "Timeout waiting for element"
→ Check if test account exists in database

### "Element not found"
→ UI may have changed. Check selectors in test file

### Tests pass but features don't work
→ Check browser console for JavaScript errors

---

## 📊 Expected Output

```
Running 12 tests using 2 workers

  ✓ Mobile (375px): Full-page route /invoices/new (5.2s)
  ✓ Desktop (1920px): Modal opens, URL stays /inventory (3.8s)
  ✓ Autofocus: Customer Identifier field focused on load (2.1s)
  ✓ Search trigger: 3 chars → 300ms → dropdown appears (4.5s)
  ✓ Search priority: Most recent customers at top (3.2s)
  ✓ Add New Party: Click → inline form expands (3.9s)
  ✓ Name-only customer: Create with status name_only (6.1s)
  ✓ Verified customer: Create with mobile + GST (6.8s)
  ✓ Next button: Disabled → Enabled (5.4s)
  ✓ Auto-save: Draft auto-saved toast (7.2s)
  ✓ Draft recovery: Exit → Continue Draft (8.9s)
  ✓ Full mobile E2E flow (12.3s)

  12 passed (1.2m)
```

---

## 🔧 Advanced Options

### Run Single Test
```bash
npx playwright test -g "Mobile.*Full-page"
```

### Run Only Mobile
```bash
npx playwright test --project=mobile-chromium
```

### Debug Specific Test
```bash
npx playwright test -g "Auto-save" --debug
```

### Generate Trace
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

---

## 📝 Adding to package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:invoice": "playwright test tests/invoice-creation-flow.spec.ts",
    "test:invoice:ui": "playwright test tests/invoice-creation-flow.spec.ts --ui",
    "test:invoice:debug": "playwright test tests/invoice-creation-flow.spec.ts --debug"
  }
}
```

Then run:
```bash
npm run test:invoice
npm run test:invoice:ui
```

---

## ✅ Success Criteria

All 12 tests should pass. If any fail:

1. Check error message in terminal
2. View screenshot in `test-results/`
3. Open HTML report: `npx playwright show-report`
4. Run in headed mode to see what's happening
5. Check `INVOICE_FLOW_TESTS.md` for detailed troubleshooting

---

## 🎬 Demo Video

Run with `--headed` to see the tests in action:
```bash
npx playwright test tests/invoice-creation-flow.spec.ts --headed --project=mobile-chromium
```

Watch as the test:
1. Logs in
2. Navigates to invoices
3. Creates customers
4. Saves drafts
5. Recovers drafts

All automatically! 🚀
