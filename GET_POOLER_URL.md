# Get Supabase Connection Pooler URL

## Why You Need This

Your Supabase database hostname (`db.yzrwkznkfisfpnwzbwfw.supabase.co`) only has IPv6, but your network/tools don't support IPv6 properly.

The **Connection Pooler** uses a different hostname that supports **both IPv4 and IPv6**.

---

## Step 1: Get Pooler URL from Dashboard

1. **Open Supabase Database Settings:**
   
   https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/settings/database

2. **Scroll down to "Connection Pooling" section**

3. **Copy the "Connection string" under "Transaction mode"**

   It should look like:
   ```
   postgresql://postgres.yzrwkznkfisfpnwzbwfw:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

4. **Replace `[YOUR-PASSWORD]` with your actual password**

   Your password is: `dgxyuWyVpaGIcP6H`

   Final URL:
   ```
   postgresql://postgres.yzrwkznkfisfpnwzbwfw:dgxyuWyVpaGIcP6H@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

---

## Step 2: Add to .env File

Open `.env` and add this line:

```env
# Direct database connection (IPv6 only - doesn't work)
DATABASE_URL=postgresql://postgres:dgxyuWyVpaGIcP6H@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres

# Connection pooler (IPv4 + IPv6 - works everywhere)
DATABASE_POOLER_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:dgxyuWyVpaGIcP6H@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Note:** The exact pooler hostname might be different. Copy it from your dashboard!

---

## Step 3: Test Pooler Connection

Once you have the pooler URL, test it:

```powershell
# Set the pooler URL
$env:DATABASE_URL = "postgresql://postgres.yzrwkznkfisfpnwzbwfw:dgxyuWyVpaGIcP6H@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Test with Node.js
node apply-schema.cjs --drop
```

---

## Step 4: Make it Permanent

Once it works, update your `.env` file to use the pooler URL by default:

```env
# Use pooler as primary connection
DATABASE_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:dgxyuWyVpaGIcP6H@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Keep direct connection as backup
DATABASE_DIRECT_URL=postgresql://postgres:dgxyuWyVpaGIcP6H@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres
```

---

## Alternative: Enable IPv6 on Your System

If you want to use the direct connection instead of pooler:

### Windows IPv6 Configuration

1. **Check if IPv6 is enabled:**
   ```powershell
   Get-NetAdapterBinding -ComponentID ms_tcpip6
   ```

2. **Enable IPv6 if disabled:**
   ```powershell
   Enable-NetAdapterBinding -Name "*" -ComponentID ms_tcpip6
   ```

3. **Test IPv6 connectivity:**
   ```powershell
   Test-NetConnection -ComputerName ipv6.google.com -Port 80
   ```

4. **If IPv6 works, test database:**
   ```powershell
   Test-NetConnection -ComputerName db.yzrwkznkfisfpnwzbwfw.supabase.co -Port 5432
   ```

---

## Summary

**Recommended approach:**

1. ✅ Get pooler URL from dashboard (supports IPv4)
2. ✅ Add to `.env` as `DATABASE_URL`
3. ✅ Run `node apply-schema.cjs --drop`
4. ✅ CLI access works permanently!

**Why pooler is better:**

- ✅ Supports both IPv4 and IPv6
- ✅ Better performance (connection pooling)
- ✅ Works on all networks
- ✅ Recommended by Supabase for production

---

## Next Steps

After you get the pooler URL from the dashboard, paste it here and I'll help you test it!

