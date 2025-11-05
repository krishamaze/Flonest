# Apply Database Schema via CLI

## 🔴 Current Issue: DNS Resolution Failure

All CLI tools (psql, Supabase CLI, Node.js pg) are failing with:
```
Error: getaddrinfo ENOTFOUND db.yzrwkznkfisfpnwzbwfw.supabase.co
```

**Root Cause:** Your system cannot resolve the Supabase database hostname.

---

## ✅ Solution 1: Fix DNS Resolution (Recommended)

### Option A: Use Google DNS

1. Open **Network Settings** → **Change adapter options**
2. Right-click your network adapter → **Properties**
3. Select **Internet Protocol Version 4 (TCP/IPv4)** → **Properties**
4. Select **Use the following DNS server addresses:**
   - Preferred DNS: `8.8.8.8` (Google)
   - Alternate DNS: `8.8.4.4` (Google)
5. Click **OK** and restart your network adapter

### Option B: Flush DNS Cache

```powershell
ipconfig /flushdns
Clear-DnsClientCache
```

### Option C: Add to Hosts File

1. Open `C:\Windows\System32\drivers\etc\hosts` as Administrator
2. Add this line (get IP from `Resolve-DnsName`):
   ```
   2406:da18:243:7417:450f:13ac:4e9c:be5a db.yzrwkznkfisfpnwzbwfw.supabase.co
   ```
3. Save and try again

---

## ✅ Solution 2: Use Supabase Connection Pooler

The connection pooler uses a different hostname that might resolve better.

### Get Pooler Connection String

1. Go to: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/settings/database
2. Scroll to **Connection Pooling**
3. Copy the **Connection string** (Transaction mode)
4. It should look like:
   ```
   postgresql://postgres.yzrwkznkfisfpnwzbwfw:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

### Update .env

```env
# Add this new line (keep the old DATABASE_URL as backup)
DATABASE_POOLER_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Try with Pooler

```powershell
# Update apply-schema.cjs to use DATABASE_POOLER_URL
$env:DATABASE_URL = "postgresql://postgres.yzrwkznkfisfpnwzbwfw:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
node apply-schema.cjs --drop
```

---

## ✅ Solution 3: Use IPv6 Address Directly

Since DNS resolves to IPv6, try using the IP directly:

```powershell
# Get current IPv6 address
Resolve-DnsName db.yzrwkznkfisfpnwzbwfw.supabase.co

# Use IP in connection string (note the brackets for IPv6)
$env:DATABASE_URL = "postgresql://postgres:dgxyuWyVpaGIcP6H@[2406:da18:243:7417:450f:13ac:4e9c:be5a]:5432/postgres"
node apply-schema.cjs --drop
```

**Warning:** IPv6 addresses can change, so this is temporary.

---

## ✅ Solution 4: Use Supabase Dashboard (Most Reliable)

If all CLI methods fail, the dashboard is the most reliable:

### Step 1: Open SQL Editor

https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/sql/new

### Step 2: Drop Existing Tables (if needed)

Copy and paste from `drop-all-tables.sql`:

```sql
-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS master_products CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS current_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_is_admin() CASCADE;

SELECT 'All tables dropped successfully' AS status;
```

Click **Run** (or Ctrl+Enter)

### Step 3: Create New Schema

Copy and paste all 139 lines from `schema.sql` and click **Run**.

### Step 4: Verify

```sql
-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see: `inventory`, `invoice_items`, `invoices`, `master_products`, `team_members`, `tenants`

---

## ✅ Solution 5: Use VPN or Different Network

Sometimes corporate networks or ISPs block Supabase database connections.

1. Try using a VPN
2. Try using mobile hotspot
3. Try from a different network

---

## 📊 Troubleshooting Commands

### Check DNS Resolution

```powershell
# Should return IPv6 address
Resolve-DnsName db.yzrwkznkfisfpnwzbwfw.supabase.co

# Test connectivity
Test-NetConnection -ComputerName db.yzrwkznkfisfpnwzbwfw.supabase.co -Port 5432
```

### Check if psql can connect

```powershell
# Test connection (will prompt for password)
psql -h db.yzrwkznkfisfpnwzbwfw.supabase.co -U postgres -d postgres -p 5432
# Password: dgxyuWyVpaGIcP6H
```

### Check Node.js DNS

```javascript
// test-dns.js
const dns = require('dns');
dns.lookup('db.yzrwkznkfisfpnwzbwfw.supabase.co', (err, address) => {
  if (err) console.error('DNS Error:', err);
  else console.log('Resolved to:', address);
});
```

```powershell
node test-dns.js
```

---

## 🎯 Recommended Approach

Given the persistent DNS issues, I recommend:

1. **Short-term:** Use Supabase Dashboard SQL Editor (5 minutes)
   - Most reliable, no network issues
   - Direct browser connection
   - Immediate feedback

2. **Long-term:** Fix DNS settings
   - Switch to Google DNS (8.8.8.8)
   - Or use connection pooler URL
   - Then CLI tools will work

---

## 📝 Quick Dashboard Guide

1. Open: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/sql/new
2. Paste `drop-all-tables.sql` → Run
3. Paste `schema.sql` → Run
4. Paste queries from `setup-initial-data.sql` → Run each one
5. Done! Test app at https://biz-finetune-store.vercel.app/login

**Total time: 5 minutes**

vs.

**Debugging DNS issues: Could take hours**

---

## 🔧 Files Created

- ✅ `apply-schema.cjs` - Node.js script to apply schema (blocked by DNS)
- ✅ `apply-schema-via-api.js` - API approach (requires service role key)
- ✅ This guide with all alternatives

---

## Next Steps

**Choose one:**

- [ ] Fix DNS and use CLI (technical, time-consuming)
- [ ] Use Supabase Dashboard (quick, reliable) ← **Recommended**
- [ ] Get connection pooler URL and retry CLI
- [ ] Use VPN and retry CLI

