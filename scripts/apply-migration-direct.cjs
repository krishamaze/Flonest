#!/usr/bin/env node
/**
 * Apply Migration Directly via Supabase SQL Editor API
 * Uses SUPABASE_ACCESS_TOKEN and connection details from .env
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const PROJECT_REF = 'yzrwkznkfisfpnwzbwfw';
const MIGRATION_FILE = 'supabase/migrations/20251110000000_add_schema_version_tracking.sql';

function checkEnvVars() {
  const missing = [];
  if (!process.env.SUPABASE_ACCESS_TOKEN) missing.push('SUPABASE_ACCESS_TOKEN');
  if (!process.env.SUPABASE_DB_PASSWORD) missing.push('SUPABASE_DB_PASSWORD');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('\nPlease set these in your .env file:');
    console.error('  SUPABASE_ACCESS_TOKEN=your-access-token');
    console.error('  SUPABASE_DB_PASSWORD=your-database-password');
    console.error('\nGet these from:');
    console.error('  - SUPABASE_ACCESS_TOKEN: Run "npx supabase login"');
    console.error('  - SUPABASE_DB_PASSWORD: Supabase Dashboard → Project Settings → Database');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found');
  console.log('   SUPABASE_ACCESS_TOKEN: ' + (process.env.SUPABASE_ACCESS_TOKEN ? '***set***' : 'missing'));
  console.log('   SUPABASE_DB_PASSWORD: ' + (process.env.SUPABASE_DB_PASSWORD ? '***set***' : 'missing'));
}

function readMigrationFile() {
  const migrationPath = path.join(process.cwd(), MIGRATION_FILE);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log(`✅ Migration file read: ${MIGRATION_FILE}`);
  console.log(`   Size: ${migrationSQL.length} characters`);
  
  return migrationSQL;
}

function applyMigrationViaSupabaseCLI() {
  console.log('\n📡 Attempting to apply migration via Supabase CLI...');
  console.log(`   Project: ${PROJECT_REF}\n`);
  
  checkEnvVars();
  
  try {
    // First, ensure project is linked
    console.log('🔗 Ensuring project is linked...');
    try {
      execSync(
        `npx supabase link --project-ref ${PROJECT_REF} --password "${process.env.SUPABASE_DB_PASSWORD}"`,
        {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: {
            ...process.env,
            SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
          },
        }
      );
      console.log('✅ Project linked successfully\n');
    } catch (linkError) {
      console.log('⚠️  Link step had issues, continuing with migration push...\n');
    }
    
    // Push migration
    console.log('📦 Pushing migration to remote database...');
    execSync(
      'npx supabase db push --linked --yes',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
        },
      }
    );
    
    console.log('\n✅ Migration applied successfully via CLI!');
    return true;
  } catch (error) {
    console.error('\n❌ Failed to apply migration via CLI:');
    console.error('Error:', error.message);
    return false;
  }
}

function generateManualInstructions(migrationSQL) {
  console.log('\n⚠️  CLI migration failed. Use manual method:\n');
  console.log('=' .repeat(70));
  console.log('MANUAL MIGRATION INSTRUCTIONS');
  console.log('=' .repeat(70));
  console.log('\n1. Open Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/' + PROJECT_REF);
  console.log('\n2. Navigate to SQL Editor');
  console.log('\n3. Copy and paste the following SQL:\n');
  console.log('-'.repeat(70));
  console.log(migrationSQL);
  console.log('-'.repeat(70));
  console.log('\n4. Click "Run" to execute');
  console.log('\n5. Verify migration with queries from scripts/verify-migration.sql');
  console.log('\n' + '=' .repeat(70));
}

function main() {
  console.log('🚀 Applying Database Migration\n');
  
  const migrationSQL = readMigrationFile();
  
  // Try CLI first
  const success = applyMigrationViaSupabaseCLI();
  
  if (!success) {
    generateManualInstructions(migrationSQL);
    
    // Also save migration SQL to a temp file for easy copy-paste
    const tempFile = path.join(process.cwd(), 'migration-to-apply.sql');
    fs.writeFileSync(tempFile, migrationSQL);
    console.log(`\n💾 Migration SQL saved to: ${tempFile}`);
    console.log('   You can copy this file content and paste into Supabase SQL Editor');
  } else {
    console.log('\n📋 Next steps:');
    console.log('   1. Verify migration in Supabase Dashboard → Database → Migrations');
    console.log('   2. Run verification queries from scripts/verify-migration.sql');
    console.log('   3. Test get_current_app_version() returns schema_version');
  }
}

main();

