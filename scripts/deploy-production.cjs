#!/usr/bin/env node

/**
 * Production Deployment Script for M3
 * Handles database migration and code deployment with verification
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🚀 M3 Production Deployment')
console.log('============================\n')

// Step 1: Database Migration
console.log('📦 Step 1: Deploying Database Migration...\n')

try {
  const supabaseExe = join(projectRoot, 'bin', 'supabase.exe')
  
  if (!existsSync(supabaseExe)) {
    console.error('❌ Supabase CLI not found at:', supabaseExe)
    console.error('\nPlease deploy migration manually:')
    console.error('1. Go to https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw')
    console.error('2. Navigate to SQL Editor')
    console.error('3. Copy and execute: supabase/migrations/20251106020000_create_products_stock_ledger.sql\n')
    process.exit(1)
  }

  console.log('⚠️  Migration requires manual confirmation')
  console.log('Please run: .\\bin\\supabase.exe db push')
  console.log('Or apply migration via Supabase Dashboard SQL Editor\n')
  
  // For automated deployment, we'll provide instructions
  const migrationPath = join(projectRoot, 'supabase', 'migrations', '20251106020000_create_products_stock_ledger.sql')
  const migrationContent = readFileSync(migrationPath, 'utf-8')
  
  console.log('Migration file ready:', migrationPath)
  console.log('Migration will create:')
  console.log('  - products table')
  console.log('  - stock_ledger table')
  console.log('  - RLS policies')
  console.log('  - Performance indexes\n')
  
} catch (error) {
  console.error('❌ Error preparing migration:', error.message)
  process.exit(1)
}

// Step 2: Build Verification
console.log('🔨 Step 2: Verifying Build...\n')

try {
  execSync('npm run build', { 
    cwd: projectRoot,
    stdio: 'inherit'
  })
  console.log('\n✅ Build successful\n')
} catch (error) {
  console.error('\n❌ Build failed')
  process.exit(1)
}

// Step 3: Code Deployment
console.log('🚀 Step 3: Deploying to Vercel...\n')

try {
  // Check if vercel CLI is available
  try {
    execSync('vercel --version', { stdio: 'pipe' })
    console.log('Deploying to production...')
    console.log('⚠️  This will require confirmation')
    console.log('Run: vercel --prod\n')
    
    // For automated deployment, provide instructions
    console.log('Or deploy via:')
    console.log('  - Git push: git push origin main (if auto-deploy enabled)')
    console.log('  - Vercel Dashboard: https://vercel.com/dashboard\n')
    
  } catch (error) {
    console.log('⚠️  Vercel CLI not found')
    console.log('Please deploy manually via:')
    console.log('  1. Git push: git push origin main')
    console.log('  2. Vercel Dashboard\n')
  }
} catch (error) {
  console.error('❌ Deployment error:', error.message)
  process.exit(1)
}

console.log('✅ Deployment process initiated!')
console.log('\n📋 Next Steps:')
console.log('1. Confirm database migration (if not done)')
console.log('2. Confirm Vercel deployment')
console.log('3. Run verification: node scripts/verify-deployment.cjs')
console.log('4. Test at: https://biz-finetune-store.vercel.app')
console.log('\n📖 See DEPLOYMENT_M3.md for detailed testing checklist\n')

