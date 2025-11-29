import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Test credentials from TEST_ACCOUNTS.md
const TEST_USER = {
  email: 'owner@test.com',
  password: 'password'
};

// Audit results storage
interface AuditResults {
  urlPath: string;
  clickPath: string[];
  formFields: {
    total: number;
    inputs: number;
    selects: number;
    textareas: number;
    fields: Array<{ type: string; name: string; label: string; placeholder: string }>;
  };
  steps: Array<{ name: string; visible: boolean; screenshot: string }>;
  mobileUX: {
    bottomNavCovering: boolean;
    thumbReachable: boolean;
    textReadable: boolean;
    tapTargets44px: boolean;
    issues: string[];
  };
  consoleErrors: string[];
  networkErrors: string[];
  screenshots: string[];
  timing: {
    loginToForm: number;
    formLoadTime: number;
  };
}

test.describe('Invoice Creation Flow Audit V2', () => {
  test('Deep dive invoice flow audit with proper waits', async ({ page }) => {
    const auditResults: AuditResults = {
      urlPath: '',
      clickPath: [],
      formFields: { total: 0, inputs: 0, selects: 0, textareas: 0, fields: [] },
      steps: [],
      mobileUX: {
        bottomNavCovering: false,
        thumbReachable: true,
        textReadable: true,
        tapTargets44px: true,
        issues: []
      },
      consoleErrors: [],
      networkErrors: [],
      screenshots: [],
      timing: { loginToForm: 0, formLoadTime: 0 }
    };

    // Set up console error logging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        console.log(`[CONSOLE ERROR] ${errorText}`);
        auditResults.consoleErrors.push(errorText);
      }
    });

    // Set up network error logging
    page.on('requestfailed', (request) => {
      const errorText = `${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`;
      console.log(`[NETWORK ERROR] ${errorText}`);
      auditResults.networkErrors.push(errorText);
    });

    const startTime = Date.now();

    // ===== STEP 1: Navigate to login page =====
    console.log('\n=== STEP 1: Navigating to login page ===');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for SPA to render
    auditResults.clickPath.push('Navigate to /login');
    
    // Verify login page loaded
    const loginFormVisible = await page.locator('input[type="email"]').isVisible({ timeout: 5000 });
    console.log(`✓ Login form visible: ${loginFormVisible}`);
    
    const loginScreenshot = path.join(SCREENSHOTS_DIR, '01-login-page.png');
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    auditResults.screenshots.push(loginScreenshot);
    console.log(`✓ Screenshot: ${loginScreenshot}`);

    // ===== STEP 2: Login =====
    console.log('\n=== STEP 2: Logging in ===');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    auditResults.clickPath.push(`Fill login credentials (${TEST_USER.email})`);
    
    // Click login and wait for navigation
    await Promise.all([
      page.waitForURL(/\/(owner|branch|advisor|dashboard|inventory)/, { timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);
    auditResults.clickPath.push('Click "Sign In" button');
    
    // Wait for dashboard content to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for SPA to render
    
    // Wait for dashboard content (look for common dashboard elements)
    const dashboardLoaded = await page.locator('h1, [role="main"], main').first().isVisible({ timeout: 10000 });
    console.log(`✓ Dashboard loaded: ${dashboardLoaded}, URL: ${page.url()}`);

    const afterLoginScreenshot = path.join(SCREENSHOTS_DIR, '02-after-login.png');
    await page.screenshot({ path: afterLoginScreenshot, fullPage: true });
    auditResults.screenshots.push(afterLoginScreenshot);
    console.log(`✓ Screenshot: ${afterLoginScreenshot}`);

    // ===== STEP 3: Navigate to Inventory page =====
    console.log('\n=== STEP 3: Navigating to Inventory/Invoices page ===');
    
    // Try to find inventory/invoice link
    const navLinks = [
      'a[href="/inventory"]',
      'nav a:has-text("Invoices")',
      'nav a:has-text("Inventory")'
    ];
    
    let navigatedViaLink = false;
    for (const selector of navLinks) {
      const link = page.locator(selector).first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        auditResults.clickPath.push(`Click "${await link.textContent()}" in navigation`);
        navigatedViaLink = true;
        break;
      }
    }
    
    if (!navigatedViaLink) {
      await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });
      auditResults.clickPath.push('Navigate directly to /inventory');
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for SPA to render
    await page.waitForURL('**/inventory', { timeout: 10000 });
    auditResults.urlPath = '/inventory';
    console.log(`✓ Inventory page loaded: ${page.url()}`);

    const inventoryScreenshot = path.join(SCREENSHOTS_DIR, '03-inventory-page.png');
    await page.screenshot({ path: inventoryScreenshot, fullPage: true });
    auditResults.screenshots.push(inventoryScreenshot);
    console.log(`✓ Screenshot: ${inventoryScreenshot}`);

    // ===== STEP 4: Open invoice creation form =====
    console.log('\n=== STEP 4: Opening invoice creation form ===');
    const formOpenStart = Date.now();
    
    // Look for "New Invoice" button
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("Create First Invoice")').first();
    await newInvoiceButton.waitFor({ state: 'visible', timeout: 5000 });
    
    const buttonText = await newInvoiceButton.textContent();
    console.log(`✓ Found button: "${buttonText}"`);
    
    await newInvoiceButton.click();
    auditResults.clickPath.push(`Click "${buttonText}" button`);
    
    // Wait for form/dialog to appear
    await page.waitForSelector('form, [role="dialog"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for form to fully render
    
    const formLoadTime = Date.now() - formOpenStart;
    auditResults.timing.formLoadTime = formLoadTime;
    auditResults.timing.loginToForm = Date.now() - startTime;
    console.log(`✓ Invoice form opened (${formLoadTime}ms)`);

    // ===== STEP 5: Analyze invoice form structure =====
    console.log('\n=== STEP 5: Analyzing invoice form structure ===');
    
    // Check for multi-step form
    const stepIndicators = await page.locator('[data-step], .step, [class*="step-"]').count();
    console.log(`Step indicators found: ${stepIndicators}`);
    
    // Capture current step
    const currentStep = await page.locator('[data-step], .step.active, [class*="step-"][class*="active"]').first().textContent().catch(() => 'Unknown');
    console.log(`Current step: ${currentStep}`);

    // ===== STEP 6: Desktop form screenshot and field counting =====
    console.log('\n=== STEP 6: Desktop view analysis ===');
    
    const desktopScreenshot = path.join(SCREENSHOTS_DIR, '04-invoice-form-desktop.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: true });
    auditResults.screenshots.push(desktopScreenshot);
    console.log(`✓ Screenshot: ${desktopScreenshot}`);

    // Count all form fields
    const allInputs = await page.locator('input:visible').all();
    const allSelects = await page.locator('select:visible').all();
    const allTextareas = await page.locator('textarea:visible').all();
    
    auditResults.formFields.inputs = allInputs.length;
    auditResults.formFields.selects = allSelects.length;
    auditResults.formFields.textareas = allTextareas.length;
    auditResults.formFields.total = allInputs.length + allSelects.length + allTextareas.length;
    
    console.log(`✓ Form fields: ${auditResults.formFields.total} total`);
    console.log(`  - Inputs: ${auditResults.formFields.inputs}`);
    console.log(`  - Selects: ${auditResults.formFields.selects}`);
    console.log(`  - Textareas: ${auditResults.formFields.textareas}`);

    // Capture field details
    console.log('\n=== Field Details ===');
    const allFields = [...allInputs, ...allSelects, ...allTextareas];
    
    for (const field of allFields) {
      const tagName = await field.evaluate(el => el.tagName.toLowerCase());
      const type = await field.getAttribute('type') || 'text';
      const name = await field.getAttribute('name') || await field.getAttribute('id') || 'unnamed';
      const placeholder = await field.getAttribute('placeholder') || '';
      const ariaLabel = await field.getAttribute('aria-label') || '';
      
      // Try to find associated label
      const labelText = await field.evaluate((el) => {
        const id = el.getAttribute('id');
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return label.textContent?.trim() || '';
        }
        const parentLabel = el.closest('label');
        if (parentLabel) return parentLabel.textContent?.trim() || '';
        return '';
      });
      
      const fieldInfo = {
        type: `${tagName}${type !== 'text' ? `:${type}` : ''}`,
        name,
        label: labelText || ariaLabel,
        placeholder
      };
      
      auditResults.formFields.fields.push(fieldInfo);
      console.log(`  - ${fieldInfo.type} "${fieldInfo.name}": ${fieldInfo.label || fieldInfo.placeholder || 'No label'}`);
    }

    // Check for duplicate customer sections
    const customerHeaders = await page.locator('text=/customer/i').count();
    if (customerHeaders > 1) {
      console.log(`⚠️  WARNING: Found ${customerHeaders} customer-related sections (possible duplicate)`);
    }

    // ===== STEP 7: Mobile view analysis =====
    console.log('\n=== STEP 7: Mobile UX audit (375px) ===');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1500); // Wait for responsive layout
    
    const mobileScreenshot = path.join(SCREENSHOTS_DIR, '05-invoice-form-mobile.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    auditResults.screenshots.push(mobileScreenshot);
    console.log(`✓ Screenshot: ${mobileScreenshot}`);

    // Check bottom navigation
    const bottomNav = page.locator('nav[class*="bottom"], [class*="bottom-nav"], footer nav');
    const hasBottomNav = await bottomNav.isVisible().catch(() => false);
    if (hasBottomNav) {
      const navHeight = await bottomNav.boundingBox().then(box => box?.height || 0);
      console.log(`  Bottom nav height: ${navHeight}px`);
      
      // Check if content is obscured
      const viewportHeight = 667;
      const lastButton = page.locator('button').last();
      const buttonBox = await lastButton.boundingBox().catch(() => null);
      if (buttonBox && buttonBox.y + buttonBox.height > viewportHeight - navHeight) {
        auditResults.mobileUX.bottomNavCovering = true;
        auditResults.mobileUX.issues.push('Bottom navigation may obscure content');
        console.log('⚠️  Bottom nav may cover content');
      }
    }

    // Check tap target sizes
    const buttons = await page.locator('button:visible').all();
    let smallTargets = 0;
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box && (box.width < 44 || box.height < 44)) {
        smallTargets++;
      }
    }
    
    if (smallTargets > 0) {
      auditResults.mobileUX.tapTargets44px = false;
      auditResults.mobileUX.issues.push(`${smallTargets} buttons smaller than 44px tap target`);
      console.log(`⚠️  ${smallTargets} buttons below 44px minimum tap target`);
    } else {
      console.log('✓ All tap targets >= 44px');
    }

    // Check text readability (font size)
    const textElements = await page.locator('p, span, div').all();
    let smallText = 0;
    for (let i = 0; i < Math.min(textElements.length, 20); i++) {
      const fontSize = await textElements[i].evaluate(el => 
        parseFloat(window.getComputedStyle(el).fontSize)
      );
      if (fontSize < 14) {
        smallText++;
      }
    }
    
    if (smallText > 5) {
      auditResults.mobileUX.textReadable = false;
      auditResults.mobileUX.issues.push('Some text may be too small to read on mobile');
      console.log('⚠️  Some text elements below 14px');
    } else {
      console.log('✓ Text appears readable');
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // ===== STEP 8: Test empty form validation =====
    console.log('\n=== STEP 8: Testing form validation ===');
    
    const submitButton = page.locator('button[type="submit"], button:has-text("Create Invoice"), button:has-text("Submit")').first();
    
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitButton.click();
      auditResults.clickPath.push('Click submit (empty form)');
      await page.waitForTimeout(1500);
      
      const validationScreenshot = path.join(SCREENSHOTS_DIR, '06-validation-errors.png');
      await page.screenshot({ path: validationScreenshot, fullPage: true });
      auditResults.screenshots.push(validationScreenshot);
      console.log(`✓ Screenshot: ${validationScreenshot}`);
      
      // Look for validation messages
      const errorSelectors = [
        '[class*="error"]',
        '[role="alert"]',
        '.text-error',
        '.text-red',
        '[class*="invalid"]',
        '[aria-invalid="true"]'
      ];
      
      try {
        const errors = await page.locator(errorSelectors.join(', ')).allTextContents();
        const visibleErrors = errors.filter(e => e.trim().length > 0);
        console.log(`✓ Validation errors found: ${visibleErrors.length}`);
        visibleErrors.forEach(err => console.log(`  - ${err}`));
      } catch (err) {
        console.log('⚠️  Could not capture validation errors');
      }
    }

    // ===== GENERATE REPORT =====
    console.log('\n' + '='.repeat(80));
    console.log('INVOICE CREATION FLOW AUDIT REPORT V2');
    console.log('='.repeat(80));
    
    console.log(`\n📍 URL Path: ${auditResults.urlPath}`);
    console.log(`\n🔗 Click Path (${auditResults.clickPath.length} steps):`);
    auditResults.clickPath.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
    
    console.log(`\n📝 Form Fields: ${auditResults.formFields.total} total`);
    console.log(`   - Inputs: ${auditResults.formFields.inputs}`);
    console.log(`   - Selects: ${auditResults.formFields.selects}`);
    console.log(`   - Textareas: ${auditResults.formFields.textareas}`);
    
    console.log(`\n⏱️  Timing:`);
    console.log(`   - Login to form: ${auditResults.timing.loginToForm}ms`);
    console.log(`   - Form load time: ${auditResults.timing.formLoadTime}ms`);
    
    console.log(`\n📱 Mobile UX Issues: ${auditResults.mobileUX.issues.length}`);
    auditResults.mobileUX.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    
    console.log(`\n❌ Console Errors: ${auditResults.consoleErrors.length}`);
    auditResults.consoleErrors.forEach(err => console.log(`   ${err}`));
    
    console.log(`\n🌐 Network Errors: ${auditResults.networkErrors.length}`);
    auditResults.networkErrors.forEach(err => console.log(`   ${err}`));
    
    console.log(`\n📸 Screenshots: ${auditResults.screenshots.length}`);
    auditResults.screenshots.forEach((s, i) => console.log(`   ${i + 1}. ${path.basename(s)}`));
    
    console.log('\n' + '='.repeat(80) + '\n');

    // Save audit results to JSON for report generation
    const fs = await import('fs');
    const resultsPath = path.join(__dirname, '..', 'docs', 'audit-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(auditResults, null, 2));
    console.log(`✓ Audit results saved to: ${resultsPath}`);

    // Basic assertions
    expect(auditResults.formFields.total).toBeGreaterThan(0);
    expect(auditResults.screenshots.length).toBeGreaterThanOrEqual(5);
    expect(auditResults.clickPath.length).toBeGreaterThan(0);
  });
});
