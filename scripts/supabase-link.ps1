# Supabase CLI Link Script
# Links to cloud Supabase project with direct connection (no pooler, no Docker)

param(
    [string]$Password = ""
)

$ProjectRef = "yzrwkznkfisfpnwzbwfw"

Write-Host "Linking to Supabase project: $ProjectRef" -ForegroundColor Cyan
Write-Host "Using direct connection (--skip-pooler)" -ForegroundColor Yellow

if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "`nEnter your Supabase database password:" -ForegroundColor Yellow
    $securePassword = Read-Host -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host "`nLinking project..." -ForegroundColor Cyan
npx supabase link --project-ref $ProjectRef --skip-pooler --password $Password

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully linked to Supabase project!" -ForegroundColor Green
    Write-Host "`nYou can now run migrations with:" -ForegroundColor Cyan
    Write-Host "  npm run supabase:db:push" -ForegroundColor White
} else {
    Write-Host "`n❌ Failed to link project. Please check your credentials." -ForegroundColor Red
    exit 1
}

