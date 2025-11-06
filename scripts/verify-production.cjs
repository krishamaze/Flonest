#!/usr/bin/env node

/**
 * Production Verification Script
 * Tests the deployed M3 enhanced features
 */

const https = require('https')
const readline = require('readline')

const PRODUCTION_URL = 'https://biz-finetune-store.vercel.app'
const DEMO_EMAIL = 'demo@example.com'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200)
    }).on('error', () => resolve(false))
  })
}

console.log('🔍 Production Verification Checklist\n')
console.log('=' .repeat(50))
console.log('')

// 1. URL Accessibility
console.log('1. Checking production URL accessibility...')
const urlAccessible = await checkUrl(PRODUCTION_URL)
if (urlAccessible) {
  console.log('   ✓ Production URL is accessible')
} else {
  console.log('   ✗ Production URL is not accessible')
  console.log(`   URL: ${PRODUCTION_URL}`)
}
console.log('')

// 2. Manual Testing Checklist
console.log('2. Manual Testing Checklist:')
console.log('   Please test the following in your browser:\n')
console.log('   Database Features:')
console.log('   [ ] Products table has EAN and unit columns')
console.log('   [ ] Can create product with EAN field')
console.log('   [ ] Can create product with unit field (default: pcs)')
console.log('   [ ] EAN field is searchable')
console.log('')
console.log('   ProductList Component:')
console.log('   [ ] Search works (name, SKU, EAN)')
console.log('   [ ] Category filter works')
console.log('   [ ] Pagination works (Previous/Next buttons)')
console.log('   [ ] Current stock displays correctly')
console.log('   [ ] Stock status badges show (In Stock/Low Stock/Out of Stock)')
console.log('')
console.log('   ProductForm Component:')
console.log('   [ ] EAN field appears in form')
console.log('   [ ] Unit field appears in form (default: pcs)')
console.log('   [ ] Can create product with all fields')
console.log('   [ ] Can edit product and update EAN/unit')
console.log('   [ ] Form validation works')
console.log('')
console.log('   StockTransaction Component:')
console.log('   [ ] Current stock displays when product selected')
console.log('   [ ] Stock after transaction preview shows')
console.log('   [ ] Low stock warning appears when applicable')
console.log('   [ ] Negative stock warning appears when applicable')
console.log('   [ ] Stock-out validation prevents insufficient stock')
console.log('   [ ] Stock calculations update correctly after transaction')
console.log('')

// 3. Database Verification
console.log('3. Database Verification:')
console.log('   Run these queries in Supabase SQL Editor:\n')
console.log('   -- Check EAN and unit columns exist:')
console.log('   SELECT column_name, data_type, column_default')
console.log('   FROM information_schema.columns')
console.log('   WHERE table_name = \'products\'')
console.log('   AND column_name IN (\'ean\', \'unit\');')
console.log('')
console.log('   -- Check EAN index exists:')
console.log('   SELECT indexname, indexdef')
console.log('   FROM pg_indexes')
console.log('   WHERE tablename = \'products\'')
console.log('   AND indexname = \'idx_products_org_ean\';')
console.log('')

// 4. Performance Checks
console.log('4. Performance Checks:')
console.log('   [ ] Product list loads quickly (< 2 seconds)')
console.log('   [ ] Search is responsive (debounced)')
console.log('   [ ] Pagination loads quickly')
console.log('   [ ] Stock calculations are fast')
console.log('')

// 5. Mobile Testing
console.log('5. Mobile Device Testing:')
console.log('   [ ] Forms work on mobile (Modal/Drawer)')
console.log('   [ ] Pagination works on mobile')
console.log('   [ ] Search works on mobile')
console.log('   [ ] Stock transaction form displays correctly')
console.log('   [ ] Touch interactions work smoothly')
console.log('')

console.log('=' .repeat(50))
console.log('')
console.log('✅ Verification checklist complete!')
console.log('')
console.log(`Production URL: ${PRODUCTION_URL}`)
console.log(`Demo Login: ${DEMO_EMAIL}`)
console.log('')

rl.close()

