#!/usr/bin/env node

/**
 * Safety guard for database reset command
 * Prevents accidental cloud database resets by requiring project ref confirmation
 * 
 * Usage: node scripts/guard-db-reset.js
 * 
 * Note: This is a standalone guard script. For npm scripts, consider using
 * environment variable checks or interactive prompts in your workflow.
 */

import { createInterface } from 'readline';

const EXPECTED_PROJECT_REF = 'yzrwkznkfisfpnwzbwfw';
const PROJECT_NAME = 'bizfintunestore';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('');
  console.log('⚠️  WARNING: Database Reset');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('This will RESET your cloud database to the state defined by');
  console.log('your migrations. All data will be lost!');
  console.log('');
  console.log(`Project: ${PROJECT_NAME}`);
  console.log(`Project Ref: ${EXPECTED_PROJECT_REF}`);
  console.log('');
  console.log('⚠️  This action cannot be undone!');
  console.log('');
  console.log('To confirm, type the project ref below:');
  console.log('');

  const answer = await question('Project ref: ');
  rl.close();

  if (answer.trim() !== EXPECTED_PROJECT_REF) {
    console.log('');
    console.log('❌ Confirmation failed. Project ref does not match.');
    console.log('   Database reset cancelled.');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('✅ Confirmation received. Proceeding with database reset...');
  console.log('');
  console.log('Run: npm run supabase:db:reset');
  console.log('');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});

