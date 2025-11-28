# ADR-0002: Smart Identifier Input

**Date:** 2025-11-28
**Status:** Accepted

## Context

The invoice creation process requires identifying a customer before proceeding. Customers can be identified by two primary unique identifiers: a 10-digit mobile number or a 15-character Goods and Services Tax Identification Number (GSTIN). The initial user interface (UI) design considered separate input fields for each identifier. However, this approach introduces complexity:

1.  **Increased UI Clutter:** Two separate fields would occupy more screen real estate, particularly on mobile devices.
2.  **User Friction:** Users would need to decide which field to use, potentially leading to incorrect entries (e.g., typing a mobile number in the GSTIN field).
3.  **Conditional Logic:** The UI would require logic to handle which field was filled and prioritize one over the other if both were filled.

The goal is to provide a streamlined, intuitive interface for customer lookup that minimizes user effort and ambiguity.

## Decision

We will implement a single "Smart Input" component (`IdentifierInput.tsx`) to handle both Mobile and GSTIN entry. This component will:

1.  **Accept Alphanumeric Input:** The input field will be a standard `type="text"` field, allowing users to type either digits for a mobile number or a mix of letters and numbers for a GSTIN.
2.  **Dynamically Detect Identifier Type:** As the user types, client-side validation logic will analyze the input's format and length to determine whether it is a potential mobile number, a GSTIN, or invalid.
3.  **Provide Real-time Feedback:** Helper text below the input will provide immediate feedback, indicating what type of identifier has been detected (e.g., "Mobile number detected," "GSTIN detected") or displaying a validation error if the format is incorrect.
4.  **Remove `inputMode="numeric"`:** To support GSTIN entry, which is alphanumeric, we will not enforce a numeric-only keyboard.

## Consequences

### Positive

*   **Improved User Experience:** A single input field reduces cognitive load and simplifies the first step of invoice creation.
*   **Reduced UI Complexity:** The layout is cleaner and more space-efficient, especially on mobile screens.
*   **Simplified Form Logic:** The frontend state management is simpler, as it only needs to track one identifier value and its detected type.

### Negative

*   **Loss of Numeric Keyboard Enforcement:** By removing `inputMode="numeric"`, mobile users will see the standard alphanumeric keyboard by default. This is a trade-off for supporting GSTINs. Users entering a mobile number will need to switch to the number layout on their keyboard, which is a common and well-understood interaction pattern.
*   **Reliance on Client-Side Validation:** The component's effectiveness depends on robust and accurate validation logic (`detectIdentifierType`, `validateMobile`, `validateGSTIN`) to provide correct real-time feedback.

