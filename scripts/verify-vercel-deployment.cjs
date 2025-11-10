#!/usr/bin/env node
/**
 * Verify Vercel Deployment
 * Checks deployment status, URL accessibility, and version sync
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const PRODUCTION_URL = 'https://biz-finetune-store.vercel.app';
const PROJECT_NAME = 'biz-finetune-store';

async function checkURLAccessibility(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 10000 }, (res) => {
      resolve({
        accessible: res.statusCode === 200,
        statusCode: res.statusCode,
        headers: res.headers
      });
    }).on('error', (error) => {
      resolve({
        accessible: false,
        error: error.message
      });
    });
  });
}

async function checkVersionSync() {
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.log('⚠️  Supabase credentials not found in .env, skipping version check');
    return null;
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase.rpc('get_current_app_version');

    if (error) {
      console.log('⚠️  Could not check version sync:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.log('⚠️  Version check error:', error.message);
    return null;
  }
}

async function verifyDeployment() {
  console.log('🔍 Verifying Vercel Deployment\n');
  console.log('='.repeat(60));

  // Check URL accessibility
  console.log('\n1. Checking Production URL Accessibility...');
  console.log(`   URL: ${PRODUCTION_URL}`);
  
  const urlCheck = await checkURLAccessibility(PRODUCTION_URL);
  
  if (urlCheck.accessible) {
    console.log(`   ✅ URL is accessible (Status: ${urlCheck.statusCode})`);
    if (urlCheck.headers['x-vercel-id']) {
      console.log(`   ✅ Vercel deployment ID: ${urlCheck.headers['x-vercel-id']}`);
    }
  } else {
    console.log(`   ❌ URL is not accessible`);
    if (urlCheck.error) {
      console.log(`   Error: ${urlCheck.error}`);
    } else {
      console.log(`   Status: ${urlCheck.statusCode}`);
    }
  }

  // Check version sync
  console.log('\n2. Checking Version Sync...');
  const versionInfo = await checkVersionSync();
  
  if (versionInfo) {
    console.log(`   ✅ App Version: ${versionInfo.version}`);
    console.log(`   ✅ Schema Version: ${versionInfo.schema_version || '1.0.0'}`);
    console.log(`   ✅ Release Notes: ${versionInfo.release_notes || 'N/A'}`);
    
    // Check if versions match (from package.json)
    const packageJson = require('../package.json');
    const frontendVersion = packageJson.version;
    
    if (versionInfo.version === frontendVersion) {
      console.log(`   ✅ Frontend and backend versions are in sync (${frontendVersion})`);
    } else {
      console.log(`   ⚠️  Version mismatch: Frontend ${frontendVersion} vs Backend ${versionInfo.version}`);
      console.log(`   ⚠️  This is expected if deployment just completed. GitHub Action should update soon.`);
    }
  } else {
    console.log('   ⚠️  Could not verify version sync (check Supabase credentials)');
  }

  // Check GitHub Actions (if accessible)
  console.log('\n3. Checking GitHub Actions Status...');
  console.log('   ℹ️  Check GitHub Actions manually:');
  console.log('      https://github.com/krishamaze/biz.finetune.store/actions');
  console.log('   ℹ️  Look for "Update Database App Version After Deploy" workflow');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Deployment Verification Summary\n');
  
  if (urlCheck.accessible) {
    console.log('✅ Production URL is accessible');
    console.log(`   Visit: ${PRODUCTION_URL}`);
  } else {
    console.log('❌ Production URL is not accessible');
    console.log('   Check Vercel dashboard for deployment status');
  }

  if (versionInfo) {
    console.log('✅ Version information retrieved');
    console.log(`   App Version: ${versionInfo.version}`);
    console.log(`   Schema Version: ${versionInfo.schema_version || '1.0.0'}`);
  } else {
    console.log('⚠️  Could not verify version information');
  }

  console.log('\n💡 Next Steps:');
  console.log('   1. Visit production URL and test the app');
  console.log('   2. Check GitHub Actions for version update workflow');
  console.log('   3. Verify version sync in browser DevTools');
  console.log('   4. Test schema version tracking (if applicable)');
  console.log('   5. Monitor Vercel Analytics for errors');
  console.log('');
}

verifyDeployment().catch(error => {
  console.error('❌ Verification error:', error);
  process.exit(1);
});

