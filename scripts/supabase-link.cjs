#!/usr/bin/env node
/**
 * Supabase CLI Link Script
 * Uses SUPABASE_DB_PASSWORD and SUPABASE_ACCESS_TOKEN from .env
 */

const { execSync } = require('child_process');
require('dotenv').config();

const PROJECT_REF = 'yzrwkznkfisfpnwzbwfw';

function checkEnvVars() {
  const missing = [];
  if (!process.env.SUPABASE_DB_PASSWORD) missing.push('SUPABASE_DB_PASSWORD');
  if (!process.env.SUPABASE_ACCESS_TOKEN) missing.push('SUPABASE_ACCESS_TOKEN');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('\nPlease set these in your .env file:');
    console.error('  SUPABASE_DB_PASSWORD=your-database-password');
    console.error('  SUPABASE_ACCESS_TOKEN=your-access-token');
    console.error('\nGet these from:');
    console.error('  - SUPABASE_DB_PASSWORD: Supabase Dashboard → Project Settings → Database');
    console.error('  - SUPABASE_ACCESS_TOKEN: Run "npx supabase login"');
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
