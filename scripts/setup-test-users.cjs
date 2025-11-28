#!/usr/bin/env node
/**
 * Setup Test Users Script
 * Creates all role test users with org, branch, and memberships
 *
 * Usage: node scripts/setup-test-users.cjs
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing Supabase URL')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TEST_USERS = [
  { email: 'internal@test.com', fullName: 'Platform Admin', platformAdmin: true, role: null },
  { email: 'owner@test.com', fullName: 'Org Owner', platformAdmin: false, role: 'org_owner' },
  { email: 'branch@test.com', fullName: 'Branch Head', platformAdmin: false, role: 'branch_head' },
  { email: 'advisor@test.com', fullName: 'Advisor User', platformAdmin: false, role: 'advisor' },
  { email: 'agent@test.com', fullName: 'Agent User', platformAdmin: false, role: 'agent' },
]

const PASSWORD = 'password'

async function createOrUpdateUser(user) {
  console.log(`\n📧 ${user.email}`)

  // Try to create user (will fail if exists)
  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: user.fullName }
  })

  let userId
  if (createErr && createErr.message.includes('already been registered')) {
    // User exists, find and update
    const { data: listData } = await supabase.auth.admin.listUsers()
    const existing = listData?.users?.find(u => u.email === user.email)
    if (!existing) throw new Error('User exists but not found in list')
    userId = existing.id
    await supabase.auth.admin.updateUserById(userId, { password: PASSWORD })
    console.log('   ✓ Password reset')
  } else if (createErr) {
    throw createErr
  } else {
    userId = createData.user.id
    console.log('   ✓ Created:', userId)
  }

  // Upsert profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: user.email,
      full_name: user.fullName,
      platform_admin: user.platformAdmin,
    }, { onConflict: 'id' })

  if (profileErr) throw profileErr
  console.log('   ✓ Profile synced')

  return { ...user, id: userId }
}

async function setupOrgAndMemberships(users) {
  console.log('\n🏢 Setting up Flonest Test Org...')

  const owner = users.find(u => u.role === 'org_owner')
  if (!owner) throw new Error('No org_owner user found')

  // Create or get org
  let { data: org } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', 'flonest-test-org')
    .maybeSingle()

  if (!org) {
    const { data, error } = await supabase
      .from('orgs')
      .insert({
        name: 'Flonest Test Org',
        slug: 'flonest-test-org',
        state: 'Maharashtra',
        gst_enabled: false,
      })
      .select()
      .single()
    if (error) throw error
    org = data
    console.log('   ✓ Org created:', org.id)
  } else {
    console.log('   ✓ Org exists:', org.id)
  }

  // Create branch for non-owner roles
  let { data: branch } = await supabase
    .from('branches')
    .select('*')
    .eq('org_id', org.id)
    .eq('name', 'Main Branch')
    .maybeSingle()

  if (!branch) {
    const { data, error } = await supabase
      .from('branches')
      .insert({
        org_id: org.id,
        name: 'Main Branch',
        branch_head_id: users.find(u => u.role === 'branch_head')?.id || null,
      })
      .select()
      .single()
    if (error) throw error
    branch = data
    console.log('   ✓ Branch created:', branch.id)
  } else {
    console.log('   ✓ Branch exists:', branch.id)
  }

  // Create memberships for org users
  console.log('\n👥 Setting up memberships...')
  for (const user of users) {
    if (!user.role) continue // Skip platform admin

    const membershipData = {
      profile_id: user.id,
      org_id: org.id,
      role: user.role,
      membership_status: 'active',
      branch_id: user.role === 'org_owner' ? null : branch.id,
    }

    const { error } = await supabase
      .from('memberships')
      .upsert(membershipData, { onConflict: 'profile_id,org_id' })

    if (error) throw error
    console.log(`   ✓ ${user.email} → ${user.role}`)
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🔧 FLONEST TEST ENVIRONMENT SEED')
  console.log('='.repeat(60))

  const createdUsers = []
  for (const user of TEST_USERS) {
    const created = await createOrUpdateUser(user)
    createdUsers.push(created)
  }

  await setupOrgAndMemberships(createdUsers)

  console.log('\n' + '='.repeat(60))
  console.log('✅ SEED COMPLETE\n')
  console.log('Test Accounts (password: "password"):')
  console.log('  internal@test.com  → Platform Admin')
  console.log('  owner@test.com     → /owner')
  console.log('  branch@test.com    → /branch')
  console.log('  advisor@test.com   → /advisor')
  console.log('  agent@test.com     → /agent')
  console.log('='.repeat(60) + '\n')
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  if (err.details) console.error('Details:', err.details)
  if (err.hint) console.error('Hint:', err.hint)
  console.error(err.stack)
  process.exit(1)
})










