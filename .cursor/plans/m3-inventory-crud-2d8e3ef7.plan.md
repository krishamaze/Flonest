<!-- 2d8e3ef7-371c-489f-bb80-b724f72052fa c07314b0-49fc-47b9-b48e-b1404faf9e78 -->
# M4: Sales/Invoicing with Centralized Customer Master

**Branch:** dev_db_testing

## Architecture Overview

### Core Design Pattern

- **Master Table**: `master_customers` - Global, read-only for users, writes via RPC only
- **Org Link Table**: `customers` - Org-scoped, references master via `master_customer_id`
- **Unified Input**: Single field accepts mobile (10-digit) or GSTIN (15-char), auto-detects type

## Database Schema

### 1. master_customers Table

```sql
CREATE TABLE master_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text UNIQUE, -- 10-digit, nullable
  gstin text UNIQUE, -- 15-char GSTIN, nullable
  legal_name text NOT NULL,
  address text,
  email text,
  state_code text, -- Derived from GSTIN positions 3-7
  pan text, -- Derived from GSTIN positions 3-7
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_identifier CHECK (mobile IS NOT NULL OR gstin IS NOT NULL)
);

-- Unique indexes
CREATE UNIQUE INDEX idx_master_customers_mobile ON master_customers(mobile) WHERE mobile IS NOT NULL;
CREATE UNIQUE INDEX idx_master_customers_gstin ON master_customers(gstin) WHERE gstin IS NOT NULL;

-- RLS: Read-only for all authenticated users
ALTER TABLE master_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_customers_read" ON master_customers FOR SELECT
  USING (auth.role() = 'authenticated');
```

### 2. customers Table (Org-Scoped Links)

```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  master_customer_id uuid NOT NULL REFERENCES master_customers(id) ON DELETE RESTRICT,
  alias_name text, -- Org-specific nickname
  billing_address text,
  shipping_address text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, master_customer_id)
);

-- Indexes
CREATE INDEX idx_customers_org ON customers(org_id);
CREATE UNIQUE INDEX idx_customers_org_master ON customers(org_id, master_customer_id);

-- RLS: Org-scoped access
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_org_isolation" ON customers FOR ALL
  USING (org_id = current_user_org_id());
```

### 3. RPC Function: upsert_master_customer

```sql
CREATE OR REPLACE FUNCTION upsert_master_customer(
  p_mobile text,
  p_gstin text,
  p_legal_name text,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_state_code text;
  v_pan text;
BEGIN
  -- Derive state_code and PAN from GSTIN if provided
  IF p_gstin IS NOT NULL AND length(p_gstin) >= 7 THEN
    v_state_code := substring(p_gstin, 1, 2);
    v_pan := substring(p_gstin, 3, 5);
  END IF;

  -- Upsert with conflict handling
  INSERT INTO master_customers (mobile, gstin, legal_name, address, email, state_code, pan, last_seen_at)
  VALUES (p_mobile, p_gstin, p_legal_name, p_address, p_email, v_state_code, v_pan, now())
  ON CONFLICT (mobile) WHERE mobile IS NOT NULL
    DO UPDATE SET last_seen_at = now(), updated_at = now()
    RETURNING id INTO v_id;
  
  IF v_id IS NULL THEN
    INSERT INTO master_customers (mobile, gstin, legal_name, address, email, state_code, pan, last_seen_at)
    VALUES (p_mobile, p_gstin, p_legal_name, p_address, p_email, v_state_code, v_pan, now())
    ON CONFLICT (gstin) WHERE gstin IS NOT NULL
      DO UPDATE SET last_seen_at = now(), updated_at = now()
      RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;
```

### 4. Update invoices Table

```sql
ALTER TABLE invoices 
ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
```

## Validation Patterns

### Mobile Validation

- Pattern: `^[6-9][0-9]{9}$`
- Must be exactly 10 digits
- Must start with 6, 7, 8, or 9

### GSTIN Validation

- Pattern: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- Format: 2 digits (state) + 5 chars (PAN) + 4 digits + 1 char + 1 char + Z + 1 char
- Optional: Mod 36 checksum validation on position 15

## Implementation Files

### Database Migrations

1. `supabase/migrations/[timestamp]_create_master_customers.sql`

   - Table creation, indexes, RLS policies

2. `supabase/migrations/[timestamp]_create_org_customers.sql`

   - Table creation, indexes, RLS policies

3. `supabase/migrations/[timestamp]_rpc_upsert_master_customer.sql`

   - RPC function with SECURITY DEFINER

4. `supabase/migrations/[timestamp]_alter_invoices_add_customer_link.sql`

   - Add customer_id column, index, foreign key

### API Layer

