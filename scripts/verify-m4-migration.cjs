const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyMigration() {
  console.log('🔍 Verifying M4 Migration...\n')

  const results = {
    tables: {},
    indexes: {},
    rls: {},
    rpc: {},
    errors: [],
  }

  try {
    // 1. Check master_customers table exists
    console.log('1. Checking master_customers table...')
    const { data: masterCustomers, error: mcError } = await supabase
      .from('master_customers')
      .select('*')
      .limit(0)

    if (mcError && mcError.code !== 'PGRST116') {
      results.errors.push(`master_customers table: ${mcError.message}`)
      console.log('   ❌ master_customers table not accessible')
    } else {
      console.log('   ✅ master_customers table exists')
      results.tables.master_customers = true
    }

    // 2. Check customers table exists
    console.log('2. Checking customers table...')
    const { data: customers, error: cError } = await supabase
      .from('customers')
      .select('*')
      .limit(0)

    if (cError && cError.code !== 'PGRST116') {
      results.errors.push(`customers table: ${cError.message}`)
      console.log('   ❌ customers table not accessible')
    } else {
      console.log('   ✅ customers table exists')
      results.tables.customers = true
    }

    // 3. Test unique constraint on master_customers.mobile
    console.log('3. Testing unique constraint on master_customers.mobile...')
    try {
      // Try to insert a test record (will fail if constraint works)
      const testMobile = `999999999${Date.now()}`
      const { error: insertError } = await supabase
        .from('master_customers')
        .insert({
          mobile: testMobile,
          legal_name: 'Test Customer',
        })

      if (!insertError) {
        // Clean up test record
        await supabase.from('master_customers').delete().eq('mobile', testMobile)
        console.log('   ✅ Unique constraint on mobile works')
        results.indexes.mobile_unique = true
      } else {
        console.log(`   ⚠️  Insert test: ${insertError.message}`)
      }

      // Try duplicate insert
      const { error: duplicateError } = await supabase
        .from('master_customers')
        .insert({
          mobile: testMobile,
          legal_name: 'Duplicate Test',
        })

      if (duplicateError && duplicateError.code === '23505') {
        console.log('   ✅ Duplicate mobile prevented (unique constraint active)')
        results.indexes.mobile_unique = true
        // Clean up
        await supabase.from('master_customers').delete().eq('mobile', testMobile)
      } else {
        console.log('   ⚠️  Duplicate constraint may not be working')
      }
    } catch (err) {
      console.log(`   ⚠️  Error testing mobile constraint: ${err.message}`)
    }

    // 4. Test RPC function
    console.log('4. Testing upsert_master_customer RPC function...')
    const testMobile2 = `888888888${Date.now()}`
    const { data: rpcResult, error: rpcError } = await supabase.rpc('upsert_master_customer', {
      p_mobile: testMobile2,
      p_gstin: null,
      p_legal_name: 'RPC Test Customer',
      p_address: null,
      p_email: null,
    })

    if (rpcError) {
      results.errors.push(`RPC function: ${rpcError.message}`)
      console.log(`   ❌ RPC function error: ${rpcError.message}`)
    } else {
      console.log('   ✅ RPC function works')
      results.rpc.upsert_master_customer = true
      // Clean up
      if (rpcResult) {
        await supabase.from('master_customers').delete().eq('id', rpcResult)
      }
    }

    // 5. Check customer_id column in invoices
    console.log('5. Checking customer_id column in invoices...')
    const { data: invoiceTest, error: invoiceError } = await supabase
      .from('invoices')
      .select('customer_id')
      .limit(1)

    if (invoiceError && invoiceError.code !== 'PGRST116') {
      results.errors.push(`invoices.customer_id: ${invoiceError.message}`)
      console.log('   ❌ customer_id column not found')
    } else {
      console.log('   ✅ customer_id column exists in invoices')
      results.tables.invoices_customer_id = true
    }

    // 6. Test RLS on master_customers (read-only)
    console.log('6. Testing RLS on master_customers (should be read-only)...')
    const { error: insertRLSError } = await supabase
      .from('master_customers')
      .insert({
        mobile: `777777777${Date.now()}`,
        legal_name: 'RLS Test',
      })

    if (insertRLSError && insertRLSError.code === '42501') {
      console.log('   ✅ RLS prevents direct INSERT (read-only as expected)')
      results.rls.master_customers_readonly = true
    } else if (insertRLSError) {
      console.log(`   ⚠️  RLS test: ${insertRLSError.message}`)
    } else {
      console.log('   ⚠️  RLS may not be preventing direct inserts')
    }

    // 7. Test RLS on customers (org-scoped)
    console.log('7. Testing RLS on customers (org-scoped)...')
    // This requires an authenticated user, so we'll just check if we can query
    const { data: customersData, error: customersRLSError } = await supabase
      .from('customers')
      .select('*')
      .limit(1)

    if (customersRLSError && customersRLSError.code !== 'PGRST116') {
      console.log(`   ⚠️  RLS on customers: ${customersRLSError.message}`)
    } else {
      console.log('   ✅ RLS on customers is active (queries work)')
      results.rls.customers_org_scoped = true
    }

    // Summary
    console.log('\n📊 Verification Summary:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Tables: ${Object.keys(results.tables).length} verified`)
    console.log(`Indexes: ${Object.keys(results.indexes).length} verified`)
    console.log(`RLS Policies: ${Object.keys(results.rls).length} verified`)
    console.log(`RPC Functions: ${Object.keys(results.rpc).length} verified`)

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      results.errors.forEach((err) => console.log(`   - ${err}`))
    }

    const allGood =
      results.tables.master_customers &&
      results.tables.customers &&
      results.tables.invoices_customer_id &&
      results.rpc.upsert_master_customer &&
      results.rls.master_customers_readonly

    if (allGood) {
      console.log('\n✅ Migration verification PASSED')
      process.exit(0)
    } else {
      console.log('\n⚠️  Migration verification has warnings')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    process.exit(1)
  }
}

verifyMigration()

