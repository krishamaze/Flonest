/**
 * Role Redirect Tests
 * 
 * Tests that users are redirected to their role-specific landing pages
 * after login using real Supabase auth.
 * 
 * Prerequisites:
 * - npm run dev running on localhost:5173
 * - Test users must exist in Supabase Auth
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

const users = [
  { email: 'owner@test.com', expectedPath: '/owner', role: 'org_owner' },
  { email: 'branch@test.com', expectedPath: '/branch', role: 'branch_head' },
  { email: 'advisor@test.com', expectedPath: '/advisor', role: 'advisor' },
  { email: 'agent@test.com', expectedPath: '/agent', role: 'agent' },
  { email: 'internal@test.com', expectedPath: '/platform-admin', role: 'platform_admin' },
]

test.describe('Role-based redirects after login', () => {
  // Clear mock session before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.clear())
  })

  for (const user of users) {
    test(`${user.role}: ${user.email} → ${user.expectedPath}`, async ({ page }) => {
      // Navigate to login page
      await page.goto(`${BASE_URL}/login`)
      
      // Wait for login form to be ready
      await page.waitForSelector('input[type="email"]', { timeout: 10000 })
      
      // Fill in credentials
      await page.fill('input[type="email"]', user.email)
      await page.fill('input[type="password"]', 'password')
      
      // Submit form
      await page.click('button[type="submit"]')
      
      // Wait for redirect to complete
      await page.waitForURL(`**${user.expectedPath}**`, { timeout: 15000 })
      
      // Verify we're on the expected path
      expect(page.url()).toContain(user.expectedPath)
    })
  }
})

test.describe('Protected route access', () => {
  // Clear mock session before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.clear())
  })

  test('Unauthenticated user redirected to login', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => console.log('BROWSER:', msg.text()))

    // Try to access protected route without auth
    await page.goto(`${BASE_URL}/owner`)

    // Wait a bit for React to render
    await page.waitForTimeout(2000)

    // Log current URL
    console.log('Current URL:', page.url())

    // Should redirect to login
    await page.waitForURL('**/login**', { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })
})

