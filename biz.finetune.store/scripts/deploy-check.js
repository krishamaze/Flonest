#!/usr/bin/env node

/**
 * Pre-deployment validation script
 * Checks if the project is ready for deployment
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function checkFile(path, description) {
  const fullPath = join(projectRoot, path);
  if (existsSync(fullPath)) {
    checks.passed.push(`✓ ${description}`);
    return true;
  } else {
    checks.failed.push(`✗ ${description}`);
    return false;
  }
}

function checkEnvExample() {
  const envExamplePath = join(projectRoot, '.env.example');
  if (existsSync(envExamplePath)) {
    const content = readFileSync(envExamplePath, 'utf-8');
    if (content.includes('VITE_SUPABASE_URL') && content.includes('VITE_SUPABASE_ANON_KEY')) {
      checks.passed.push('✓ .env.example has required variables');
      return true;
    } else {
      checks.failed.push('✗ .env.example missing required variables');
      return false;
    }
  } else {
    checks.failed.push('✗ .env.example not found');
    return false;
  }
}

function checkPackageJson() {
  const packagePath = join(projectRoot, 'package.json');
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    
    // Check scripts
    if (pkg.scripts?.build) {
      checks.passed.push('✓ Build script exists');
    } else {
      checks.failed.push('✗ Build script missing');
    }
    
    // Check dependencies
    const requiredDeps = ['react', 'react-dom', '@supabase/supabase-js', 'react-router-dom'];
    const missingDeps = requiredDeps.filter(dep => !pkg.dependencies?.[dep]);
    
    if (missingDeps.length === 0) {
      checks.passed.push('✓ All required dependencies present');
    } else {
      checks.failed.push(`✗ Missing dependencies: ${missingDeps.join(', ')}`);
    }
    
    return missingDeps.length === 0;
  } else {
    checks.failed.push('✗ package.json not found');
    return false;
  }
}

function checkPWAAssets() {
  const requiredAssets = [
    'public/manifest.webmanifest',
  ];
  
  const optionalAssets = [
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/apple-touch-icon.png',
    'public/favicon.ico'
  ];
  
  requiredAssets.forEach(asset => {
    checkFile(asset, `Required: ${asset}`);
  });
  
  let missingOptional = 0;
  optionalAssets.forEach(asset => {
    const fullPath = join(projectRoot, asset);
    if (!existsSync(fullPath)) {
      missingOptional++;
    }
  });
  
  if (missingOptional > 0) {
    checks.warnings.push(`⚠ ${missingOptional} PWA icon(s) missing - app won't be installable`);
  } else {
    checks.passed.push('✓ All PWA assets present');
  }
}

function checkGitignore() {
  const gitignorePath = join(projectRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (content.includes('.env') && content.includes('node_modules')) {
      checks.passed.push('✓ .gitignore properly configured');
      return true;
    } else {
      checks.warnings.push('⚠ .gitignore may be missing important entries');
      return false;
    }
  } else {
    checks.failed.push('✗ .gitignore not found');
    return false;
  }
}

function checkVercelConfig() {
  const vercelPath = join(projectRoot, 'vercel.json');
  if (existsSync(vercelPath)) {
    const config = JSON.parse(readFileSync(vercelPath, 'utf-8'));
    
    if (config.rewrites && config.rewrites.length > 0) {
      checks.passed.push('✓ Vercel SPA routing configured');
    } else {
      checks.warnings.push('⚠ Vercel rewrites not configured - routing may not work');
    }
    
    if (config.headers && config.headers.length > 0) {
      checks.passed.push('✓ Vercel headers configured');
    } else {
      checks.warnings.push('⚠ Vercel headers not configured');
    }
    
    return true;
  } else {
    checks.failed.push('✗ vercel.json not found');
    return false;
  }
}

// Run all checks
console.log('\n🔍 Running pre-deployment checks...\n');

checkFile('vercel.json', 'Vercel configuration');
checkFile('.vercelignore', 'Vercel ignore file');
checkFile('vite.config.ts', 'Vite configuration');
checkFile('tsconfig.json', 'TypeScript configuration');
checkFile('src/main.tsx', 'Main entry point');
checkFile('src/App.tsx', 'App component');
checkFile('index.html', 'HTML template');
checkEnvExample();
checkPackageJson();
checkPWAAssets();
checkGitignore();
checkVercelConfig();

// Print results
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (checks.passed.length > 0) {
  console.log('✅ PASSED:\n');
  checks.passed.forEach(check => console.log(`  ${check}`));
  console.log('');
}

if (checks.warnings.length > 0) {
  console.log('⚠️  WARNINGS:\n');
  checks.warnings.forEach(check => console.log(`  ${check}`));
  console.log('');
}

if (checks.failed.length > 0) {
  console.log('❌ FAILED:\n');
  checks.failed.forEach(check => console.log(`  ${check}`));
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Summary
const total = checks.passed.length + checks.failed.length + checks.warnings.length;
console.log(`📊 Summary: ${checks.passed.length}/${total - checks.warnings.length} checks passed`);

if (checks.warnings.length > 0) {
  console.log(`⚠️  ${checks.warnings.length} warning(s)`);
}

if (checks.failed.length === 0) {
  console.log('\n✅ Project is ready for deployment!\n');
  console.log('Next steps:');
  console.log('  1. Ensure environment variables are set in Vercel');
  console.log('  2. Run: vercel --prod');
  console.log('  3. Or push to main branch for auto-deployment\n');
  process.exit(0);
} else {
  console.log('\n❌ Please fix the failed checks before deploying.\n');
  process.exit(1);
}

