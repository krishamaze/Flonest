#!/usr/bin/env node
/**
 * Database Push Script
 * Pushes migrations using DATABASE_URL directly, bypassing CLI link/pooler issues
 */

const { execSync } = require('child_process');
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

function pushMigrations() {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error('❌ DATABASE_URL not found in .env or .env.local');
        process.exit(1);
    }

    console.log('🚀 Pushing migrations using DATABASE_URL...');
    console.log('📡 This bypasses the CLI link and uses the direct connection string.');

    try {
        // Use --db-url to connect directly
        execSync(`npx supabase db push --db-url "${dbUrl}"`, {
            stdio: 'inherit',
            cwd: process.cwd(),
        });
        console.log('\n✅ Migrations pushed successfully!');
    } catch (error) {
        console.error('\n❌ Failed to push migrations.');
        process.exit(1);
    }
}

pushMigrations();
