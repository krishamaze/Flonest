# Manual Migration Application

If the Supabase CLI is unable to connect, you can apply this migration manually through the Supabase Dashboard.

## Migration: Auto-link Products to Master Products

### Steps:
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw
2. Navigate to SQL Editor
3. Copy and paste the SQL from `supabase/migrations/20251109000002_rpc_auto_link_product_to_master.sql`
4. Execute the SQL

### Migration File:
`supabase/migrations/20251109000002_rpc_auto_link_product_to_master.sql`

### What This Migration Does:
- Creates an RPC function `auto_link_product_to_master()` that automatically:
  - Creates a master product from org product data
  - Links the org product to the master product
  - Generates unique SKUs with org prefix
- Allows products without `master_product_id` to be used in invoices
- Automatically links products when invoices are created

### Verification:
After applying, you can verify the function exists by running:
```sql
SELECT proname FROM pg_proc WHERE proname = 'auto_link_product_to_master';
```

