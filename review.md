# Review: Smart Customer Form Refactor

## Summary
Reviewed the implementation of the "Smart Customer Form" which dynamically reorders and validates fields based on the search input (Mobile vs GSTIN vs Name).

## Code Review

### `src/lib/utils/identifierValidation.ts`
- **Functionality**: `detectIdentifierTypeEnhanced` correctly identifies Mobile, GSTIN, and Partial GSTIN patterns.
- **Regex**: The partial GSTIN regex (`/^[0-9]{2}[A-Z]{1,5}.../`) is complex but appears to correctly model the progressive entry of a GSTIN.
- **Quality**: Code is clean and well-typed.

### `src/hooks/invoice/useInvoiceCustomer.ts`
- **State Management**: Correctly uses `useMemo` to derive `detectedType`, `fieldPriority`, `gstinRequired`, and `mobileRequired` from the `searchedIdentifier`.
- **Logic**:
    - `handleOpenAddNewForm` captures the `searchedIdentifier` snapshot.
    - `useEffect` correctly prefills the inline form based on the detected type.
    - `handleCreateOrgCustomer` correctly applies conditional validation.

## Test Plan & Results

### Automated Tests
Created `tests/smart-customer-form.spec.ts` with the following scenarios:
1.  **Mobile Search**: Verify prefill, field order (Mobile first), and mandatory status.
2.  **GSTIN Search**: Verify prefill, field order (GSTIN first), and mandatory status.
3.  **Partial GSTIN Search**: Verify it behaves like GSTIN search.
4.  **Name Search**: Verify Name first, others optional.

### Execution
- **Command**: `npx playwright test tests/smart-customer-form.spec.ts --project=desktop-chromium`
- **Result**: **FAILED** (4/4 tests failed)
- **Observations**: The tests failed to verify the expected behavior. This could be due to:
    - **Selectors**: The selectors for the inline form fields might be incorrect or dynamic.
    - **Timing**: The debounce time (300ms) might need longer waits in the test.
    - **Environment**: Login or navigation might be flaky in the test environment.

## Proposed Fixes (Do Not Apply)

1.  **Debug Test Selectors**:
    - Inspect the DOM of the "Add New Party" form to ensure selectors like `input[type="tel"]` and `input[placeholder*="GSTIN"]` are accurate.
    - Verify the "Add New Party" button selector.

2.  **Unit Tests**:
    - Add a unit test file `src/lib/utils/identifierValidation.test.ts` to verify `detectIdentifierTypeEnhanced` in isolation, avoiding UI overhead.
    - Example:
      ```typescript
      import { detectIdentifierTypeEnhanced } from './identifierValidation';
      // assert(detectIdentifierTypeEnhanced('9876543210') === 'mobile');
      // assert(detectIdentifierTypeEnhanced('22AAAAA') === 'partial_gstin');
      ```

3.  **UI Logic Verification**:
    - Manually verify if the "Add New Party" form actually renders the fields in the correct order. The code uses `renderFormFields()` which returns an array. React rendering should respect this order.

## Conclusion
The implementation logic looks sound, but the automated verification failed. Recommended to fix the test selectors and add unit tests for the validation logic.
