#!/usr/bin/env node
/**
 * Configure Redirect URLs for Supabase Auth using Management API
 * Reads SUPABASE_ACCESS_TOKEN from .env
 * 
 * Usage:
 *   node scripts/configure-redirect-urls.cjs \
 *     --site-url https://biz-finetune-store.vercel.app \
 *     --redirect-urls "https://biz-finetune-store.vercel.app/reset-password,http://localhost:3000/reset-password"
 * 
 * Or set environment variables:
 *   SITE_URL=https://biz-finetune-store.vercel.app
 *   REDIRECT_URLS="https://biz-finetune-store.vercel.app/reset-password,http://localhost:3000/reset-password"
 */

require('dotenv').config();
const https = require('https');

const PROJECT_REF = 'yzrwkznkfisfpnwzbwfw';
const MANAGEMENT_API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      config[key] = value;
    }
  }
  
  return config;
}

function getConfig() {
  const cliArgs = parseArgs();
  
  const siteUrl = cliArgs['site-url'] || cliArgs.siteUrl || process.env.SITE_URL;
  const redirectUrlsStr = cliArgs['redirect-urls'] || cliArgs.redirectUrls || process.env.REDIRECT_URLS;
  
  // Parse redirect URLs (comma-separated or newline-separated)
  const redirectUrls = redirectUrlsStr 
    ? redirectUrlsStr.split(/[,\n]/).map(url => url.trim()).filter(url => url)
    : [];
  
  return {
    siteUrl,
    redirectUrls,
  };
}

function checkRequired(config) {
  const missing = [];
  if (!process.env.SUPABASE_ACCESS_TOKEN) missing.push('SUPABASE_ACCESS_TOKEN');
  
  if (missing.length > 0) {
    console.error('❌ Missing required configuration:');
    missing.forEach(m => console.error(`  - ${m}`));
    console.error('\nUsage:');
    console.error('  node scripts/configure-redirect-urls.cjs --site-url https://example.com --redirect-urls "https://example.com/reset-password,http://localhost:3000/reset-password"');
    console.error('\nOr set environment variables in .env:');
    console.error('  SITE_URL=https://example.com');
    console.error('  REDIRECT_URLS="https://example.com/reset-password,http://localhost:3000/reset-password"');
    process.exit(1);
  }
}

function configureRedirectUrls(config) {
  return new Promise((resolve, reject) => {
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    
    // Build payload - only include fields that are provided
    const payload = {};
    
    if (config.siteUrl) {
      payload.site_url = config.siteUrl;
    }
    
    if (config.redirectUrls && config.redirectUrls.length > 0) {
      // Management API expects additional_redirect_urls as an array
      payload.additional_redirect_urls = config.redirectUrls;
    }
    
    const payloadStr = JSON.stringify(payload);
    
    const options = {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr),
      },
    };
    
    console.log('🔗 Configuring Redirect URLs for Supabase Auth...');
    if (config.siteUrl) {
      console.log(`   Site URL: ${config.siteUrl}`);
    }
    if (config.redirectUrls && config.redirectUrls.length > 0) {
      console.log(`   Additional Redirect URLs:`);
      config.redirectUrls.forEach(url => console.log(`     - ${url}`));
    }
    
    const req = https.request(MANAGEMENT_API_URL, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Redirect URLs configured successfully!');
          console.log('\n📝 Next steps:');
          console.log('   1. Test password reset flow in production');
          console.log('   2. Verify redirect works: https://biz-finetune-store.vercel.app/reset-password');
          console.log('   3. Check Supabase Dashboard → Authentication → URL Configuration to verify');
          resolve(JSON.parse(data || '{}'));
        } else {
          try {
            const error = JSON.parse(data);
            console.error('❌ Failed to configure redirect URLs:');
            console.error(`   Status: ${res.statusCode}`);
            console.error(`   Error: ${error.message || error.error || data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${error.message || data}`));
          } catch (e) {
            console.error('❌ Failed to configure redirect URLs:');
            console.error(`   Status: ${res.statusCode}`);
            console.error(`   Response: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Network error:', error.message);
      reject(error);
    });
    
    req.write(payloadStr);
    req.end();
  });
}

async function main() {
  try {
    const config = getConfig();
    checkRequired(config);
    
    if (!config.siteUrl && (!config.redirectUrls || config.redirectUrls.length === 0)) {
      console.error('❌ At least one of --site-url or --redirect-urls must be provided');
      process.exit(1);
    }
    
    await configureRedirectUrls(config);
  } catch (error) {
    console.error('\n❌ Configuration failed:', error.message);
    process.exit(1);
  }
}

main();

