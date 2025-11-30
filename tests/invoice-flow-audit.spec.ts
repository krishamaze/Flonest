import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3001';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Test credentials from TEST_ACCOUNTS.md
const TEST_USER = {
  email: 'owner@test.com',
  password: 'password'
};

test.describe('Invoice Creation Flow Audit V2', () => {
  test('Complete invoice flow with mobile/desktop checks', async ({ page, isMobile }) => {
    // 1. Login
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(owner|branch|advisor|dashboard|inventory)/);
    
    // Ensure we are on the inventory page
    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');

    // 2. Open Invoice Form
    console.log('Opening invoice form...');
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("Create First Invoice")').first();
    await newInvoiceButton.click();

    // Check URL/Modal based on viewport
    // Note: Playwright's isMobile fixture depends on the project config. 
    // We can also check the viewport size or evaluate User Agent/screen width.
    const viewportSize = page.viewportSize();
    const isMobileViewport = (viewportSize?.width || 1280) < 768;

    if (isMobileViewport) {
        console.log('Mobile view detected');
        await expect(page).toHaveURL(/.*\/invoices\/new/);
    } else {
        console.log('Desktop view detected');
        // Expect URL to stay on inventory but modal to appear
        // await expect(page).toHaveURL(/.*\/inventory/); // URL might not change or might use query params
        await expect(page.locator('[role="dialog"]')).toBeVisible();
    }

    // 3. Test Autofocus
    console.log('Testing autofocus...');
    const customerInput = page.locator('input[placeholder*="Enter Mobile No"]');
    await expect(customerInput).toBeVisible();
    await expect(customerInput).toBeFocused();

    // 4. Test "Next" Button State (Should be disabled initially)
    console.log('Testing Next button state...');
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();

    // 5. Test Search Dropdown
    console.log('Testing search dropdown...');
    // Type 3 chars to trigger search
    await customerInput.fill('999'); 
    await page.waitForTimeout(500); // Wait for debounce
    const dropdown = page.locator('[role="listbox"]');
    await expect(dropdown).toBeVisible();

    // 6. Test "+ Add New Party"
    console.log('Testing Add New Party...');
    const addNewPartyButton = page.locator('button:has-text("+ Add New Party")');
    await expect(addNewPartyButton).toBeVisible();
    await addNewPartyButton.click();

    // Verify inline form expands
    const nameInput = page.locator('input[placeholder="Enter customer name"]');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toBeFocused();

    // 7. Create New Customer & Test Auto-save
    console.log('Creating new customer...');
    await nameInput.fill('Test Customer ' + Date.now());
    await page.locator('input[placeholder="Enter 10-digit mobile number"]').fill('9998887776'); // Example mobile
    
    // Click "Add Customer"
    const addCustomerButton = page.locator('button:has-text("Add Customer")');
    await addCustomerButton.click();

    // Verify success toast/notification
    await expect(page.locator('text=Customer added successfully')).toBeVisible();
    
    // Verify "Draft auto-saved" toast
    await expect(page.locator('text=Draft auto-saved')).toBeVisible();

    // 8. Verify Next button is enabled
    await expect(nextButton).toBeEnabled();

    // 9. Verify we moved to Step 2 (Product Selection)
    // Looking for product search or "Step 2" text
    await expect(page.locator('text=Step 2: Add Products')).toBeVisible();
    
    // 10. Check Draft in Invoices Table (need to close form first)
    // If mobile, navigate back. If desktop, close modal.
    if (isMobileViewport) {
        await page.goto(`${BASE_URL}/inventory`);
    } else {
        // Click cancel or close
        const cancelButton = page.locator('button:has-text("Cancel")');
        // On step 2, Cancel button might not be "Cancel" but "Previous" is there. 
        // InvoiceForm has "Cancel" on Step 3, or a header close button.
        // Let's use the close button in the header if available, or just reload page.
        const closeButton = page.locator('button[aria-label="Close"]');
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else {
            // Reload to close modal
            await page.reload();
        }
    }

    // Verify Draft appears in list
    // Switch to "Drafts" filter
    await page.click('text=Drafts');
    // Expect at least one draft
    await expect(page.locator('text=Draft #')).toBeVisible();
    
  });
});
