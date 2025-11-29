#!/usr/bin/env node
/**
 * Supabase CLI Link Script
 * Uses SUPABASE_DB_PASSWORD and SUPABASE_ACCESS_TOKEN from .env
 */

const { execSync } = require('child_process');
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const PROJECT_REF = 'evbbdlzwfqhvcuojlahr';

function checkEnvVars() {
  // Try to extract password from DATABASE_URL if not set explicitly
  if (!process.env.SUPABASE_DB_PASSWORD && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (url.password) {
        process.env.SUPABASE_DB_PASSWORD = url.password;
        console.log('🔑 Extracted password from DATABASE_URL');
      }
    } catch (e) {
      console.warn('⚠️  Could not parse DATABASE_URL');
    }
  }

  const missing = [];
  if (!process.env.SUPABASE_DB_PASSWORD) missing.push('SUPABASE_DB_PASSWORD');

  // SUPABASE_ACCESS_TOKEN is optional if user is logged in via CLI
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.warn('⚠️  SUPABASE_ACCESS_TOKEN not set. Assuming you are logged in via "npx supabase login".');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('\nPlease set these in your .env file:');
    console.error('  SUPABASE_DB_PASSWORD=your-database-password');
    console.error('  OR set DATABASE_URL with the password included');
    process.exit(1);
  }
}

function linkProject() {
  console.log('🔗 Linking to Supabase project:', PROJECT_REF);
  console.log('📡 Using direct connection (--skip-pooler)\n');

  checkEnvVars();
  console.log('Linking project...\n');

  try {
    execSync(
      `npx supabase link --project-ref ${PROJECT_REF} --skip-pooler --password "${process.env.SUPABASE_DB_PASSWORD}"`,
      {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
        },
      }
    );
    console.log('\n✅ Successfully linked! Run: npm run supabase:db:push');
  } catch (error) {
    console.error('\n❌ Failed to link. Check:');
    console.error('  1. SUPABASE_DB_PASSWORD is correct in .env');
    console.error('  2. SUPABASE_ACCESS_TOKEN is set (run: npx supabase login)');
    console.error('  3. Network connection is available');
    process.exit(1);
  }
}

linkProject();
