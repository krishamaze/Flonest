import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

// Test credentials
const TEST_USER = {
  email: 'owner@test.com',
  password: 'password'
}

test.describe('Smart Customer Form - Dynamic Field Ordering', () => {
  
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

  test('Mobile Number Search: Prefills Mobile, Sets Mobile First & Mandatory', async ({ page }) => {
    console.log('Starting Mobile Test')
    const mobileNumber = '9876543210'
    
    // Type mobile number
    console.log('Typing mobile number')
    const searchInput = page.locator('#customer-search')
    await searchInput.fill(mobileNumber)
    await page.waitForTimeout(500) // Wait for debounce

    // Click Add New Party
    console.log('Clicking Add New Party')
    const addNewButton = page.locator('button:has-text("+ Add New Party")')
    await addNewButton.click()

    // Verify Mobile Field
    console.log('Verifying Mobile Field')
    const mobileInput = page.locator('input[type="tel"]')
    await expect(mobileInput).toHaveValue(mobileNumber)
    
    // Verify Order (Mobile should be first input in the form group)
    // We can check the order by getting all inputs in the form container
    // The container has class "mt-md space-y-md p-md border border-neutral-200 rounded-md bg-neutral-50"
    // But we can just look for inputs inside the form area
    const formArea = page.locator('.mt-md.space-y-md')
    const inputs = formArea.locator('input')
    const firstInput = inputs.nth(0)
    await expect(firstInput).toHaveAttribute('type', 'tel')

    // Verify Mandatory Label
    const mobileLabel = page.locator('label:has-text("Mobile Number *")')
    await expect(mobileLabel).toBeVisible()
  })

  test('GSTIN Search: Prefills GSTIN, Sets GSTIN First & Mandatory', async ({ page }) => {
    const gstin = '22AAAAA0000A1Z5'
    
    // Type GSTIN
    const searchInput = page.locator('#customer-search')
    await searchInput.fill(gstin)
    await page.waitForTimeout(500)

    // Click Add New Party
    const addNewButton = page.locator('button:has-text("+ Add New Party")')
    await addNewButton.click()

    // Verify GSTIN Field
    const gstinInput = page.locator('input[placeholder*="GSTIN"]')
    await expect(gstinInput).toHaveValue(gstin)
    
    // Verify Order (GSTIN should be first)
    const formArea = page.locator('.mt-md.space-y-md')
    const inputs = formArea.locator('input')
    const firstInput = inputs.nth(0)
    // GSTIN input usually has type text, but we can check placeholder or label
    const firstInputPlaceholder = await firstInput.getAttribute('placeholder')
    expect(firstInputPlaceholder).toContain('GSTIN')

    // Verify Mandatory Label
    const gstinLabel = page.locator('label:has-text("GSTIN *")')
    await expect(gstinLabel).toBeVisible()
  })

  test('Partial GSTIN Search: Prefills GSTIN, Sets GSTIN First & Mandatory', async ({ page }) => {
    const partialGstin = '22AAAAA'
    
    // Type Partial GSTIN
    const searchInput = page.locator('#customer-search')
    await searchInput.fill(partialGstin)
    await page.waitForTimeout(500)

    // Click Add New Party
    const addNewButton = page.locator('button:has-text("+ Add New Party")')
    await addNewButton.click()

    // Verify GSTIN Field
    const gstinInput = page.locator('input[placeholder*="GSTIN"]')
    await expect(gstinInput).toHaveValue(partialGstin)
    
    // Verify Order (GSTIN should be first)
    const formArea = page.locator('.mt-md.space-y-md')
    const inputs = formArea.locator('input')
    const firstInput = inputs.nth(0)
    const firstInputPlaceholder = await firstInput.getAttribute('placeholder')
    expect(firstInputPlaceholder).toContain('GSTIN')

    // Verify Mandatory Label
    const gstinLabel = page.locator('label:has-text("GSTIN *")')
    await expect(gstinLabel).toBeVisible()
  })

  test('Name Search: Prefills Name, Sets Name First', async ({ page }) => {
    const name = 'John Doe'
    
    // Type Name
    const searchInput = page.locator('#customer-search')
    await searchInput.fill(name)
    await page.waitForTimeout(500)

    // Click Add New Party
    const addNewButton = page.locator('button:has-text("+ Add New Party")')
    await addNewButton.click()

    // Verify Name Field
    const nameInput = page.locator('input[placeholder*="Customer Name"]')
    await expect(nameInput).toHaveValue(name)
    
    // Verify Order (Name should be first)
    const formArea = page.locator('.mt-md.space-y-md')
    const inputs = formArea.locator('input')
    const firstInput = inputs.nth(0)
    const firstInputPlaceholder = await firstInput.getAttribute('placeholder')
    expect(firstInputPlaceholder).toContain('name')

    // Verify Mobile/GSTIN are Optional
    const mobileLabel = page.locator('label:has-text("Mobile Number (optional)")')
    await expect(mobileLabel).toBeVisible()
    
    const gstinLabel = page.locator('label:has-text("GSTIN (optional)")')
    await expect(gstinLabel).toBeVisible()
  })
})
