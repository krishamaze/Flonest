#!/bin/bash

# M3 Production Deployment Script
# This script deploys the products and stock_ledger migration and code to production

set -e  # Exit on error

echo "🚀 M3 Production Deployment"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Database Migration
echo -e "${YELLOW}Step 1: Deploying database migration...${NC}"
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db push --linked
    echo -e "${GREEN}✓ Migration deployed${NC}"
elif [ -f "./bin/supabase.exe" ]; then
    echo "Using local Supabase CLI..."
    ./bin/supabase.exe db push --linked
    echo -e "${GREEN}✓ Migration deployed${NC}"
else
    echo -e "${RED}⚠ Supabase CLI not found${NC}"
    echo "Please deploy migration manually via Supabase Dashboard:"
    echo "1. Go to https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw"
    echo "2. Navigate to SQL Editor"
    echo "3. Copy and execute: supabase/migrations/20251106020000_create_products_stock_ledger.sql"
    read -p "Press Enter after migration is deployed..."
fi

echo ""

# Step 2: Build verification
echo -e "${YELLOW}Step 2: Verifying build...${NC}"
npm run build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 3: Code Deployment
echo -e "${YELLOW}Step 3: Deploying to Vercel...${NC}"

if command -v vercel &> /dev/null; then
    echo "Deploying to production..."
    vercel --prod
    echo -e "${GREEN}✓ Deployment complete${NC}"
else
    echo -e "${RED}⚠ Vercel CLI not found${NC}"
    echo "Please deploy manually:"
    echo "1. Push to main branch: git push origin main"
    echo "2. Or use Vercel Dashboard to create deployment"
    echo ""
    echo "Production URL: https://biz-finetune-store.vercel.app"
fi

echo ""
echo -e "${GREEN}✅ Deployment process complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify tables in Supabase Dashboard"
echo "2. Test login at https://biz-finetune-store.vercel.app"
echo "3. Test product CRUD operations"
echo "4. Test stock ledger functionality"
echo ""
echo "See DEPLOYMENT_M3.md for detailed testing checklist"

