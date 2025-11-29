# ADR-0007: Multi-Tenant Architecture with Row Level Security

**Date:** 2025-11-28
**Status:** Accepted

## Context

Flonest is a **SaaS application** serving multiple organizations (tenants), each with their own:

- Products and inventory
- Invoices and customers
- Team members and roles
- Branches and locations
- Financial data and reports

Each organization must be completely isolated from others for:

- **Data Privacy**: Org A cannot see Org B's data
- **Security**: Prevent cross-tenant data leaks
- **Compliance**: Meet data protection regulations
- **Trust**: Essential for SaaS business model

Multi-tenant architectures typically use one of three approaches:

1. **Database per Tenant**: Separate PostgreSQL database for each org
2. **Schema per Tenant**: Separate PostgreSQL schema for each org
3. **Shared Schema with Tenant Column**: Single schema, `org_id` column on every table

Each approach has different trade-offs for:
- **Isolation**: How strictly are tenants separated?
- **Cost**: How much infrastructure overhead?
- **Scalability**: How many tenants can we support?
- **Operational Complexity**: How hard to manage?
- **Query Performance**: How efficient are queries?

## Decision

We will use **Shared Schema with Row Level Security (RLS)** enforced at the PostgreSQL level:

### Architecture

1. **Single Database**: All organizations share one PostgreSQL database
2. **org_id Column**: Every table has an `org_id` foreign key to `orgs` table
3. **RLS Policies**: PostgreSQL RLS policies enforce org-scoped access
4. **Membership-Based Access**: Users join orgs via `memberships` table
5. **Context Switching**: Users can switch between orgs they belong to
6. **Database-Enforced**: Cannot bypass RLS from application code

### Schema Pattern

```sql
-- Organizations table
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gstin TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Memberships table (user ↔ org relationship)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'org_owner', 'branch_head', 'advisor'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- Example org-scoped table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policy for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their org's products"
  ON products
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM memberships
      WHERE user_id = auth.uid()
    )
  );
```

### Current Org Context

The application tracks "current org" via:

1. **localStorage**: `currentOrgId` - Client-side cache
2. **Server-side function**: `set_current_org_context(org_id)` - Server-side RPC
3. **AuthContext**: `currentOrg` state - React context

### Workflow

```typescript
// 1. User logs in
const { user } = await supabase.auth.signInWithPassword({ email, password })

// 2. Load user's memberships
const { data: memberships } = await supabase
  .from('memberships')
  .select('*, orgs(*)')
  .eq('user_id', user.id)

// 3. User selects org (or use last selected)
const selectedOrg = memberships[0].orgs

// 4. Set current org context
await supabase.rpc('set_current_org_context', { org_id: selectedOrg.id })
localStorage.setItem('currentOrgId', selectedOrg.id)

// 5. All queries automatically scoped to current org via RLS
const { data: products } = await supabase
  .from('products')
  .select('*')
  // RLS automatically filters to current org - no need for .eq('org_id', ...)
```

## Alternatives Considered

### Alternative 1: Database per Tenant
- **Pros**: Maximum isolation, easy to backup/restore individual orgs
- **Cons**: High operational overhead, expensive (N databases), hard to query across orgs
- **Why rejected**: Not cost-effective for SaaS with potentially thousands of orgs

### Alternative 2: Schema per Tenant
- **Pros**: Good isolation, connection pooling works, easier than DB per tenant
- **Cons**: PostgreSQL has practical limit (~hundreds of schemas), migration complexity
- **Why rejected**: Doesn't scale to thousands of tenants

### Alternative 3: Shared Schema without RLS
- **Pros**: Simple, standard approach
- **Cons**: **Must trust application code** to filter by `org_id` - one bug leaks data
- **Why rejected**: Too risky - RLS provides defense-in-depth

### Alternative 4: Separate App Instances per Tenant
- **Pros**: Maximum isolation, custom domains
- **Cons**: Extremely expensive, operational nightmare
- **Why rejected**: Not viable for SaaS business model

## Consequences

### Positive

- **Cost-Effective**: Single database serves all tenants
- **Scalable**: Can handle thousands of organizations
- **Database-Enforced Security**: RLS prevents data leaks even with application bugs
- **Simple Operations**: One database to backup, monitor, maintain
- **Fast Queries**: PostgreSQL query planner optimized for RLS
- **Easy Onboarding**: New org = new row in `orgs` table
- **Cross-Tenant Queries**: Platform admins can query across orgs (with proper RLS policies)
- **Standard PostgreSQL**: No custom sharding logic or middleware

