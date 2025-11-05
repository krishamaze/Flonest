# CLI Update Instructions

## ✅ Vercel CLI - Updated

**Status**: ✅ Updated successfully  
**Version**: 48.8.2 (latest)

### Update Command
```bash
npm install -g vercel@latest
```

---

## ✅ Supabase CLI - Updated

**Previous Version**: 2.48.3  
**Current Version**: 2.54.11  
**Status**: ✅ Updated successfully

### Update Method Used

Supabase CLI was updated by:
1. Downloading the latest release from GitHub
2. Extracting using Windows native tar.exe
3. Replacing the binary at `C:\supabase-cli\supabase.exe`

### Update Options

#### Option 1: Using Scoop (Recommended if you have Scoop installed)

```powershell
scoop update supabase
```

#### Option 2: Manual Download & Replace

1. **Download the latest release:**
   - Visit: https://github.com/supabase/cli/releases/latest
   - Download: `supabase_windows_amd64.tar.gz`

2. **Extract the file:**
   - Use 7-Zip, WinRAR, or Windows 11's built-in tar support
   - Extract to get `supabase.exe`

3. **Replace the existing file:**
   ```powershell
   # Stop any running Supabase services first
   Copy-Item "path\to\extracted\supabase.exe" -Destination "C:\supabase-cli\supabase.exe" -Force
   ```

4. **Verify the update:**
   ```powershell
   supabase --version
   ```

#### Option 3: Install via Scoop (If not installed)

1. **Install Scoop** (if not already installed):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

2. **Add Supabase bucket:**
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   ```

3. **Install/Update Supabase:**
   ```powershell
   scoop install supabase
   # or if already installed:
   scoop update supabase
   ```

---

## Verification

After updating, verify both CLIs:

```bash
vercel --version
# Should show: Vercel CLI 48.8.2

supabase --version
# Should show: 2.54.11 (or latest)
```

---

## Quick Reference

### Vercel CLI Commands
```bash
# Update
npm install -g vercel@latest

# Check version
vercel --version
```

### Supabase CLI Commands
```bash
# Update (if using Scoop)
scoop update supabase

# Check version
supabase --version

# Generate types
supabase gen types typescript --linked > src/types/database.ts
```

---

## Notes

- **Vercel CLI**: Updated via npm - ✅ Complete (v48.8.2)
- **Supabase CLI**: Updated manually - ✅ Complete (v2.54.11)
- Both CLIs are now updated to latest versions
- Both CLIs are linked to your remote projects
- Supabase types have been generated from remote database

---

**Last Updated**: 2025-01-11  
**Status**: ✅ Both CLIs updated successfully

