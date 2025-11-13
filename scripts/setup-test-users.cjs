#!/usr/bin/env node
/**
 * Setup Test Users Script
 * Creates owner@test.com and resets passwords for internal@test.com and owner@test.com
 * 
 * Usage: node scripts/setup-test-users.cjs
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Missing Supabase URL')
  console.error('Required: VITE_SUPABASE_URL or SUPABASE_URL')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase Service Role Key')
  console.error('Required: SUPABASE_SERVICE_KEY')
  console.error('\nGet this from:')
  console.error('  - Supabase Dashboard → Project Settings → API → Service Role Key')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupTestUsers() {
  console.log('\n🔧 Setting up test users...\n')

  const users = [
    {
      email: 'internal@test.com',
      password: 'password',
      fullName: 'Internal Test User',
      isInternal: true
    },
    {
      email: 'owner@test.com',
      password: 'password',
      fullName: 'Owner Test User',
      isInternal: false
    }
  ]

  for (const user of users) {
    try {
      console.log(`\n📧 Processing: ${user.email}`)
      
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)
      
      let userId
      
      if (existingUser) {
        console.log('   ℹ️  User exists, updating password...')
        userId = existingUser.id
        
        // Update password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userId,
          { password: user.password }
        )
        
        if (updateError) {
          throw updateError
        }
        console.log('   ✅ Password updated to "password"')
      } else {
        console.log('   ℹ️  Creating new user...')
        
        // Create new user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.fullName,
          }
        })
        
        if (authError) {
          throw authError
        }
        
        userId = authData.user.id
        console.log('   ✅ User created:', userId)
      }
      
      // Ensure profile exists
      console.log('   ℹ️  Ensuring profile exists...')
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email: user.email,
            full_name: user.fullName,
            is_internal: user.isInternal,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        if (updateError) {
          throw updateError
        }
        console.log('   ✅ Profile updated')
      } else {
        // Create new profile
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email,
            full_name: user.fullName,
            is_internal: user.isInternal,
          })
        
        if (createError) {
          throw createError
        }
        console.log('   ✅ Profile created')
      }
      
      console.log(`   ✅ ${user.email} setup complete`)
      
    } catch (error) {
      console.error(`   ❌ Error processing ${user.email}:`, error.message)
      if (error.details) {
        console.error('   Details:', error.details)
      }
      throw error
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ Test Users Setup Complete!\n')
  console.log('Test Accounts:')
  console.log('  1. internal@test.com / password (Internal Reviewer)')
  console.log('  2. owner@test.com / password (Owner)')
  console.log('\n' + '='.repeat(60) + '\n')
}

setupTestUsers().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})









