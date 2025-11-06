# Quick Vercel Status Check Script

Write-Host "🔍 Vercel Deployment Status" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Check latest deployments
Write-Host "Latest Deployments:" -ForegroundColor Yellow
vercel ls --limit 5

Write-Host ""
Write-Host "Production URL: https://biz-finetune-store.vercel.app" -ForegroundColor Green
Write-Host ""

# Check if URL is accessible
Write-Host "Checking production URL accessibility..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "https://biz-finetune-store.vercel.app" -Method Head -UseBasicParsing -ErrorAction SilentlyContinue

if ($response.StatusCode -eq 200) {
    Write-Host "✓ Production URL is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} else {
    Write-Host "✗ Production URL check failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Visit: https://biz-finetune-store.vercel.app" -ForegroundColor White
Write-Host "2. Login with: demo@example.com" -ForegroundColor White
Write-Host "3. Test new features:" -ForegroundColor White
Write-Host "   - Product search with EAN" -ForegroundColor Gray
Write-Host "   - Pagination on Products page" -ForegroundColor Gray
Write-Host "   - Stock calculations in transactions" -ForegroundColor Gray
Write-Host ""

