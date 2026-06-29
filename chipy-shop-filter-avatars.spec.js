const { test, expect } = require('../../_cdp');
const SHOP_URL = 'https://dev.chipy.com/shop';

test.describe('Chipy Shop - Avatars (Body) filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  // ---------------------------------------------------------------------------
  // SELECTING "AVATARS -> BODY" FILTERS THE LIST + LOAD MORE LOADS EVERY ITEM
  // ---------------------------------------------------------------------------
  test('Selecting Avatars -> Body shows only Body items and Load More loads them all', async ({ page }) => {
    const avatarsToggler = page.locator('button#avatars.shop-filters__item--toggler');
    const bodyOption     = page.locator('#avatar-body');

    // The "Available Items" section: holds the cards, the "Load More" button and
    // the results counter. Scoped here so the separate "Sold Out Items" section
    // (data-section="soldOut") is ignored entirely.
    const availableSection = page.locator('section.shop-main-section', {
      has: page.locator('.shop-manage-panel'),
    });
    const loadMore = availableSection.locator('button.shop-load-more');
    const counter  = availableSection.locator('.shop-manage-panel__total span');

    // Visible cards in the available section + the body / non-body subsets.
    const visibleCards   = availableSection.locator('article.shop-card:visible');
    const visibleBody    = availableSection.locator('article.shop-card:visible:has(img[data-type="body"])');
    const visibleNonBody = availableSection.locator('article.shop-card:visible:not(:has(img[data-type="body"]))');

    // ---- OPEN THE AVATARS DROPDOWN ----------------------------------------
    // Click on the avatars filter only while the panel is still closed, retrying
    // until #avatarsDD is actually displayed (avoids toggling it back).
    const dropdownOpen = () => page.evaluate(() => {
      const dd = document.querySelector('#avatarsDD');
      return !!dd && getComputedStyle(dd).display !== 'none';
    });
    await expect(async () => {
      if (!(await dropdownOpen())) {
        await avatarsToggler.scrollIntoViewIfNeeded();
        await avatarsToggler.click();
      }
      expect(await dropdownOpen()).toBe(true);
    }).toPass({ timeout: 15000 });

    // ---- SELECT "BODY" AND WAIT FOR THE FILTER TO APPLY -------------------
    await expect(async () => {
      await bodyOption.click({ timeout: 3000 });
      await expect(visibleNonBody).toHaveCount(0);
    }).toPass({ timeout: 15000 });
    expect(await visibleBody.count()).toBeGreaterThan(0);

    // ---- LOAD EVERY FILTERED ITEM -----------------------------------------
    // With the filter applied, keep clicking "Load More" until it disappears
    await expect(async () => {
      if (await loadMore.isVisible()) await loadMore.click();
      await expect(loadMore).toBeHidden();
    }).toPass({ timeout: 30000 });

    // ---- FILTERED STATE (after everything is loaded) ----------------------
    const expectedCount = parseInt((await counter.innerText()).trim(), 10);
    expect(expectedCount).toBeGreaterThan(0);

    // Only body cards remain visible, and there are no non-body cards.
    await expect(visibleNonBody).toHaveCount(0);
    // Every visible card is a body card...
    expect(await visibleCards.count()).toBe(await visibleBody.count());
    // ...and the fully-loaded body count matches the results counter.
    await expect(visibleBody).toHaveCount(expectedCount);
  });
});
