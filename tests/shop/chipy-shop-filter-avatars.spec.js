const { test, expect } = require('../support/cdp');
const SHOP_URL = 'https://dev.chipy.com/shop';

// The four avatar sub-categories in the Avatars dropdown. NOTE: the data-type on
// each product's logo image does NOT always match the label - "Hair" items carry
// data-type="head". The dropdown is MULTI-SELECT, so every category is verified
// from a fresh page load to stop selections from stacking up.
const AVATAR_CATEGORIES = [
  { label: 'Body',  optionId: '#avatar-body',  dataType: 'body'  },
  { label: 'Hair',  optionId: '#avatar-hair',  dataType: 'head'  },
  { label: 'Eyes',  optionId: '#avatar-eyes',  dataType: 'eyes'  },
  { label: 'Mouth', optionId: '#avatar-mouth', dataType: 'mouth' },
];

test.describe('Chipy Shop - Avatars filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  // ---------------------------------------------------------------------------
  // SELECTING EACH AVATAR SUB-FILTER FILTERS THE LIST + LOAD MORE LOADS EVERYTHING
  // ---------------------------------------------------------------------------
  test('Each avatar sub-filter shows only its items and Load More loads them all', async ({ page }) => {
    const avatarsToggler = page.locator('button#avatars.shop-filters__item--toggler');

    // The "Available Items" section: holds the cards, the "Load More" button and
    // the results counter. Scoped here so the separate "Sold Out Items" section
    // (data-section="soldOut") is ignored entirely.
    const availableSection = page.locator('section.shop-main-section', {
      has: page.locator('.shop-manage-panel'),
    });
    const loadMore     = availableSection.locator('button.shop-load-more');
    const counter      = availableSection.locator('.shop-manage-panel__total span');
    const visibleCards = availableSection.locator('article.shop-card:visible');

    // Is the avatars dropdown (#avatarsDD) currently displayed?
    const dropdownOpen = () => page.evaluate(() => {
      const dd = document.querySelector('#avatarsDD');
      return !!dd && getComputedStyle(dd).display !== 'none';
    });

    for (const cat of AVATAR_CATEGORIES) {
      await test.step(`Avatars -> ${cat.label}`, async () => {
        // Fresh page each time: the dropdown is multi-select, so start clean.
        await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });

        const option          = page.locator(cat.optionId);
        const visibleMatch    = availableSection.locator(`article.shop-card:visible:has(img[data-type="${cat.dataType}"])`);
        const visibleNonMatch = availableSection.locator(`article.shop-card:visible:not(:has(img[data-type="${cat.dataType}"]))`);

        // ---- OPEN THE AVATARS DROPDOWN ------------------------------------
        // Click the avatars filter only while the panel is still closed,
        // retrying until #avatarsDD is actually displayed (avoids toggling it
        // back shut).
        await expect(async () => {
          if (!(await dropdownOpen())) {
            await avatarsToggler.scrollIntoViewIfNeeded();
            await avatarsToggler.click();
          }
          expect(await dropdownOpen()).toBe(true);
        }).toPass({ timeout: 15000 });

        // ---- SELECT THE CATEGORY AND WAIT FOR THE FILTER TO APPLY ---------
        await expect(async () => {
          await option.click({ timeout: 3000 });
          await expect(visibleNonMatch).toHaveCount(0);
        }).toPass({ timeout: 15000 });
        expect(await visibleMatch.count()).toBeGreaterThan(0);

        // ---- LOAD EVERY FILTERED ITEM -------------------------------------
        // Keep clicking "Load More" until it disappears (lazy-init may swallow
        // the first click, so we just keep clicking while it is visible).
        while (await loadMore.isVisible().catch(() => false)) {
          await loadMore.click().catch(() => {});
          await page.waitForTimeout(600);
        }

        // ---- FILTERED STATE (after everything is loaded) ------------------
        const expectedCount = parseInt((await counter.innerText()).trim(), 10);
        expect(expectedCount).toBeGreaterThan(0);

        // Only this category remains visible, with no other-category cards.
        await expect(visibleNonMatch).toHaveCount(0);
        // Every visible card belongs to this category...
        expect(await visibleCards.count()).toBe(await visibleMatch.count());
        // ...and the fully-loaded count matches the results counter.
        await expect(visibleMatch).toHaveCount(expectedCount);
      });
    }
  });
});




