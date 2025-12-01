import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

// Test credentials
const TEST_USER = {
  email: 'owner@test.com',
  password: 'password'
}

test.describe('Smart Customer Form - Single Flow', () => {
  
  async function login(page: Page) {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(owner|branch|advisor|dashboard|inventory)/, { timeout: 10000 })
  }

  async function openInvoiceForm(page: Page) {
    await page.goto(`${BASE_URL}/invoices/new`)
    await page.waitForLoadState('networkidle')
  }

  test.beforeEach(async ({ page }) => {
    console.log('Navigating to login...')
    await login(page)
    console.log('Login successful, navigating to invoice form...')
    await openInvoiceForm(page)
    console.log('Invoice form opened.')
  })

  test('Mobile Number Search: Prefills Mobile, Locks Field', async ({ page }) => {
    console.log('Starting Mobile Test')
    const mobileNumber = '9876543210'
    
    // Type mobile number
    console.log('Typing mobile number')
    const searchBox = page.getByPlaceholder('Search by Name, Mobile, or GSTIN')
    await searchBox.fill(mobileNumber)
    await page.waitForTimeout(1000) // Wait for debounce and fields to appear

    // Verify Mobile Field
    console.log('Verifying Mobile Field')
    const mobileInput = page.locator('input[type="tel"]')
    await expect(mobileInput).toBeVisible({ timeout: 10000 })
    await expect(mobileInput).toHaveValue(mobileNumber)
    await expect(mobileInput).not.toBeEditable()
    
    // Verify Name Field is editable
    const nameInput = page.locator('input[placeholder="Enter customer name"]')
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeEditable()
  })

  test('GSTIN Search: Prefills GSTIN, Locks Field', async ({ page }) => {
    const gstin = '22AAAAA0000A1Z5'
    
    // Type GSTIN
    const searchBox = page.getByPlaceholder('Search by Name, Mobile, or GSTIN')
    await searchBox.fill(gstin)
    await page.waitForTimeout(1000)

    // Verify GSTIN Field
    const gstinInput = page.locator('input[placeholder="Enter 15-character GSTIN"]')
    await expect(gstinInput).toBeVisible({ timeout: 10000 })
    await expect(gstinInput).toHaveValue(gstin)
    await expect(gstinInput).not.toBeEditable()
  })

  test('Name Search: Prefills Name, Locks Field', async ({ page }) => {
    const name = 'John Doe'
    
    // Type Name
    const searchBox = page.getByPlaceholder('Search by Name, Mobile, or GSTIN')
    await searchBox.fill(name)
    await page.waitForTimeout(1000)

    // Verify Name Field
    const nameInput = page.locator('input[placeholder="Enter customer name"]')
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    await expect(nameInput).toHaveValue(name)
    await expect(nameInput).not.toBeEditable()
    
    // Verify Mobile/GSTIN are empty and editable
    const mobileInput = page.locator('input[type="tel"]')
    await expect(mobileInput).toBeVisible()
    await expect(mobileInput).toHaveValue('')
    await expect(mobileInput).toBeEditable()
  })
})
