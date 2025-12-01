# Smart Form Early Detection - Test Cases

## Overview
Fixed early detection issues to ensure the form adapts correctly even with partial inputs (3+ characters).

## Changes Made

### 1. ✅ Early Mobile Detection
**Before:** Only recognized complete 10-digit mobile numbers
**After:** Detects partial mobile (3-9 digits starting with 6-9)

**Examples:**
- `987` → Detected as mobile
- `9876` → Detected as mobile  
- `98765432` → Detected as mobile
- `9876543210` → Detected as mobile (complete)

### 2. ✅ InputMode Intelligence
**Before:** Simple first-char check
**After:** Smart detection based on pattern

**Behavior:**
- `987...` → `inputMode="tel"` (numeric keyboard)
- `22AAA...` → `inputMode="text"` (alphanumeric keyboard)
- `John` → `inputMode="text"` (text keyboard)

### 3. ✅ Partial Mobile Mandatory Logic
**Before:** All mobile detections made mobile mandatory
**After:** Only complete 10-digit mobile enforces mandatory

**Rationale:** User typing "987" shouldn't be forced to complete mobile

---

## Test Scenarios

### ✅ Scenario 1: Partial Mobile (3 digits)
**Input:** `987`
**Expected:**
- ✓ Detected as mobile
- ✓ Mobile field appears first
- ✓ Mobile prefilled with "987"
- ✓ Mobile is **optional** (can leave as-is or complete)
- ✓ Name still mandatory
- ✓ `inputMode="tel"` on search box

**Why optional?** User may have typed partial number and changed their mind

### ✅ Scenario 2: Partial Mobile (7 digits)
**Input:** `9876543`
**Expected:**
- ✓ Detected as mobile
- ✓ Mobile field first with "9876543"
- ✓ Mobile **optional**
- ✓ Validation on blur: "Mobile must be 10 digits" if not completed

### ✅ Scenario 3: Complete Mobile (10 digits)
**Input:** `9876543210`
**Expected:**
- ✓ Detected as mobile
- ✓ Mobile field first with "9876543210"
- ✓ Mobile **mandatory** ⭐
- ✓ Submit without mobile → Error

### ✅ Scenario 4: Partial GSTIN (3 chars)
**Input:** `22A`
**Expected:**
- ✓ Detected as partial_gstin
- ✓ GSTIN field first with "22A"
- ✓ GSTIN **mandatory** (all GSTIN detections enforce mandatory)
- ✓ `inputMode="text"` on search box
- ✓ Auto-uppercase as you type

### ✅ Scenario 5: Partial GSTIN (7 chars)
**Input:** `22AAAAA`
**Expected:**
- ✓ Detected as partial_gstin
- ✓ GSTIN field first, **mandatory**
- ✓ Form behavior same as Scenario 4

### ✅ Scenario 6: Text/Name (3 chars)
**Input:** `Joh`
**Expected:**
- ✓ Detected as text
- ✓ Name field first with "Joh"
- ✓ Name **mandatory**
- ✓ Mobile and GSTIN both **optional**
- ✓ `inputMode="text"` on search box

### ✅ Scenario 7: Invalid Number Pattern
**Input:** `567` (starts with 5, not 6-9)
**Expected:**
- ✓ Detected as text (not mobile)
- ✓ Name field first
- ✓ All follow name-search behavior

### ✅ Scenario 8: Number Starting with 1-5
**Input:** `12345`
**Expected:**
- ✓ Detected as text
- ✓ Name field prefilled with "12345"
- ✓ User can correct or proceed

---

## Edge Cases

### 🔍 Case 1: Exactly 3 Characters
| Input   | Type Detected    | First Field | Mandatory       |
|---------|-----------------|-------------|-----------------|
| `987`   | mobile          | Mobile      | Optional        |
| `22A`   | partial_gstin   | GSTIN       | Mandatory       |
| `ABC`   | text            | Name        | Name only       |

### 🔍 Case 2: InputMode Switching
**Test:** Type `9` → `98` → `987` → `987A`
- At `9`: `inputMode="tel"`
- At `98`: `inputMode="tel"`
- At `987`: `inputMode="tel"`
- At `987A`: `inputMode="text"` (mixed alphanumeric)

### 🔍 Case 3: GSTIN Detection Thresholds
| Input           | Length | Detected As     | Reason                    |
|-----------------|--------|-----------------|---------------------------|
| `22`            | 2      | text            | < 3 chars                 |
| `22A`           | 3      | partial_gstin   | State code + 1 letter     |
| `22AAAAA`       | 7      | partial_gstin   | Valid progressive pattern |
| `22AAAAA0000A1Z5` | 15   | gstin           | Complete GSTIN            |

### 🔍 Case 4: Mobile vs GSTIN Ambiguity
**Input:** `229876543210` (starts with state code 22, but 12 digits)
**Expected:** Detected as text (doesn't match mobile or GSTIN pattern)

---

## Regression Checks

### Previous Functionality Still Works
- [ ] Search dropdown appears at 3+ chars
- [ ] Customer selection from results works
- [ ] Complete GSTIN (15 chars) detection
- [ ] Complete mobile (10 digits) detection
- [ ] Form validation on submit
- [ ] Draft saving with partial data

### No Breaking Changes
- [ ] Existing GSTIN entries still work
- [ ] Existing mobile entries still work
- [ ] Name searches still work
- [ ] Cancel closes form without errors
- [ ] Error messages display correctly

---

## Mobile UX Improvements

### Keyboard Type Correctness
- [ ] Numeric input (`987...`) shows numeric keyboard
- [ ] GSTIN input (`22A...`) shows alphanumeric keyboard
- [ ] Name input (`John...`) shows text keyboard
- [ ] Keyboard switches appropriately when pattern changes

### Auto-formatting
- [ ] GSTIN auto-uppercases on form field
- [ ] Mobile accepts numeric paste
- [ ] No input restriction on search box (type="text")

---

## Validation Behavior

### onBlur Validation (Format Check)
| Field  | Partial Input | Error Shown?                          |
|--------|---------------|---------------------------------------|
| Mobile | `987`         | Yes: "Mobile must be 10 digits..."    |
| Mobile | `9876543210`  | No error                              |
| GSTIN  | `22AAA`       | Yes: "Invalid GSTIN format (15...)"   |
| GSTIN  | `22AAAAA0000A1Z5` | No error                          |

### onSubmit Validation (Mandatory Check)
**Scenario:** Search `987` → Click Add New Party
- Mobile field prefilled with "987"
- Mobile is optional (not enforced)
- User can:
  - Complete to 10 digits → Valid
  - Leave as "987" → Blur error shown, but can still submit if cleared
  - Clear field entirely → Optional, no error

**Scenario:** Search `9876543210` → Click Add New Party
- Mobile field prefilled with "9876543210"
- Mobile is **mandatory**
- User must keep valid 10-digit mobile or fill another one

---

## Known Limitations

1. **GSTIN Always Mandatory:** Even partial GSTIN (3+ chars) makes field mandatory
   - **Reason:** 3 chars indicates strong intent, GSTIN is critical for tax
2. **No Checksum Validation:** Format only, no Mod-36 calculation
3. **State Code Not Validated:** `99AAA...` accepted (99 is invalid state)

---

## Success Criteria

✅ All 8 main scenarios pass
✅ Early detection works at 3 characters
✅ InputMode adapts correctly
✅ Partial mobile doesn't force mandatory
✅ Complete mobile enforces mandatory
✅ All GSTIN detections enforce mandatory
✅ Text searches put name first
✅ Build passes without errors
✅ No console errors during testing
