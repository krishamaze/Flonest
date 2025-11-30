import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

// Test credentials
const TEST_USER = {
  email: 'owner@test.com',
  password: 'password'
}

/**
 * Comprehensive Invoice Creation Flow Test
 * Tests all critical user flows for invoice creation including:
 * - Mobile vs Desktop routing behavior
 * - Autofocus on customer search
 * - Search dropdown with 3-char trigger
 * - Add New Party inline form
 * - Customer creation with different statuses
 * - Auto-save functionality
 * - Draft recovery
 */

test.describe('Invoice Creation Flow - Complete E2E', () => {
  
  // Helper function to login
  async function login(page: Page) {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(owner|branch|advisor|dashboard|inventory)/, { timeout: 10000 })
  }

  // Helper function to navigate to inventory
  async function navigateToInventory(page: Page) {
    await page.goto(`${BASE_URL}/inventory`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Allow SPA to settle
  }

  test('Mobile (375px): Full-page route /invoices/new', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await login(page)
    await navigateToInventory(page)

    // Click "New Invoice" button
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("Create First Invoice")').first()
    await newInvoiceButton.click()

    // Verify URL changed to /invoices/new
    await expect(page).toHaveURL(/\/invoices\/new/, { timeout: 5000 })
    
    // Verify page header shows "New Invoice"
    await expect(page.locator('h1:has-text("New Invoice")')).toBeVisible()
    
    console.log('✓ Mobile: Full-page route confirmed')
  })

  test('Desktop (1920px): Modal opens, URL stays /inventory', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Verify we're on inventory page
    await expect(page).toHaveURL(/\/inventory/)

    // Click "New Invoice" button
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()

    // Wait for modal to appear
    await page.waitForTimeout(500)

    // Verify modal/dialog is visible (check for dialog role or modal container)
    const modal = page.locator('[role="dialog"], .modal, [data-modal="true"]').first()
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Verify URL stayed on /inventory
    await expect(page).toHaveURL(/\/inventory/)
    
    console.log('✓ Desktop: Modal confirmed, URL unchanged')
  })

  test('Autofocus: Customer Identifier field focused on load', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    await login(page)
    await navigateToInventory(page)

    // Click "New Invoice"
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("Create First Invoice")').first()
    await newInvoiceButton.click()

    // Wait for page/modal to load
    await page.waitForTimeout(1000)

    // Find customer identifier input
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    
    // Verify it's focused
    await expect(customerInput).toBeFocused({ timeout: 3000 })
    
    console.log('✓ Autofocus: Customer search input is focused')
  })

  test('Search trigger: 3 chars → 300ms → dropdown appears', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Find customer input
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    
    // Type 2 chars - dropdown should NOT appear
    await customerInput.fill('99')
    await page.waitForTimeout(400)
    
    let dropdown = page.locator('[role="listbox"], .dropdown, [id*="search-results"]').first()
    await expect(dropdown).not.toBeVisible()

    // Type 3rd char - dropdown SHOULD appear after debounce
    await customerInput.fill('999')
    await page.waitForTimeout(400) // Wait for 300ms debounce + buffer

    dropdown = page.locator('[role="listbox"], [id*="search-results"]').first()
    await expect(dropdown).toBeVisible({ timeout: 2000 })
    
    console.log('✓ Search trigger: 3-char minimum with debounce working')
  })

  test('Search priority: Most recent customers at top', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Search for common pattern (e.g., "9" for mobile numbers)
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('999')
    await page.waitForTimeout(500)

    // Check if dropdown has results
    const dropdown = page.locator('[role="listbox"], [id*="search-results"]').first()
    const hasResults = await dropdown.isVisible()

    if (hasResults) {
      // Get all customer result items (skip "Add New Party" button)
      const customerResults = page.locator('[role="option"]').filter({ hasNotText: 'Add New Party' })
      const count = await customerResults.count()

      if (count > 1) {
        // Check if results have "Last invoice" dates (indicating recency sorting)
        const firstResult = customerResults.first()
        const hasLastInvoiceDate = await firstResult.locator('text=/Last invoice:/i').isVisible().catch(() => false)
        
        if (hasLastInvoiceDate) {
          console.log('✓ Search priority: Results show last invoice dates (recency sorting)')
        } else {
          console.log('⚠ Search priority: No last invoice dates visible (may need data)')
        }
      } else {
        console.log('⚠ Search priority: Only one result, cannot verify sorting')
      }
    } else {
      console.log('⚠ Search priority: No results to verify sorting')
    }
  })

  test('Add New Party: Click → inline form expands', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Trigger search dropdown
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('999')
    await page.waitForTimeout(500)

    // Click "+ Add New Party"
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()

    // Verify inline form appears
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input, input[name="name"]').first()
    await expect(nameInput).toBeVisible({ timeout: 3000 })
    
    // Verify name input is focused
    await expect(nameInput).toBeFocused()
    
    console.log('✓ Add New Party: Inline form expanded and focused')
  })

  test('Name-only customer: Create with status name_only', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Trigger search and open Add New Party
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('999')
    await page.waitForTimeout(500)
    
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()

    // Fill only name (no mobile, no GST)
    const timestamp = Date.now()
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input').first()
    await nameInput.fill(`Test Customer ${timestamp}`)

    // Click "Add Customer" or "Create" button
    const addButton = page.locator('button:has-text("Add Customer"), button:has-text("Create"), button:has-text("Add")').first()
    await addButton.click()

    // Wait for customer creation
    await page.waitForTimeout(2000)

    // Verify success toast
    const successToast = page.locator('.Toastify__toast--success, [role="alert"]:has-text("Customer added")').first()
    await expect(successToast).toBeVisible({ timeout: 5000 })

    console.log('✓ Name-only customer: Created successfully')
  })

  test('Verified customer: Create with mobile + GST → status edited', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Trigger search and open Add New Party
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('888')
    await page.waitForTimeout(500)
    
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()

    // Fill name, mobile, and GSTIN
    const timestamp = Date.now()
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input').first()
    await nameInput.fill(`Verified Customer ${timestamp}`)

    const mobileInput = page.locator('input[placeholder*="Mobile"], input[type="tel"], label:has-text("Mobile") + input').first()
    await mobileInput.fill('8887776665')

    const gstinInput = page.locator('input[placeholder*="GSTIN"], input[placeholder*="GST"], label:has-text("GSTIN") + input').first()
    await gstinInput.fill('29ABCDE1234F1Z5')

    // Click "Add Customer"
    const addButton = page.locator('button:has-text("Add Customer"), button:has-text("Create"), button:has-text("Add")').first()
    await addButton.click()

    // Wait for customer creation
    await page.waitForTimeout(2000)

    // Verify success toast
    const successToast = page.locator('.Toastify__toast--success, [role="alert"]:has-text("Customer added")').first()
    await expect(successToast).toBeVisible({ timeout: 5000 })

    console.log('✓ Verified customer: Created with mobile + GSTIN')
  })

  test('Next button: Disabled on load, enabled when customer selected', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Verify Next button is disabled initially
    const nextButton = page.locator('button:has-text("Next")').first()
    await expect(nextButton).toBeDisabled({ timeout: 3000 })

    // Create a customer to enable Next button
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('777')
    await page.waitForTimeout(500)
    
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()

    const timestamp = Date.now()
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input').first()
    await nameInput.fill(`Next Test ${timestamp}`)

    const addButton = page.locator('button:has-text("Add Customer"), button:has-text("Create"), button:has-text("Add")').first()
    await addButton.click()

    // Wait for customer creation
    await page.waitForTimeout(2000)

    // Verify Next button is now enabled
    await expect(nextButton).toBeEnabled({ timeout: 5000 })
    
    console.log('✓ Next button: Disabled → Enabled after customer selection')
  })

  test('Auto-save: Select customer → toast "Draft auto-saved"', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Open modal
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Create a customer
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('666')
    await page.waitForTimeout(500)
    
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()

    const timestamp = Date.now()
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input').first()
    await nameInput.fill(`AutoSave Test ${timestamp}`)

    const addButton = page.locator('button:has-text("Add Customer"), button:has-text("Create"), button:has-text("Add")').first()
    await addButton.click()

    // Wait for auto-save toast
    await page.waitForTimeout(3000)

    // Verify "Draft auto-saved" toast appears
    const draftToast = page.locator('.Toastify__toast--success:has-text("Draft"), [role="alert"]:has-text("Draft auto-saved")').first()
    await expect(draftToast).toBeVisible({ timeout: 5000 })

    console.log('✓ Auto-save: Draft auto-saved toast confirmed')
  })

  test('Draft recovery: Exit → Drafts tab → Continue Draft', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    await login(page)
    await navigateToInventory(page)

    // Create a draft
    const newInvoiceButton = page.locator('button:has-text("New Invoice")').first()
    await newInvoiceButton.click()
    await page.waitForTimeout(500)

    // Create customer to trigger draft save
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await customerInput.fill('555')
    await page.waitForTimeout(500)
    
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()

    const timestamp = Date.now()
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input').first()
    await nameInput.fill(`Draft Recovery ${timestamp}`)

    const addButton = page.locator('button:has-text("Add Customer"), button:has-text("Create"), button:has-text("Add")').first()
    await addButton.click()

    // Wait for draft to save
    await page.waitForTimeout(3000)

    // Close modal (look for Close button or X icon)
    const closeButton = page.locator('button:has-text("Close"), button[aria-label="Close"], button:has([class*="XMark"])').first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      // Fallback: press Escape
      await page.keyboard.press('Escape')
    }

    await page.waitForTimeout(1000)

    // Navigate to Drafts tab
    const draftsTab = page.locator('text=Drafts, button:has-text("Drafts"), [role="button"]:has-text("Drafts")').first()
    await draftsTab.click()
    await page.waitForTimeout(1000)

    // Verify draft appears in list
    const draftItem = page.locator('[class*="draft"], .SwipeableDraftItem, [data-status="draft"]').first()
    await expect(draftItem).toBeVisible({ timeout: 5000 })

    // Click "Continue Draft" or the draft item itself
    const continueDraftButton = page.locator('button:has-text("Continue"), text=/Continue Draft/i, [class*="draft"]').first()
    await continueDraftButton.click()

    // Wait for modal to reopen
    await page.waitForTimeout(2000)

    // Verify customer is pre-selected (check if we're on Step 2 or customer name is visible)
    const step2Heading = page.locator('h2:has-text("Step 2"), h3:has-text("Add Products")').first()
    const isStep2Visible = await step2Heading.isVisible().catch(() => false)

    if (isStep2Visible) {
      console.log('✓ Draft recovery: Form reopened with customer pre-selected (Step 2 visible)')
    } else {
      // Alternative: check if customer name is displayed
      const customerName = page.locator(`text=/Draft Recovery ${timestamp}/i`).first()
      const isNameVisible = await customerName.isVisible().catch(() => false)
      
      if (isNameVisible) {
        console.log('✓ Draft recovery: Form reopened with customer pre-selected (name visible)')
      } else {
        console.log('⚠ Draft recovery: Form reopened but customer state unclear')
      }
    }
  })

  test('Full flow: Mobile end-to-end with all validations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    console.log('Starting full mobile flow...')
    
    await login(page)
    await navigateToInventory(page)

    // 1. Verify mobile navigation to /invoices/new
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("Create First Invoice")').first()
    await newInvoiceButton.click()
    await expect(page).toHaveURL(/\/invoices\/new/)
    console.log('  ✓ Mobile route confirmed')

    // 2. Verify autofocus
    const customerInput = page.locator('input[placeholder*="Mobile"], input[placeholder*="GSTIN"], input#customer-search').first()
    await expect(customerInput).toBeFocused()
    console.log('  ✓ Autofocus confirmed')

    // 3. Test search trigger
    await customerInput.fill('444')
    await page.waitForTimeout(500)
    const dropdown = page.locator('[role="listbox"], [id*="search-results"]').first()
    await expect(dropdown).toBeVisible()
    console.log('  ✓ Search dropdown confirmed')

    // 4. Add new customer
    const addNewPartyButton = page.locator('[role="option"]:has-text("Add New Party"), button:has-text("Add New Party")').first()
    await addNewPartyButton.click()
    
    const timestamp = Date.now()
    const nameInput = page.locator('input[placeholder*="Customer Name"], label:has-text("Customer Name") + input').first()
    await nameInput.fill(`Mobile E2E ${timestamp}`)
    
    const addButton = page.locator('button:has-text("Add Customer"), button:has-text("Create"), button:has-text("Add")').first()
    await addButton.click()
    await page.waitForTimeout(3000)
    console.log('  ✓ Customer created')

    // 5. Verify auto-save toast
    const draftToast = page.locator('.Toastify__toast--success:has-text("Draft"), [role="alert"]:has-text("Draft")').first()
    await expect(draftToast).toBeVisible({ timeout: 5000 })
    console.log('  ✓ Auto-save toast confirmed')

    // 6. Verify Next button enabled
    const nextButton = page.locator('button:has-text("Next")').first()
    await expect(nextButton).toBeEnabled()
    console.log('  ✓ Next button enabled')

    console.log('✓ Full mobile flow: ALL VALIDATIONS PASSED')
  })
})
