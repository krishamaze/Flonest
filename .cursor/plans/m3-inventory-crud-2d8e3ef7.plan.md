# M3: Inventory Management & Stock Logic

**Branch:** feature/m3-inventory-logic
**Epic:** Inventory Management (M3)
**Status:** In Progress

## Objective
Implement core inventory management features including Purchase Bill entry (stock in), Stock Ledger visibility, and manual stock adjustments. This module ensures accurate stock tracking to support the Sales/Invoicing (M4) module.

## Context
The database schema for inventory (`stock_ledger`, `products`, `purchase_bills`) exists. The `post_purchase_bill` and `post_sales_invoice` RPCs handle atomic stock updates. This phase focuses on the frontend implementation and missing "manual adjustment" logic.

## Architecture

### 1. Data Flow
*   **Stock In:** `Purchase Bills` → `post_purchase_bill` RPC → `stock_ledger` (+quantity).
*   **Stock Out:** `Sales Invoices` (M4) → `post_sales_invoice` RPC → `stock_ledger` (-quantity).
*   **Adjustments:** `Manual Adjustment` → `adjust_stock_level` RPC (New) → `stock_ledger` (+/- quantity).

### 2. Core Components

#### A. Purchase Bills (Inward Supply)
*   **Table:** `purchase_bills` (Stores vendor name/GSTIN directly, no separate vendor master yet).
*   **Status Workflow:** `draft` → `approved` (HSN Validation) → `posted` (Stock Update).
*   **Validation:**
    *   Bill Number unique per Org.
    *   HSN Code mismatch detection (using `approve_purchase_bill_with_hsn_validation`).

#### B. Stock Ledger (Truth Source)
*   **Table:** `stock_ledger`.
*   **Calculation:** Current Stock = Sum of `in` - Sum of `out` +/- `adjustment`.
*   **Visibility:** Real-time view of stock movements per product.

## Implementation Tasks

### 1. Database & API (Gap Fill)
*   **Task 1.1:** Create `adjust_stock_level` RPC.
    *   Inputs: `org_id`, `product_id`, `quantity` (positive/negative), `reason`, `transaction_type` ('adjustment').
    *   Action: Insert into `stock_ledger`.
    *   Security: Org-scoped, requires specific permission.
*   **Task 1.2:** Audit RLS policies for `purchase_bills` and `stock_ledger` to ensure `branch_head` and `org_owner` access is correct.

### 2. Frontend: Purchase Bills
*   **Task 2.1:** **Purchase Bill List Page**
    *   Columns: Date, Bill No, Vendor, Amount, Status (`Draft`, `Approved`, `Posted`, `Mismatch`).
    *   Filters: Date Range, Vendor, Status.
*   **Task 2.2:** **Purchase Bill Entry Form**
    *   Header: Vendor Name, Vendor GSTIN, Bill No, Bill Date.
    *   Items: Product Search (Combobox), Quantity, Unit Price, Tax selection.
    *   Actions: "Save Draft", "Approve & Post".

### 3. Frontend: Inventory Dashboard
*   **Task 3.1:** **Stock Ledger View**
    *   History of all transactions for a specific product.
    *   Columns: Date, Type (`Purchase`, `Sale`, `Adjustment`), Qty, Reference (Bill/Invoice No), User.
*   **Task 3.2:** **Manual Adjustment UI**
    *   "Adjust Stock" button on Inventory Page.
    *   Modal: Select Product, Enter New Qty or Difference, Reason.
    *   Calls `adjust_stock_level`.

## Gap Analysis (Pre-Audit Findings)
1.  **Vendor Master:** Non-existent. Vendor details are text strings in `purchase_bills`. *Decision: Keep as text for M3; separate master is Out of Scope.*
2.  **Stock Adjustment:** Missing RPC. *Action: Create `adjust_stock_level`.*
3.  **HSN Mismatch UI:** The backend supports flagging HSN mismatches, but the UI needs to display this status and allow users to correct it before posting.

## Execution Plan
1.  **Backend:** Create `adjust_stock_level` migration.
2.  **UI Scaffold:** Create routes for `/purchase-bills`.
3.  **Feature:** Implement Purchase Bill Entry flow.
4.  **Feature:** Implement Stock Adjustment flow.
