#!/usr/bin/env node
/**
 * Create Platform Admin Account Script
 * Creates a platform admin account for testing internal tooling
 * 
 * Usage: node scripts/create-internal-user.cjs [email] [password]
 * 
 * Example: node scripts/create-internal-user.cjs internal@test.com Test123!@#
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing Supabase URL')
  console.error('Required: VITE_SUPABASE_URL or SUPABASE_URL')
  console.error('\nGet this from:')
  console.error('  - Supabase Dashboard → Project Settings → API → Project URL')
  console.error('\nAdd to .env file:')
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase Service Role Key')
  console.error('Required: SUPABASE_SERVICE_KEY')
  console.error('\nGet this from:')
  console.error('  - Supabase Dashboard → Project Settings → API → Service Role Key')
  console.error('\n⚠️  Important:')
  console.error('  - Service Role Key is different from Anon Key')
  console.error('  - Service Role Key is different from Access Token (used for CLI)')
  console.error('  - Service Role Key has admin access (bypasses RLS)')
  console.error('  - Keep it secret and never commit to Git')
  console.error('\nAdd to .env file:')
  console.error('  SUPABASE_SERVICE_KEY=your-service-role-key-here')
  console.error('\n💡 Alternative:')
  console.error('  If you prefer SQL approach, use scripts/create-internal-user-sql.sql')
  console.error('  with your transaction pooler connection')
  console.error('\n💡 Tip: This key is also used for GitHub Actions workflows')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createInternalUser(email, password) {
  console.log('\n🔧 Creating Platform Admin Account...\n')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password ? '***' : '(not provided)'}\n`)

  try {
    // Step 1: Create auth user
    console.log('1. Creating auth user...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: password || 'password',
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'Internal Test User',
      }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('   ℹ️  User already exists in auth, continuing...')
        // Get existing user
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === email)
        if (!existingUser) {
          throw new Error(`User ${email} exists but could not be found`)
        }
        var userId = existingUser.id
      } else {
        throw authError
      }
    } else {
      userId = authData.user.id
      console.log('   ✅ Auth user created:', userId)
    }

    // Step 2: Create or update profile
    console.log('\n2. Creating/updating profile...')
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      throw profileCheckError
    }

    if (existingProfile) {
      // Update existing profile to set platform_admin = true
      console.log('   ℹ️  Profile exists, updating platform_admin flag...')
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ platform_admin: true })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }
      console.log('   ✅ Profile updated with platform_admin = true')
    } else {
      // Create new profile with platform_admin = true
      console.log('   ℹ️  Creating new profile with platform_admin = true...')
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          full_name: 'Internal Test User',
          platform_admin: true,
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }
      console.log('   ✅ Profile created with platform_admin = true')
    }

    // Step 3: Check/create membership (optional - platform admins might not need org)
    console.log('\n3. Checking membership...')
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*, orgs(*)')
      .eq('profile_id', userId)
      .maybeSingle()

    if (membershipError && membershipError.code !== 'PGRST116') {
      console.log('   ⚠️  Could not check membership:', membershipError.message)
    } else if (membership) {
      console.log('   ✅ Membership exists:', membership.orgs?.name || 'N/A')
    } else {
      console.log('   ℹ️  No membership found (platform admins may not need org membership)')
    }

    // Step 4: Verify platform_admin flag
    console.log('\n4. Verifying platform_admin flag...')
    const { data: profile, error: verifyError } = await supabase
      .from('profiles')
      .select('id, email, platform_admin')
      .eq('id', userId)
      .single()

    if (verifyError) {
      throw verifyError
    }

    if (profile.platform_admin) {
      console.log('   ✅ platform_admin flag verified: true')
    } else {
      console.log('   ❌ platform_admin flag is false!')
      throw new Error('Failed to set platform_admin flag')
    }

    // Step 5: Test is_internal_user function (now uses platform_admin internally)
    console.log('\n5. Testing is_internal_user function...')
    const { data: isInternal, error: functionError } = await supabase
      .rpc('is_internal_user', { user_id: userId })

    if (functionError) {
      console.log('   ⚠️  Could not test function:', functionError.message)
    } else {
      if (isInternal) {
    console.log('   ✅ is_internal_user() returns: true (uses platform_admin)')
      } else {
        console.log('   ❌ is_internal_user() returns: false')
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Platform Admin Account Created Successfully!\n')
    console.log('Account Details:')
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password || 'password'}`)
    console.log(`  User ID: ${userId}`)
    console.log(`  platform_admin: true`)
    console.log(`  Status: Active`)
    console.log('\nAccess:')
    console.log('  - Can access /platform-admin dashboard')
    console.log('  - Can review products')
    console.log('  - Can manage HSN codes')
    console.log('  - Can view blocked invoices')
    console.log('  - Can access all internal features')
    console.log('\n' + '='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ Error creating platform admin:', error.message)
    if (error.details) {
      console.error('Details:', error.details)
    }
    if (error.hint) {
      console.error('Hint:', error.hint)
    }
    process.exit(1)
  }
}

// Get command line arguments
const email = process.argv[2] || 'internal@test.com'
const password = process.argv[3] || 'password'

// Validate email
if (!email.includes('@')) {
  console.error('❌ Invalid email address:', email)
  process.exit(1)
}

// Validate password
if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters long')
  process.exit(1)
}

createInternalUser(email, password).catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

