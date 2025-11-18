#!/usr/bin/env node

/**
 * Generate TypeScript types from Supabase schema
 * Wrapper script to handle output properly and avoid .env parsing issues
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const outputPath = path.join(__dirname, '..', 'src', 'types', 'database.ts')
const envPath = path.join(__dirname, '..', '.env')
const envBackupPath = path.join(__dirname, '..', '.env.backup')

try {
  console.log('Generating TypeScript types from Supabase...')
  
  // Workaround: Temporarily rename .env to avoid parsing issues
  // Supabase CLI automatically reads .env and fails on malformed entries
  let envRenamed = false
  if (fs.existsSync(envPath)) {
    try {
      fs.renameSync(envPath, envBackupPath)
      envRenamed = true
      console.log('Temporarily renamed .env to avoid parsing issues...')
    } catch (renameError) {
      console.warn('Could not rename .env file, continuing anyway...')
    }
  }
  
  try {
    // Generate types and capture output
    const types = execSync('npx supabase gen types typescript --linked', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: path.join(__dirname, '..'),
    })
    
    // Write to file
    fs.writeFileSync(outputPath, types, 'utf-8')
    
    console.log(`✓ Types generated successfully: ${outputPath}`)
  } finally {
    // Restore .env file
    if (envRenamed && fs.existsSync(envBackupPath)) {
      try {
        fs.renameSync(envBackupPath, envPath)
        console.log('Restored .env file')
      } catch (restoreError) {
        console.error('Warning: Could not restore .env file:', restoreError.message)
      }
    }
  }
} catch (error) {
  console.error('Error generating types:', error.message)
  if (error.stdout) console.error('STDOUT:', error.stdout)
  if (error.stderr) console.error('STDERR:', error.stderr)
  
  // Ensure .env is restored even on error
  if (fs.existsSync(envBackupPath)) {
    try {
      fs.renameSync(envBackupPath, envPath)
    } catch (restoreError) {
      // Ignore restore errors on cleanup
    }
  }
  
  process.exit(1)
}

