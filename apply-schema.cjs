#!/usr/bin/env node

/**
 * Apply database schema via direct PostgreSQL connection
 * Uses Node.js pg library which handles DNS/IPv6 better than psql
 */

const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

function getConnectionConfig() {
  return {
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  };
}

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not found in .env');
  console.error('');
  console.error('Expected format:');
  console.error('DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres');
  process.exit(1);
}

async function applySchema() {
  const config = getConnectionConfig();
  console.log('🔧 Connecting to Supabase database...');
  console.log('');

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    console.log('');

    // Read schema file
    const schemaSQL = fs.readFileSync('schema.sql', 'utf8');
    
    console.log('📝 Applying schema.sql...');
    console.log('');

    // Execute schema
    await client.query(schemaSQL);

    console.log('✅ Schema applied successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('');
    console.log('1. Create your first tenant:');
    console.log('   node create-tenant.js');
    console.log('');
    console.log('2. Or manually run queries from setup-initial-data.sql');
    console.log('');
    console.log('3. Test the app:');
    console.log('   https://biz-finetune-store.vercel.app/login');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error applying schema:');
    console.error('');
    console.error(error.message);
    console.error('');
    
    if (error.code === 'ENOTFOUND') {
      console.error('DNS resolution failed. This might be a network issue.');
      console.error('');
      console.error('Fallback options:');
      console.error('1. Use Supabase Dashboard SQL Editor (recommended):');
      console.error('   https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/sql');
      console.error('');
      console.error('2. Check your internet connection and DNS settings');
      console.error('3. Try using a VPN or different network');
    } else if (error.code === '42P07') {
      console.error('Tables already exist!');
      console.error('');
      console.error('Options:');
      console.error('1. Drop existing tables first: node apply-schema.js --drop');
      console.error('2. Or manually run drop-all-tables.sql first');
    } else {
      console.error('Full error:', error);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function dropTables() {
  const config = getConnectionConfig();
  console.log('🗑️  Dropping existing tables...');
  console.log('');

  const client = new Client(config);

  try {
    await client.connect();
    
    const dropSQL = fs.readFileSync('drop-all-tables.sql', 'utf8');
    await client.query(dropSQL);

    console.log('✅ Tables dropped successfully!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error dropping tables:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Main execution
(async () => {
  const shouldDrop = process.argv.includes('--drop') || process.argv.includes('-d');

  if (shouldDrop) {
    await dropTables();
  }

  await applySchema();
})();

