#!/usr/bin/env node

/**
 * Verify database schema was applied correctly
 */

const { Client } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

async function verifySchema() {
  console.log('🔍 Verifying database schema...');
  console.log('');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📊 Tables in database:');
    console.log('');
    tablesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    console.log('');

    // Check functions
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      ORDER BY routine_name
    `);

    console.log('⚙️  Functions in database:');
    console.log('');
    functionsResult.rows.forEach(row => {
      console.log(`   ✅ ${row.routine_name}`);
    });
    console.log('');

    // Expected tables
    const expectedTables = [
      'tenants',
      'team_members',
      'master_products',
      'inventory',
      'invoices',
      'invoice_items'
    ];

    const actualTables = tablesResult.rows.map(r => r.table_name);
    const missingTables = expectedTables.filter(t => !actualTables.includes(t));

    if (missingTables.length > 0) {
      console.log('⚠️  Missing tables:');
      missingTables.forEach(t => console.log(`   ❌ ${t}`));
      console.log('');
    } else {
      console.log('✅ All expected tables exist!');
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ Schema verification complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Create your first tenant');
    console.log('2. Link your user account');
    console.log('3. Test the app');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySchema();

