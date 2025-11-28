// UX Audit - Terms Notice Verification
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function audit() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });

  console.log('\n=== TERMS NOTICE VISUAL VERIFICATION ===\n');

  // Desktop check
  console.log('1. DESKTOP (1280x800)');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${BASE_URL}/login`);
  await desktopPage.waitForLoadState('networkidle');

  const desktopOverflow = await desktopPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`   - Overflow: ${desktopOverflow ? 'YES ⚠️' : 'NO ✓'}`);
  await desktopPage.screenshot({ path: 'audit-desktop.png', fullPage: true });
  console.log('   - Screenshot: audit-desktop.png');
  await desktopContext.close();

  // Mobile check - iPhone 12
  console.log('\n2. MOBILE - iPhone 12 (390x844)');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/login`);
  await mobilePage.waitForLoadState('networkidle');

  const mobileOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`   - Overflow: ${mobileOverflow ? 'YES ⚠️' : 'NO ✓'}`);

  // Check text readability (font size)
  const textStyles = await mobilePage.evaluate(() => {
    const elements = document.querySelectorAll('p, span, a');
    let tooSmall = 0;
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < 10) tooSmall++;
    });
    return { tooSmall };
  });
  console.log(`   - Text too small (<10px): ${textStyles.tooSmall > 0 ? textStyles.tooSmall + ' ⚠️' : '0 ✓'}`);

  await mobilePage.screenshot({ path: 'audit-mobile.png', fullPage: true });
  console.log('   - Screenshot: audit-mobile.png');
  await mobileContext.close();

  // Small mobile check - iPhone SE
  console.log('\n3. SMALL MOBILE - iPhone SE (375x667)');
  const smallContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  const smallPage = await smallContext.newPage();
  await smallPage.goto(`${BASE_URL}/login`);
  await smallPage.waitForLoadState('networkidle');

  const smallOverflow = await smallPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`   - Overflow: ${smallOverflow ? 'YES ⚠️' : 'NO ✓'}`);
  await smallPage.screenshot({ path: 'audit-small-mobile.png', fullPage: true });
  console.log('   - Screenshot: audit-small-mobile.png');
  await smallContext.close();

  console.log('\n=== VERIFICATION RESULTS ===');
  console.log(`desktop  → ${desktopOverflow ? 'issue (overflow)' : 'ok'}`);
  console.log(`mobile   → ${mobileOverflow ? 'issue (overflow)' : 'ok'}`);
  console.log(`text size → ${textStyles.tooSmall > 0 ? 'issue (too small)' : 'readable'}`);
  console.log(`overflow → ${desktopOverflow || mobileOverflow || smallOverflow ? 'present' : 'none'}`);

  await browser.close();
}

audit().catch(console.error);