1. `src/lib/api/customers.ts`

   - `lookupOrCreateCustomer(identifier: string, orgId: string)` → `{ master, customer }`
   - `getCustomerById(customerId: string)`
   - `updateOrgCustomer(customerId: string, data: CustomerUpdateData)`
   - `getCustomersByOrg(orgId: string)`

2. `src/lib/utils/identifierValidation.ts`

   - `detectIdentifierType(identifier: string)` → 'mobile' | 'gstin' | 'invalid'
   - `validateMobile(mobile: string)` → boolean
   - `validateGSTIN(gstin: string)` → boolean
   - `normalizeIdentifier(identifier: string, type: string)` → string

3. `src/lib/utils/gstCalculation.ts`

   - GST calculation helpers (reuse existing if any)

### UI Components

1. `src/pages/CustomersPage.tsx`

   - List view with search/filter
   - Shows master customer info + org-specific alias/notes

2. `src/components/forms/CustomerForm.tsx`

   - Edit org-specific customer data (alias, addresses, notes)
   - Read-only master customer info display

3. `src/components/forms/InvoiceForm.tsx`

   - **Step 1**: Unified identifier input (mobile/GSTIN)
     - Auto-detection and validation
     - Search result card
     - "Create from identifier" fallback
   - **Step 2**: Add products/items
   - **Step 3**: Review totals, GST calculation
   - **Step 4**: Finalize/save as draft

4. `src/components/customers/IdentifierInput.tsx`

   - Unified input component with validation
   - Pattern detection and error messages

5. `src/components/customers/CustomerResultCard.tsx`

   - Display found customer with master + org data
   - Quick actions (use, edit)

6. `src/pages/InvoiceViewPage.tsx`

   - Detailed invoice view with customer info
   - Print-friendly template

### Type Definitions

1. `src/types/database.ts`

   - Add `master_customers` and `customers` table types

2. `src/types/index.ts`

   - `MasterCustomer` type
   - `Customer` type (with master relation)
   - `CustomerFormData` interface
   - `InvoiceFormData` interface (with customer_id)

## Lookup and Linking Flow

### API Function: lookupOrCreateCustomer

```typescript
async function lookupOrCreateCustomer(
  identifier: string,
  orgId: string,
  userId: string
): Promise<{ master: MasterCustomer; customer: Customer }> {
  // 1. Detect type and normalize
  const type = detectIdentifierType(identifier);
  const normalized = normalizeIdentifier(identifier, type);
  
  // 2. Query master_customers
  let master = await findMasterCustomer(normalized, type);
  
  // 3. If not found, create via RPC
  if (!master) {
    const masterId = await supabase.rpc('upsert_master_customer', {
      p_mobile: type === 'mobile' ? normalized : null,
      p_gstin: type === 'gstin' ? normalized : null,
      p_legal_name: '', // Will be filled in UI fallback
      // ... other fields
    });
    master = await getMasterCustomer(masterId);
  }
  
  // 4. Ensure org link exists
  let customer = await findOrgCustomer(orgId, master.id);
  if (!customer) {
    customer = await createOrgCustomer(orgId, master.id, userId);
  }
  
  return { master, customer };
}
```

## Execution Order

1. **Database Migrations**

   - Create master_customers table + RLS
   - Create customers table + RLS
   - Create RPC function
   - Add customer_id to invoices

2. **Validation Utilities**

   - Identifier type detection
   - Mobile/GSTIN validation
   - Normalization functions

3. **API Layer**

   - lookupOrCreateCustomer implementation
   - Customer CRUD operations
   - Integration with RPC

4. **UI Components**

   - IdentifierInput component
   - CustomerResultCard component
   - InvoiceForm Step 1 (unified input)
   - CustomersPage

5. **Invoice Integration**

   - Update InvoiceForm to use customer selection
   - Wire customer_id to invoice creation
   - Update invoice display

6. **Testing**

   - Identifier validation tests
   - Duplicate protection tests
   - RLS isolation tests
   - Concurrency tests

## Acceptance Criteria

- Unified field accepts and validates mobile/GSTIN patterns
- Existing masters reused; no duplicates by mobile/GSTIN
- Org link created automatically when first used by an org
- Invoices can select linked customer immediately
- RLS ensures cross-tenant isolation; master is read-only
- All operations fast (indexed lookups under 30ms typical)
- Mobile validation: 10 digits starting with 6-9
- GSTIN validation: 15-char format with optional checksum
- Master customer writes only via RPC (SECURITY DEFINER)
- Org-specific customer data (alias, addresses, notes) editable per org

## Future Enhancements (Out of Scope)

- GST profile enrichment via external API
- Product centralization using same master/link pattern
- Advanced GSTIN checksum validation (Mod 36)
- Customer import/export functionality