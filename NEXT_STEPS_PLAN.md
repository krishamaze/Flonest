# Next Steps Plan - Sprint 2 & Beyond

## Current Status ✅

### Completed
- ✅ **Sprint 1**: Foundation (Supabase, PWA, Auth, Mobile UI)
- ✅ **Performance Optimizations**: Code splitting, lazy loading, bundle optimization
- ✅ **Production Deployment**: Deployed to Vercel with optimized build
- ✅ **UI Redesign**: Linear/Stripe-inspired mobile-first design
- ✅ **Core Pages**: Dashboard, Products, Inventory (read-only views)

---

## Sprint 2: Inventory Management (Next Priority) 🎯

### Goal
Implement full CRUD operations for products and inventory transactions.

### Tasks Breakdown

#### 1. Product Management (High Priority)
**Estimated: 2-3 days**

- [ ] **Add Product Form**
  - Create `src/components/forms/ProductForm.tsx`
  - Fields: Name, SKU, Description, Category, Cost Price, Selling Price, Min Stock Level
  - Validation: Required fields, SKU uniqueness per tenant
  - Integration: Connect "Add Product" buttons in Dashboard and Products page
  
- [ ] **Product Creation API**
  - Supabase insert with tenant_id
  - Create corresponding inventory record
  - Handle duplicate SKU errors
  - Success/error notifications

- [ ] **Edit Product**
  - Edit product modal/form
  - Update product details
  - Preserve inventory quantity
  - Update inventory record if prices change

- [ ] **Delete Product** (Soft delete)
  - Mark product as inactive
  - Prevent deletion if inventory > 0
  - Show warning before deletion

- [ ] **Product Details View**
  - Full product information page
  - Stock history
  - Transaction log
  - Edit/Delete actions

#### 2. Inventory Transactions (High Priority)
**Estimated: 2-3 days**

- [ ] **Stock In Transaction**
  - Create `src/components/forms/StockInForm.tsx`
  - Connect "Stock In" button in Dashboard
  - Select product, enter quantity, add notes
  - Update inventory quantity
  - Create transaction record in `inventory_transactions` table

- [ ] **Stock Out Transaction**
  - Deduct from inventory
  - Validate sufficient stock
  - Create transaction record
  - Link to invoice (if applicable)

- [ ] **Stock Adjustment**
  - Manual quantity corrections
  - Add reason/notes
  - Audit trail

- [ ] **Transaction History**
  - View all transactions for a product
  - Filter by type (in/out/adjustment)
  - Date range filtering
  - Pagination

#### 3. Enhanced Products Page (Medium Priority)
**Estimated: 1 day**

- [ ] **Product Actions**
  - Make "Add Product" button functional
  - Add "Edit" button to product cards
  - Add "View Details" action
  - Add "Stock In/Out" quick actions

- [ ] **Product Filtering**
  - Filter by category
  - Filter by stock status (in stock/low stock/out of stock)
  - Sort by name, price, quantity, date

- [ ] **Bulk Operations** (Future)
  - Bulk stock in/out
  - Bulk status update
  - Export products

#### 4. Database Schema Updates (If Needed)
**Estimated: 0.5 day**

- [ ] Review current schema
- [ ] Add missing fields if needed
- [ ] Update RLS policies for new operations
- [ ] Test permissions

---

## Sprint 3: GST Invoicing (Future) 📋

### Goal
Implement invoice generation with GST compliance.

### Tasks
- [ ] Invoice creation form
- [ ] Line items with products
- [ ] GST calculation (CGST, SGST, IGST)
- [ ] Invoice numbering
- [ ] PDF generation
- [ ] Invoice list view
- [ ] Invoice details/edit
- [ ] Print/Share functionality

---

## Sprint 4: Team Management (Future) 👥

### Goal
Role-based access control and team member management.

### Tasks
- [ ] Team member invitation UI
- [ ] Role management (owner/staff/viewer)
- [ ] Permission checks throughout app
- [ ] Team member list page
- [ ] Remove team member
- [ ] Activity logs

---

## Immediate Next Steps (This Week) 🚀

### Priority 1: Make Buttons Functional
1. **Add Product Form** (2-3 hours)
   - Create ProductForm component
   - Add modal/drawer for form
   - Connect to Dashboard "Add Product" button
   - Connect to Products page "Add Product" button

2. **Stock In Form** (2-3 hours)
   - Create StockInForm component
   - Connect to Dashboard "Stock In" button
   - Implement transaction creation

3. **Basic Validation** (1 hour)
   - Form validation
   - Error handling
   - Success notifications

### Priority 2: Database Verification
- [ ] Verify `master_products` table structure
- [ ] Verify `inventory` table structure
- [ ] Verify `inventory_transactions` table exists
- [ ] Check RLS policies allow INSERT/UPDATE
- [ ] Test permissions with test user

