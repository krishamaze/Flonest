#!/usr/bin/env node
/**
 * Supabase CLI Link Script
 * Links to cloud Supabase project with direct connection (no pooler, no Docker)
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'yzrwkznkfisfpnwzbwfw';

// Check if .supabase directory exists, create if not
const supabaseDir = path.join(process.cwd(), '.supabase');
if (!fs.existsSync(supabaseDir)) {
  fs.mkdirSync(supabaseDir, { recursive: true });
}

function getPassword() {
  return new Promise((resolve) => {
    // Check environment variable first
    if (process.env.SUPABASE_DB_PASSWORD) {
      resolve(process.env.SUPABASE_DB_PASSWORD);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter your Supabase database password: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function linkProject() {
  console.log('🔗 Linking to Supabase project:', PROJECT_REF);
  console.log('📡 Using direct connection (--skip-pooler)');
  console.log('');

  const password = await getPassword();

  if (!password) {
    console.error('❌ Password is required');
    process.exit(1);
  }

  console.log('');
  console.log('Linking project...');

  try {
    // Link with --skip-pooler for direct connection
    execSync(
      `npx supabase link --project-ref ${PROJECT_REF} --skip-pooler --password "${password}"`,
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );

    console.log('');
    console.log('✅ Successfully linked to Supabase project!');
    console.log('');
    console.log('You can now run migrations with:');
    console.log('  npm run supabase:db:push');
  } catch (error) {
    console.error('');
    console.error('❌ Failed to link project. Please check your credentials.');
    console.error('');
    if (error.message) {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

linkProject().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

