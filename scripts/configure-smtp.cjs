#!/usr/bin/env node
/**
 * Configure SMTP for Supabase Auth using Management API
 * Reads SUPABASE_ACCESS_TOKEN from .env
 * 
 * Usage:
 *   node scripts/configure-smtp.cjs \
 *     --host smtp.sendgrid.net \
 *     --port 587 \
 *     --user apikey \
 *     --pass YOUR_SMTP_PASSWORD \
 *     --email no-reply@yourdomain.com \
 *     --name "Your App Name"
 * 
 * Or set environment variables:
 *   SMTP_HOST=smtp.sendgrid.net
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASS=your-password
 *   SMTP_EMAIL=no-reply@yourdomain.com
 *   SMTP_SENDER_NAME="Your App Name"
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
  
  return {
    host: cliArgs.host || process.env.SMTP_HOST,
    port: parseInt(cliArgs.port || process.env.SMTP_PORT || '587'),
    user: cliArgs.user || process.env.SMTP_USER,
    pass: cliArgs.pass || process.env.SMTP_PASS,
    email: cliArgs.email || process.env.SMTP_EMAIL,
    name: cliArgs.name || process.env.SMTP_SENDER_NAME || 'Finetune',
  };
}

function checkRequired(config) {
  const missing = [];
  if (!config.host) missing.push('SMTP_HOST (--host)');
  if (!config.user) missing.push('SMTP_USER (--user)');
  if (!config.pass) missing.push('SMTP_PASS (--pass)');
  if (!config.email) missing.push('SMTP_EMAIL (--email)');
  if (!process.env.SUPABASE_ACCESS_TOKEN) missing.push('SUPABASE_ACCESS_TOKEN');
  
  if (missing.length > 0) {
    console.error('❌ Missing required configuration:');
    missing.forEach(m => console.error(`  - ${m}`));
    console.error('\nUsage:');
    console.error('  node scripts/configure-smtp.cjs --host smtp.example.com --port 587 --user username --pass password --email no-reply@example.com --name "App Name"');
    console.error('\nOr set environment variables in .env:');
    console.error('  SMTP_HOST=smtp.example.com');
    console.error('  SMTP_PORT=587');
    console.error('  SMTP_USER=username');
    console.error('  SMTP_PASS=password');
    console.error('  SMTP_EMAIL=no-reply@example.com');
    console.error('  SMTP_SENDER_NAME="App Name"');
    process.exit(1);
  }
}

function configureSMTP(config) {
  return new Promise((resolve, reject) => {
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    
    // Extract email address from config.email (handle "Name <email>" format)
    const emailAddress = config.email.includes('<') 
      ? config.email.match(/<(.+)>/)?.[1] || config.email
      : config.email;
    
    const payload = JSON.stringify({
      external_email_enabled: true,
      mailer_secure_email_change_enabled: true,
      mailer_autoconfirm: false, // Keep email confirmation enabled
      smtp_admin_email: config.email,
      smtp_host: config.host,
      smtp_port: String(config.port), // API expects string, not number
      smtp_user: config.user,
      smtp_pass: config.pass,
      smtp_sender_name: config.name,
      smtp_reply_to: emailAddress, // Match Reply-To to From address for better Gmail trust
    });
    
    const options = {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    
    console.log('📧 Configuring SMTP for Supabase Auth...');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.user}`);
    console.log(`   Email: ${config.email}`);
    console.log(`   Sender: ${config.name}`);
    console.log(`   Reply-To: ${emailAddress} (matches From address for Gmail trust)`);
    
    const req = https.request(MANAGEMENT_API_URL, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ SMTP configured successfully!');
          console.log('\n📝 Next steps:');
          console.log('   1. Test email delivery by signing up a new user');
          console.log('   2. Check Supabase Dashboard → Authentication → Settings to verify SMTP settings');
          console.log('   3. Adjust rate limits if needed: Dashboard → Authentication → Rate Limits');
          resolve(JSON.parse(data || '{}'));
        } else {
          try {
            const error = JSON.parse(data);
            console.error('❌ Failed to configure SMTP:');
            console.error(`   Status: ${res.statusCode}`);
            console.error(`   Error: ${error.message || error.error || data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${error.message || data}`));
          } catch (e) {
            console.error('❌ Failed to configure SMTP:');
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
    
    req.write(payload);
    req.end();
  });
}

async function main() {
  try {
    const config = getConfig();
    checkRequired(config);
    await configureSMTP(config);
  } catch (error) {
    console.error('\n❌ Configuration failed:', error.message);
    process.exit(1);
  }
}

main();