### Priority 3: UI Components Needed
- [ ] Modal/Drawer component for forms
- [ ] Form components (Input, Select, Textarea)
- [ ] Toast/Notification system
- [ ] Confirmation dialogs

---

## Technical Debt & Improvements 🔧

### Code Quality
- [ ] Add error boundaries
- [ ] Improve error handling
- [ ] Add loading states for all async operations
- [ ] Add form validation library (Zod/React Hook Form)
- [ ] Add unit tests for critical functions

### Performance
- [ ] Implement pagination for large lists
- [ ] Add virtual scrolling for product lists
- [ ] Optimize image handling (if added)
- [ ] Add request caching (React Query?)

### UX Improvements
- [ ] Add empty states for all pages
- [ ] Improve error messages
- [ ] Add helpful tooltips
- [ ] Add keyboard shortcuts
- [ ] Improve mobile interactions

---

## File Structure to Create

```
src/
├── components/
│   ├── forms/
│   │   ├── ProductForm.tsx          # [NEW] Add/Edit product
│   │   ├── StockInForm.tsx          # [NEW] Stock in transaction
│   │   ├── StockOutForm.tsx         # [NEW] Stock out transaction
│   │   └── StockAdjustmentForm.tsx  # [NEW] Stock adjustment
│   ├── ui/
│   │   ├── Modal.tsx                # [NEW] Modal component
│   │   ├── Drawer.tsx               # [NEW] Mobile drawer
│   │   ├── Toast.tsx                 # [NEW] Toast notifications
│   │   ├── ConfirmDialog.tsx         # [NEW] Confirmation dialogs
│   │   ├── Select.tsx                # [NEW] Select dropdown
│   │   └── Textarea.tsx              # [NEW] Textarea input
│   └── layout/
│       └── (existing files)
├── hooks/
│   ├── useProducts.ts               # [NEW] Product data hook
│   ├── useInventory.ts              # [NEW] Inventory operations hook
│   └── useTransactions.ts           # [NEW] Transaction hook
├── lib/
│   ├── api/
│   │   ├── products.ts              # [NEW] Product API calls
│   │   └── inventory.ts             # [NEW] Inventory API calls
│   └── (existing files)
└── pages/
    ├── ProductDetailPage.tsx         # [NEW] Product detail view
    └── (existing files)
```

---

## Database Operations Needed

### Product Operations
```sql
-- Create product
INSERT INTO master_products (tenant_id, name, sku, ...)
INSERT INTO inventory (tenant_id, product_id, quantity, ...)

-- Update product
UPDATE master_products SET ...
UPDATE inventory SET ...

-- Delete product (soft)
UPDATE master_products SET status = 'inactive'
```

### Inventory Transactions
```sql
-- Stock In
INSERT INTO inventory_transactions (tenant_id, product_id, type, quantity, ...)
UPDATE inventory SET quantity = quantity + ?

-- Stock Out
INSERT INTO inventory_transactions (tenant_id, product_id, type, quantity, ...)
UPDATE inventory SET quantity = quantity - ?

-- Adjustment
INSERT INTO inventory_transactions (tenant_id, product_id, type, quantity, ...)
UPDATE inventory SET quantity = ?
```

---

## Success Metrics

### Sprint 2 Completion Criteria
- [ ] Users can add new products
- [ ] Users can edit existing products
- [ ] Users can perform stock in transactions
- [ ] Users can perform stock out transactions
- [ ] All transactions are recorded in database
- [ ] Inventory quantities update correctly
- [ ] Forms have proper validation
- [ ] Error handling works properly
- [ ] Mobile UX is smooth

### Performance Targets
- Form submission < 1s
- Product list load < 500ms
- Transaction history < 1s
- No console errors

---

## Estimated Timeline

### Sprint 2: Inventory Management
- **Week 1**: Product CRUD (Add, Edit, Delete)
- **Week 2**: Inventory Transactions (Stock In/Out/Adjustment)
- **Week 3**: Polish, Testing, Bug Fixes

**Total: 2-3 weeks for Sprint 2**

---

## Dependencies

### Required
- ✅ Supabase database configured
- ✅ RLS policies in place
- ✅ Authentication working
- ✅ Basic UI components

### To Install
```bash
npm install react-hook-form zod @hookform/resolvers
# Optional but recommended for forms
```

---

## Notes

- All forms should be mobile-first
- Use existing design system (spacing, colors, typography)
- Follow Linear-inspired minimal design
- Ensure proper error handling
- Add loading states
- Test on mobile devices
- Consider offline support for forms (future)

---

**Last Updated:** 2025-01-11  
**Status:** Ready for Sprint 2  
**Next Review:** After Sprint 2 completion