### Negative

- **Noisy Neighbor Risk**: One org's heavy queries can affect others (mitigated by connection pooling)
- **Backup Granularity**: Cannot backup individual org easily (must backup entire DB)
- **RLS Overhead**: Small performance penalty for RLS checks (~5-10% on simple queries)
- **Complexity**: RLS policies can be complex for intricate permission models
- **Cannot Physically Separate**: Orgs share same database (some compliance regimes require physical separation)
- **Migration Risk**: Schema changes affect all orgs simultaneously

### Neutral

- **Query Pattern**: All queries must be org-scoped (enforced by RLS)
- **Connection Pooling**: Must use connection pooling (Supabase provides this)
- **Testing**: Must test RLS policies thoroughly

## Implementation Notes

### RLS Policy Patterns

**Pattern 1: User Membership Check**
```sql
CREATE POLICY "org_membership_check"
  ON products FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM memberships
      WHERE user_id = auth.uid()
    )
  );
```

**Pattern 2: Role-Based Access**
```sql
CREATE POLICY "owners_can_delete_products"
  ON products FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM memberships
      WHERE user_id = auth.uid()
      AND role IN ('org_owner', 'branch_head')
    )
  );
```

**Pattern 3: Platform Admin Bypass**
```sql
CREATE POLICY "platform_admins_see_all"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_internal = true
    )
    OR org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
  );
```

### Critical Rules

**ALWAYS:**
- ✅ Enable RLS on all org-scoped tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- ✅ Include `org_id` column on all tenant data tables
- ✅ Create RLS policies for SELECT, INSERT, UPDATE, DELETE
- ✅ Test RLS policies with multiple user roles
- ✅ Use `auth.uid()` in RLS policies (not application variables)

**NEVER:**
- ❌ Disable RLS on org-scoped tables
- ❌ Use service role key in client code (bypasses RLS)
- ❌ Trust application code to filter by `org_id` (RLS must enforce)
- ❌ Grant direct database access to non-admin users

### Testing RLS Policies

```sql
-- Test as specific user
SET request.jwt.claims.sub = 'user-uuid-here';

-- Verify queries are scoped
SELECT * FROM products;
-- Should only return products for user's orgs

-- Test cross-tenant access (should fail)
INSERT INTO products (org_id, name) VALUES ('other-org-id', 'Test');
-- Should be rejected by RLS policy
```

### Performance Considerations

**Indexing**:
```sql
-- CRITICAL: Index org_id on all org-scoped tables
CREATE INDEX idx_products_org_id ON products(org_id);
CREATE INDEX idx_invoices_org_id ON invoices(org_id);
```

**Query Planning**:
```sql
-- Check query plan for RLS overhead
EXPLAIN ANALYZE
SELECT * FROM products WHERE name LIKE '%laptop%';
-- Look for RLS filter in plan
```

### Migration Checklist for New Tables

When creating a new org-scoped table:

- [ ] Add `org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE`
- [ ] Enable RLS: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- [ ] Create SELECT policy (org membership check)
- [ ] Create INSERT policy (org membership check)
- [ ] Create UPDATE policy (org membership + role check if needed)
- [ ] Create DELETE policy (org owner/branch head only)
- [ ] Add index: `CREATE INDEX idx_x_org_id ON x(org_id)`
- [ ] Test policies with different user roles
- [ ] Document in schema comments

### Org Lifecycle

**Creating New Org**:
```sql
-- Insert org
INSERT INTO orgs (name, gstin) VALUES ('New Company', '...');

-- Create owner membership
INSERT INTO memberships (user_id, org_id, role)
VALUES ('user-uuid', 'org-uuid', 'org_owner');
```

**Deleting Org**:
```sql
-- Cascade deletes all org data (due to ON DELETE CASCADE)
DELETE FROM orgs WHERE id = 'org-uuid';
```

## Future Enhancements

**Sharding**:
If we reach millions of orgs, consider:
- Shard by `org_id` hash across multiple databases
- Use Postgres logical replication
- Implement custom routing layer

**Org-Specific Customization**:
- Custom schemas per org (for enterprise customers)
- Dedicated database for largest orgs
- Hybrid approach (shared for small orgs, dedicated for large)

## References

- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/overview)
- Database schema: `supabase/migrations/`

---

**Author**: Development Team
**Last Updated**: 2025-11-28
