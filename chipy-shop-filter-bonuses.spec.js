const { test, expect } = require('../../_cdp');
const SHOP_URL = 'https://dev.chipy.com/shop';

test.describe('Chipy Shop - Shop Bonuses filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  // ---------------------------------------------------------------------------
  // 1) THE "SHOP BONUSES" FILTER IS PRESENT
  // ---------------------------------------------------------------------------
  test('Shop Bonuses filter button is shown in the filter panel', async ({ page }) => {
    // The filter panel that holds the category buttons.
    const filterPanel = page.locator('.shop-filters');
    await expect(filterPanel).toBeVisible();

    // The "Shop Bonuses" filter itself: a radio-style filter button.
    const bonusesFilter = page.getByRole('button', { name: 'Shop Bonuses', exact: true });
    await expect(bonusesFilter).toBeVisible();
    await expect(bonusesFilter).toHaveClass(/shop-filters__item--radio/);

    // It is not selected by default.
    await expect(bonusesFilter).not.toHaveClass(/\bactive\b/);
  });

  // ---------------------------------------------------------------------------
  // 2) SELECTING "SHOP BONUSES" FILTERS
  // ---------------------------------------------------------------------------
  test('Selecting Shop Bonuses shows only bonus items', async ({ page }) => {
    const bonusesFilter = page.getByRole('button', { name: 'Shop Bonuses', exact: true });

    // The "Available Items" section: holds the cards, the "Load More" button and
    // the results counter that all react to the active filter.
    const availableSection = page.locator('section.shop-main-section', {
      has: page.locator('.shop-manage-panel'),
    });
    const loadMore = availableSection.locator('button.shop-load-more');
    const counter  = availableSection.locator('.shop-manage-panel__total span');

    // Every shop card currently visible, and the bonus / non-bonus subsets.
    // Scoped to the "Available Items" section so the separate "Sold Out Items"
    // section (data-section="soldOut") is ignored entirely.
    const visibleCards    = availableSection.locator('article.shop-card:visible');
    const visibleBonus    = availableSection.locator('article.shop-card:visible:has(img[data-type="bonus"])');
    const visibleNonBonus = availableSection.locator('article.shop-card:visible:not(:has(img[data-type="bonus"]))');
    
    // ---- DEFAULT (no filter): the list is a mix of categories -------------
    const totalBefore = await visibleCards.count();
    expect(totalBefore).toBeGreaterThan(0);
    // Some non-bonus items (avatars / real money) are visible before filtering.
    expect(await visibleNonBonus.count()).toBeGreaterThan(0);

    // ---- SELECT THE "SHOP BONUSES" FILTER ---------------------------------
    // Click only while it is not yet active, retrying until it activates.
    await expect(async () => {
      const isActive = await bonusesFilter.evaluate((el) => el.classList.contains('active'));
      if (!isActive) await bonusesFilter.click();
      await expect(bonusesFilter).toHaveClass(/\bactive\b/);
    }).toPass({ timeout: 15000 });

    // ---- WAIT FOR THE FILTER TO ACTUALLY APPLY ----------------------------
    // The list re-renders to bonus-only: no non-bonus cards remain. We wait for
    // this before reading the counter, otherwise it still shows the full total.
    await expect(visibleNonBonus).toHaveCount(0);
    expect(await visibleBonus.count()).toBeGreaterThan(0);

    // ---- LOAD EVERY FILTERED ITEM -----------------------------------------
    // keep clicking "Load More" until it disappears so the whole bonus list is
    // rendered before we count anything.
    await expect(async () => {
      if (await loadMore.isVisible()) await loadMore.click();
      await expect(loadMore).toBeHidden();
    }).toPass({ timeout: 30000 });

    // ---- FILTERED STATE (after everything is loaded) ----------------------
    // Now that the filter is applied and every item is loaded, the counter holds
    // the bonus-only total. Read it here, not right after the click.
    const expectedCount = parseInt((await counter.innerText()).trim(), 10);
    expect(expectedCount).toBeGreaterThan(0);

    // The filter genuinely narrowed the list (fewer cards than the full mix).
    expect(await visibleCards.count()).toBeLessThan(totalBefore);
    // Every visible card is a bonus card...
    expect(await visibleCards.count()).toBe(await visibleBonus.count());
    // ...and the fully-loaded bonus count matches the results counter.
    await expect(visibleBonus).toHaveCount(expectedCount);
  });
});



// for run: Cei 3 pași — fă-i în ordine
// Pasul 1 — pornește un Chrome cu „debugging" activat. Deschide PowerShell și rulează:

// & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Temp\chrome-cdp"

// Pasul 2 — treci de Cloudflare ca om. În acea fereastră Chrome, intră pe:
// https://dev.chipy.com/shop

// Pasul 3 — rulează testul (în terminalul tău obișnuit, nu închide Chrome-ul):
// cd C:\Users\razva\playwright-project
// npx playwright test tests/chipy/shop/chipy-shop-filter-bonuses.spec.js --project="Google Chrome" --workers=1