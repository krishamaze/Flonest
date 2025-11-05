#!/usr/bin/env node

/**
 * Link existing user to existing tenant
 */

const { Client } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

async function linkUser() {
  console.log('🔗 Linking user to tenant...');
  console.log('');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();

    // Get user
    const userResult = await client.query(`
      SELECT id, email FROM auth.users LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No users found');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`User: ${user.email}`);

    // Get tenant
    const tenantResult = await client.query(`
      SELECT id, name FROM tenants LIMIT 1
    `);

    if (tenantResult.rows.length === 0) {
      console.log('❌ No tenants found');
      process.exit(1);
    }

    const tenant = tenantResult.rows[0];
    console.log(`Tenant: ${tenant.name}`);
    console.log('');

    // Link them
    await client.query(`
      INSERT INTO team_members (tenant_id, user_id, email, role)
      VALUES ($1, $2, $3, 'owner')
      ON CONFLICT (tenant_id, user_id) DO NOTHING
    `, [tenant.id, user.id, user.email]);

    console.log('✅ User linked successfully!');
    console.log('');
    console.log('You can now login at:');
    console.log('https://biz-finetune-store.vercel.app/login');
    console.log('');
    console.log(`Email: ${user.email}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

linkUser();

