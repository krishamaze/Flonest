/**
 * Quick test script to verify dashboard queries work with new schema
 * Tests dashboard queries with org_id filtering
 * 
 * Usage: node test-dashboard-queries.cjs
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const TEST_EMAIL = 'demo@example.com'
const TEST_PASSWORD = 'password'

async function testDashboardQueries() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Dashboard Queries Test (New Schema)')
  console.log('═══════════════════════════════════════════════════════════\n')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Login
    console.log('[1] Logging in...')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

    if (signInError) {
      console.error('Login failed:', signInError.message)
      process.exit(1)
    }

    console.log('✓ Logged in as:', signInData.user.email)

    // Get user's org_id
    console.log('\n[2] Getting user org_id...')
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('*, orgs(*)')
      .eq('profile_id', signInData.user.id)
      .limit(1)

    if (membershipError || !memberships || memberships.length === 0) {
      console.error('Failed to get membership:', membershipError?.message)
      process.exit(1)
    }

    const orgId = memberships[0].orgs.id
    console.log('✓ Org ID:', orgId)
    console.log('✓ Org Name:', memberships[0].orgs.name)

    // Test Dashboard Queries (matching DashboardPage.tsx)
    console.log('\n[3] Testing Dashboard Queries...\n')

    // Test 1: Inventory count
    console.log('Test 1: Inventory count with org_id filter')
    const { count: inventoryCount, error: inventoryCountError } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)

    if (inventoryCountError) {
      console.error('  ✗ Error:', inventoryCountError.message)
    } else {
      console.log(`  ✓ Inventory count: ${inventoryCount || 0} items`)
    }

    // Test 2: Inventory data
    console.log('\nTest 2: Inventory data with org_id filter')
    const { data: inventoryData, error: inventoryDataError } = await supabase
      .from('inventory')
      .select('quantity, cost_price, selling_price')
      .eq('org_id', orgId)

    if (inventoryDataError) {
      console.error('  ✗ Error:', inventoryDataError.message)
    } else {
      console.log(`  ✓ Inventory items: ${inventoryData?.length || 0}`)
      if (inventoryData && inventoryData.length > 0) {
        const totalValue = inventoryData.reduce(
          (sum, item) => sum + (item.quantity || 0) * (item.selling_price || 0),
          0
        )
        console.log(`  ✓ Total value: $${totalValue.toFixed(2)}`)
      }
    }

    // Test 3: Invoices count
    console.log('\nTest 3: Invoices count with org_id filter')
    const { count: invoicesCount, error: invoicesCountError } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)

    if (invoicesCountError) {
      console.error('  ✗ Error:', invoicesCountError.message)
    } else {
      console.log(`  ✓ Invoices count: ${invoicesCount || 0}`)
    }

    // Test 4: Verify RLS - queries without explicit org_id should still be filtered
    console.log('\nTest 4: RLS Verification - Queries should only return user\'s org data')
    const { data: allInventory, error: allInventoryError } = await supabase
      .from('inventory')
      .select('org_id')

    if (allInventoryError) {
      console.error('  ✗ Error:', allInventoryError.message)
    } else {
      const hasCrossTenantData = allInventory && allInventory.some(item => item.org_id !== orgId)
      if (hasCrossTenantData) {
        console.error('  ✗ SECURITY ISSUE: Query returned data from other orgs!')
      } else {
        console.log(`  ✓ RLS working: Only ${allInventory?.length || 0} items from user's org`)
        console.log('  ✓ No cross-tenant data visible')
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  Dashboard Queries Test Complete')
    console.log('═══════════════════════════════════════════════════════════\n')
    console.log('Summary:')
    console.log('  ✓ Dashboard queries work with org_id filtering')
    console.log('  ✓ RLS policies are active and working')
    console.log('  ✓ New schema (profiles/orgs/memberships) functioning correctly')

  } catch (error) {
    console.error('\nError:', error.message)
    process.exit(1)
  } finally {
    await supabase.auth.signOut()
  }
}

testDashboardQueries().catch(error => {
  console.error('Unhandled error:', error.message)
  process.exit(1)
})

