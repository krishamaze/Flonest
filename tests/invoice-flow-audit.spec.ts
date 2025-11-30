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
  test('Complete invoice flow with mobile/desktop checks', async ({ page }) => {
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
    const viewportSize = page.viewportSize();
    const isMobileViewport = (viewportSize?.width || 1280) < 768;

    if (isMobileViewport) {
        console.log('Mobile view detected');
        await expect(page).toHaveURL(/.*\/invoices\/new/);
    } else {
        console.log('Desktop view detected');
        // Use accessible name for dialog
        await expect(page.getByRole('dialog', { name: 'Create Invoice' })).toBeVisible();
    }

    // 3. Test Autofocus
    console.log('Testing autofocus...');
    const customerInput = page.getByRole('textbox', { name: /customer identifier/i });
    // Or closer match if label is different
    // const customerInput = page.locator('input[placeholder*="Enter Mobile No"]');
    await expect(customerInput).toBeVisible();
    await expect(customerInput).toBeFocused();

    // 4. Test "Next" Button State (Should be disabled initially)
    console.log('Testing Next button state...');
    const nextButton = page.getByRole('button', { name: 'Next' });
    await expect(nextButton).toBeDisabled();

    // 5. Test Search Dropdown
    console.log('Testing search dropdown...');
    // Type 3 chars to trigger search
    await customerInput.fill('999'); 
    await page.waitForTimeout(500); // Wait for debounce
    const dropdown = page.getByRole('listbox');
    await expect(dropdown).toBeVisible();

    // 6. Test "+ Add New Party"
    console.log('Testing Add New Party...');
    const addNewPartyButton = page.getByRole('option', { name: '+ Add New Party' });
    await expect(addNewPartyButton).toBeVisible();
    await addNewPartyButton.click();

    // Verify inline form expands
    const nameInput = page.getByRole('textbox', { name: /customer name/i });
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toBeFocused();

    // 7. Create New Customer & Test Auto-save
    console.log('Creating new customer...');
    await nameInput.fill('Test Customer ' + Date.now());
    await page.getByRole('textbox', { name: /mobile number/i }).fill('9998887776'); // Example mobile
    
    // Click "Add Customer"
    const addCustomerButton = page.getByRole('button', { name: 'Add Customer' });
    await addCustomerButton.click();

    // Wait for the customer creation to complete by waiting for step 2 to be visible
    // "Step 2: Add Products" is an h3
    try {
        await expect(page.getByRole('heading', { name: 'Step 2: Add Products' })).toBeVisible({ timeout: 10000 });
    } catch (e) {
        console.log('Step 2 not found. Dumping page text:');
        console.log(await page.locator('body').innerText());
        throw e;
    }

    // After confirming step 2 is visible, check for the toasts
    // Using simple text match for toasts as class names might be unstable or specific to Toastify
    // But attempting to use the user requested selector structure if possible
    await expect(page.locator('.Toastify__toast--success')).toContainText('Customer added successfully');
    await expect(page.locator('.Toastify__toast--success')).toContainText('Draft auto-saved');

    // 8. Verify Next button is enabled (Wait, on Step 2 Next might be for moving to Step 3)
    // On step 2, "Next" button moves to step 3. 
    // We should check if we can proceed. The test logic said "Verify Next button is enabled"
    // But we are already on Step 2.
    // Let's verify we CAN see products search.
    await expect(page.getByRole('combobox', { name: /search \/ select product/i })).toBeVisible();

    // 10. Check Draft in Invoices Table (need to close form first)
    if (isMobileViewport) {
        await page.goto(`${BASE_URL}/inventory`);
    } else {
        // Close modal
        // Look for close button in header usually
        const closeButton = page.getByRole('button', { name: 'Close' });
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else {
            // Fallback: click Cancel if available (Step 3 has Cancel, Step 2 has Previous/Next)
            // Or just reload
            await page.reload();
        }
    }

    // Verify Draft appears in list
    // Switch to "Drafts" filter
    // Use accessible text click
    await page.getByText('Drafts').click();
    // Expect at least one draft (checking for "Draft" status badge or text)
    // We can look for the status badge "draft"
    await expect(page.locator('text=draft').first()).toBeVisible();
    
  });
});
