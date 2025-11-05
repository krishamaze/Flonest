#!/usr/bin/env node

/**
 * Check current database setup
 */

const { Client } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

async function checkSetup() {
  console.log('🔍 Checking database setup...');
  console.log('');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // Check tenants
    const tenantsResult = await client.query(`
      SELECT id, name, slug, state, gst_enabled, created_at 
      FROM tenants 
      ORDER BY created_at DESC
    `);

    console.log('📊 Tenants:');
    console.log('');
    if (tenantsResult.rows.length === 0) {
      console.log('   (none)');
    } else {
      tenantsResult.rows.forEach(t => {
        console.log(`   ✅ ${t.name} (${t.slug})`);
        console.log(`      ID: ${t.id}`);
        console.log(`      State: ${t.state}`);
        console.log(`      GST: ${t.gst_enabled ? 'Enabled' : 'Disabled'}`);
        console.log('');
      });
    }

    // Check team members
    const membersResult = await client.query(`
      SELECT 
        tm.id,
        tm.email,
        tm.role,
        t.name as tenant_name,
        au.email as auth_email
      FROM team_members tm
      JOIN tenants t ON tm.tenant_id = t.id
      LEFT JOIN auth.users au ON tm.user_id = au.id
      ORDER BY tm.created_at DESC
    `);

    console.log('👥 Team Members:');
    console.log('');
    if (membersResult.rows.length === 0) {
      console.log('   (none)');
    } else {
      membersResult.rows.forEach(m => {
        console.log(`   ✅ ${m.email} (${m.role})`);
        console.log(`      Tenant: ${m.tenant_name}`);
        console.log(`      Auth: ${m.auth_email || 'Not linked'}`);
        console.log('');
      });
    }

    // Check inventory
    const inventoryResult = await client.query(`
      SELECT COUNT(*) as count FROM inventory
    `);

    console.log(`📦 Inventory Items: ${inventoryResult.rows[0].count}`);
    console.log('');

    // Check invoices
    const invoicesResult = await client.query(`
      SELECT COUNT(*) as count FROM invoices
    `);

    console.log(`🧾 Invoices: ${invoicesResult.rows[0].count}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (membersResult.rows.length > 0) {
      console.log('✅ Setup complete! You can login to the app.');
      console.log('');
      console.log('Login at: https://biz-finetune-store.vercel.app/login');
      console.log(`Email: ${membersResult.rows[0].email}`);
      console.log('');
    } else {
      console.log('⚠️  No team members found. Run setup-tenant.cjs');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkSetup();

