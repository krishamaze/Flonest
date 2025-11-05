#!/usr/bin/env node

/**
 * Interactive setup for first tenant and user
 */

const { Client } = require('pg');
const readline = require('readline');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('🚀 Supabase Tenant Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Step 1: Get existing users
    console.log('📋 Step 1: Finding your Supabase user...');
    console.log('');

    const usersResult = await client.query(`
      SELECT id, email, created_at 
      FROM auth.users 
      ORDER BY created_at DESC
    `);

    if (usersResult.rows.length === 0) {
      console.log('❌ No users found in auth.users!');
      console.log('');
      console.log('Please create a user first:');
      console.log('1. Go to: https://supabase.com/dashboard/project/yzrwkznkfisfpnwzbwfw/auth/users');
      console.log('2. Click "Add user" → "Create new user"');
      console.log('3. Enter email and password');
      console.log('4. Run this script again');
      console.log('');
      process.exit(1);
    }

    console.log('Found users:');
    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.id})`);
    });
    console.log('');

    let userIndex;
    if (usersResult.rows.length === 1) {
      console.log(`Using: ${usersResult.rows[0].email}`);
      userIndex = 0;
    } else {
      const answer = await question(`Select user (1-${usersResult.rows.length}): `);
      userIndex = parseInt(answer) - 1;
    }

    const selectedUser = usersResult.rows[userIndex];
    console.log('');
    console.log(`✅ Selected: ${selectedUser.email}`);
    console.log('');

    // Step 2: Create tenant
    console.log('📋 Step 2: Creating tenant...');
    console.log('');

    const tenantName = await question('Enter company/tenant name (e.g., "My Company"): ');
    const tenantSlug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const state = await question('Enter state (e.g., "Maharashtra", "Karnataka"): ');
    console.log('');

    const tenantResult = await client.query(`
      INSERT INTO tenants (name, slug, state, gst_enabled)
      VALUES ($1, $2, $3, false)
      RETURNING id, name, slug
    `, [tenantName, tenantSlug, state]);

    const tenant = tenantResult.rows[0];
    console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);
    console.log('');

    // Step 3: Link user to tenant
    console.log('📋 Step 3: Linking user to tenant...');
    console.log('');

    await client.query(`
      INSERT INTO team_members (tenant_id, user_id, email, role)
      VALUES ($1, $2, $3, 'owner')
    `, [tenant.id, selectedUser.id, selectedUser.email]);

    console.log('✅ User linked as owner');
    console.log('');

    // Step 4: Verify
    console.log('📋 Step 4: Verifying setup...');
    console.log('');

    const verifyResult = await client.query(`
      SELECT 
        tm.id,
        tm.role,
        t.name as tenant_name,
        au.email
      FROM team_members tm
      JOIN tenants t ON tm.tenant_id = t.id
      JOIN auth.users au ON tm.user_id = au.id
      WHERE au.id = $1
    `, [selectedUser.id]);

    if (verifyResult.rows.length > 0) {
      const setup = verifyResult.rows[0];
      console.log('✅ Setup verified!');
      console.log('');
      console.log('   User:   ', setup.email);
      console.log('   Tenant: ', setup.tenant_name);
      console.log('   Role:   ', setup.role);
      console.log('');
    }

    // Step 5: Add sample data (optional)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    const addSample = await question('Add sample products? (y/n): ');
    console.log('');

    if (addSample.toLowerCase() === 'y') {
      console.log('Adding sample products...');
      console.log('');

      // Add sample master products
      await client.query(`
        INSERT INTO master_products (name, description, category, base_price)
        VALUES 
          ('Laptop', 'Business laptop', 'Electronics', 50000),
          ('Mouse', 'Wireless mouse', 'Electronics', 500),
          ('Keyboard', 'Mechanical keyboard', 'Electronics', 2000),
          ('Monitor', '24 inch display', 'Electronics', 15000),
          ('Desk Chair', 'Ergonomic office chair', 'Furniture', 8000)
      `);

      // Get master product IDs
      const productsResult = await client.query(`
        SELECT id, name FROM master_products LIMIT 5
      `);

      // Add inventory for this tenant
      for (const product of productsResult.rows) {
        await client.query(`
          INSERT INTO inventory (tenant_id, product_id, quantity, cost_price, selling_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          tenant.id,
          product.id,
          Math.floor(Math.random() * 50) + 10, // Random quantity 10-60
          Math.floor(Math.random() * 5000) + 1000, // Random cost
          Math.floor(Math.random() * 8000) + 2000  // Random selling price
        ]);
      }

      console.log('✅ Added 5 sample products with inventory');
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎉 Setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Visit: https://biz-finetune-store.vercel.app/login');
    console.log(`2. Login with: ${selectedUser.email}`);
    console.log('3. Start managing your inventory!');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === '23505') {
      console.error('');
      console.error('This user is already linked to a tenant.');
      console.error('You can login directly to the app.');
    }
    process.exit(1);
  } finally {
    await client.end();
    rl.close();
  }
}

setup();

