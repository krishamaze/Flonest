# M3 Enhanced Features Deployment Script
# Deploys EAN/unit fields migration and code updates

$ErrorActionPreference = "Stop"

Write-Host "🚀 M3 Enhanced Features Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Database Migration
Write-Host "Step 1: Deploying database migration (EAN & Unit fields)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  This will prompt for confirmation" -ForegroundColor Yellow
Write-Host "Migration: 20251106030000_add_ean_unit_to_products.sql" -ForegroundColor Gray
Write-Host ""

if (Test-Path ".\bin\supabase.exe") {
    Write-Host "Running: .\bin\supabase.exe db push" -ForegroundColor Gray
    .\bin\supabase.exe db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migration deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Migration failed or was canceled" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠ Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please deploy migration manually via Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "1. Go to https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/sql/new" -ForegroundColor Gray
    Write-Host "2. Copy contents of: supabase/migrations/20251106030000_add_ean_unit_to_products.sql" -ForegroundColor Gray
    Write-Host "3. Paste and execute" -ForegroundColor Gray
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
Write-Host ""

if (Get-Command vercel -ErrorAction SilentlyContinue) {
    Write-Host "Deploying to production..." -ForegroundColor Gray
    vercel --prod
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Deployment complete" -ForegroundColor Green
    } else {
        Write-Host "✗ Deployment failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠ Vercel CLI not found" -ForegroundColor Yellow
    Write-Host "Deploying via Git push..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run these commands manually:" -ForegroundColor Yellow
    Write-Host "  git add ." -ForegroundColor Gray
    Write-Host "  git commit -m 'M3: Add EAN/unit fields, pagination, stock calculations'" -ForegroundColor Gray
    Write-Host "  git push origin main" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vercel will auto-deploy on push to main" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Deployment process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify migration in Supabase Dashboard" -ForegroundColor White
Write-Host "2. Test production URL: https://biz-finetune-store.vercel.app" -ForegroundColor White
Write-Host "3. Test product creation with EAN/unit fields" -ForegroundColor White
Write-Host "4. Test pagination and search on Products page" -ForegroundColor White
Write-Host "5. Test stock transactions with current stock display" -ForegroundColor White
Write-Host ""

