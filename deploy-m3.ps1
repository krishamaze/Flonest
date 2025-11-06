# M3 Production Deployment Script (PowerShell)
# This script deploys the products and stock_ledger migration and code to production

$ErrorActionPreference = "Stop"

Write-Host "🚀 M3 Production Deployment" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Database Migration
Write-Host "Step 1: Deploying database migration..." -ForegroundColor Yellow
Write-Host ""

# Check if Supabase CLI is available
if (Get-Command supabase -ErrorAction SilentlyContinue) {
    Write-Host "Using Supabase CLI..." -ForegroundColor Gray
    supabase db push --linked
    Write-Host "✓ Migration deployed" -ForegroundColor Green
} elseif (Test-Path ".\bin\supabase.exe") {
    Write-Host "Using local Supabase CLI..." -ForegroundColor Gray
    .\bin\supabase.exe db push --linked
    Write-Host "✓ Migration deployed" -ForegroundColor Green
} else {
    Write-Host "⚠ Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please deploy migration manually via Supabase Dashboard:"
    Write-Host "1. Go to https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw"
    Write-Host "2. Navigate to SQL Editor"
    Write-Host "3. Copy and execute: supabase/migrations/20251106020000_create_products_stock_ledger.sql"
    Read-Host "Press Enter after migration is deployed"
}

Write-Host ""

# Step 2: Build verification
Write-Host "Step 2: Verifying build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Code Deployment
Write-Host "Step 3: Deploying to Vercel..." -ForegroundColor Yellow

if (Get-Command vercel -ErrorAction SilentlyContinue) {
    Write-Host "Deploying to production..." -ForegroundColor Gray
    vercel --prod
    Write-Host "✓ Deployment complete" -ForegroundColor Green
} else {
    Write-Host "⚠ Vercel CLI not found" -ForegroundColor Red
    Write-Host "Please deploy manually:"
    Write-Host "1. Push to main branch: git push origin main"
    Write-Host "2. Or use Vercel Dashboard to create deployment"
    Write-Host ""
    Write-Host "Production URL: https://biz-finetune-store.vercel.app"
}

Write-Host ""
Write-Host "✅ Deployment process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Verify tables in Supabase Dashboard"
Write-Host "2. Test login at https://biz-finetune-store.vercel.app"
Write-Host "3. Test product CRUD operations"
Write-Host "4. Test stock ledger functionality"
Write-Host ""
Write-Host "See DEPLOYMENT_M3.md for detailed testing checklist"

