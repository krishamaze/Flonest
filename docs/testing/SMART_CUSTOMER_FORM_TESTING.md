# Smart Customer Form - Testing Guide

## Feature Overview
The invoice customer form now intelligently detects what the user searched for and adapts:
- **Dynamic field ordering** based on search type
- **Context-aware mandatory fields**
- **Format validation on blur**
- **Auto-prefilling** of searched data

## Test Scenarios

### ✅ Scenario 1: Search by Mobile Number
**Steps:**
1. Navigate to invoice creation
2. Enter mobile: `9876543210` (10 digits starting with 6-9)
3. Click "+ Add New Party"

**Expected Behavior:**
- ✓ Mobile field appears **first** with prefilled value
- ✓ Mobile field label shows **"Mobile Number *"** (mandatory)
- ✓ GSTIN field appears second (optional)
- ✓ Name field appears third (mandatory)
- ✓ Cursor auto-focuses on mobile field

**Validation:**
- Blur mobile field with invalid number → Error: "Mobile must be 10 digits starting with 6-9"
- Submit without mobile → Error: "Mobile number is required"
- Submit without name → Error: "Customer name is required (min 2 chars)"

---

### ✅ Scenario 2: Search by GSTIN
**Steps:**
1. Navigate to invoice creation
2. Enter GSTIN: `22AAAAA0000A1Z5` (15 characters)
3. Click "+ Add New Party"

**Expected Behavior:**
- ✓ GSTIN field appears **first** with prefilled value (auto-uppercased)
- ✓ GSTIN field label shows **"GSTIN *"** (mandatory)
- ✓ Mobile field appears second (optional)
- ✓ Name field appears third (mandatory)
- ✓ Cursor auto-focuses on GSTIN field

**Validation:**
- Blur GSTIN with invalid format → Error: "Invalid GSTIN format (15 characters)"
- Submit without GSTIN → Error: "GSTIN is required"
- GSTIN auto-uppercases as you type

---

### ✅ Scenario 3: Search by Partial GSTIN (3+ chars)
**Steps:**
1. Navigate to invoice creation
2. Enter partial GSTIN: `22AAA` (detected as partial GSTIN)
3. Click "+ Add New Party"

**Expected Behavior:**
- ✓ GSTIN field appears **first** with prefilled value
- ✓ GSTIN is **mandatory** (partial GSTIN treated same as full)
- ✓ Form behavior same as Scenario 2

---

### ✅ Scenario 4: Search by Text (Customer Name)
**Steps:**
1. Navigate to invoice creation
2. Enter text: `John Doe` (not mobile/GSTIN format)
3. Click "+ Add New Party"

**Expected Behavior:**
- ✓ Name field appears **first** with prefilled value "John Doe"
- ✓ Mobile field appears second (optional)
- ✓ GSTIN field appears third (optional)
- ✓ Cursor auto-focuses on name field
- ✓ Only name is mandatory

**Validation:**
- Mobile/GSTIN optional but validated if entered
- Submit with invalid mobile → Error shown
- Submit with invalid GSTIN → Error shown

---

## Edge Cases

### 🔍 Case 1: Mobile Number Detection
**Valid:**
- `9876543210` → Detected as mobile
- `6000000000` → Detected as mobile
- `7999999999` → Detected as mobile

**Not Detected:**
- `5876543210` → Treated as text (doesn't start with 6-9)
- `98765432` → Treated as text (less than 10 digits)
- `987654321012` → Treated as text (more than 10 digits)

### 🔍 Case 2: GSTIN Detection
**Valid:**
- `22AAAAA0000A1Z5` → Full GSTIN
- `22AAA` → Partial GSTIN (3+ chars, starts with 2 digits)
- `22AAAAA1234` → Partial GSTIN

**Not Detected:**
- `22` → Too short (less than 3 chars)
- `A2AAAA` → Doesn't start with 2 digits
- `GSTIN123` → Invalid pattern

### 🔍 Case 3: Validation Timing
**onBlur (Format Validation):**
- ✓ Mobile: Shows error immediately on blur if invalid
- ✓ GSTIN: Shows error immediately on blur if invalid
- ✓ Errors clear when field becomes valid

**onSubmit (Final Validation):**
- ✓ Name: Always checked
- ✓ Mobile: Checked if mandatory (searched by mobile)
- ✓ GSTIN: Checked if mandatory (searched by GSTIN)
- ✓ Format validation for optional fields if filled

---

## UI/UX Checks

### Field Labels
- [ ] Mobile mandatory: "Mobile Number *"
- [ ] Mobile optional: "Mobile Number (optional)"
- [ ] GSTIN mandatory: "GSTIN *"
- [ ] GSTIN optional: "GSTIN (optional)"
- [ ] Name always: "Customer Name *"

### Auto-formatting
- [ ] GSTIN input auto-uppercases
- [ ] Mobile accepts only numbers (tel input type)
- [ ] Search value displayed above form

### Focus Management
- [ ] First field in order gets autofocus
- [ ] Tab order follows field order

---

## Browser Compatibility
Test on:
- [ ] Chrome (Desktop)
- [ ] Chrome (Mobile)
- [ ] Safari (Mobile)
- [ ] Firefox

---

## Regression Tests

### Existing Flows
- [ ] Search works normally (3+ chars)
- [ ] Customer selection from dropdown works
- [ ] Cancel button closes form
- [ ] Form persists to draft correctly
- [ ] Created customer appears in invoice

### Edge Cases
- [ ] Rapidly switching between Add New/Cancel doesn't break state
- [ ] Prefilled data updates correctly on form reopen
- [ ] Error messages clear when closing form
- [ ] Form validation doesn't trigger on onChange

---

## Performance
- [ ] No visible lag when opening Add New form
- [ ] Field reordering is instant
- [ ] No flickering during render

---

## Known Limitations
1. Partial GSTIN (3+ chars starting with state code) treated as mandatory
2. Auto-uppercase only on GSTIN field, not on search input
3. No real-time GSTIN checksum validation (format only)

---

## Success Criteria
✅ All 4 main scenarios pass
✅ Field ordering is correct
✅ Mandatory/optional labels are accurate
✅ Validation timing matches spec
✅ No build errors
✅ No console errors
