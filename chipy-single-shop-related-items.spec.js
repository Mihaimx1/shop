const { test, expect } = require('./cdp-fixtures');
const ITEM_URL = 'https://dev.chipy.com/item-name/311-free-spins-test';

// ---------------------------------------------------------------------------
test.describe('Chipy single item - Related items section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded' });
  });

  const section = (page) => page.locator('section.shop-main-section[data-section="related"]');
  const cards = (page) => section(page).locator('article.shop-card');

  // ---------------------------------------------------------------------------
  // 1) THE SECTION TITLE AND THE CARD LIST ARE PRESENT
  // ---------------------------------------------------------------------------
  test('Section shows the "Related items" heading and a list of cards', async ({ page }) => {
    await expect(section(page)).toBeVisible();
    await expect(section(page).locator('h2')).toHaveText('Related items');
    await expect(section(page).locator('.shop-main-section__list')).toBeVisible();
    expect(await cards(page).count()).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 2) EVERY CARD EXPOSES ITS ELEMENTS
  // ---------------------------------------------------------------------------
  test('Each related card shows its logo, title, price, level and status', async ({ page }) => {
    const all = cards(page);
    const count = await all.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = all.nth(i);

      // Logo links to an item page, with an image.
      const logo = card.locator('a.shop-card__logo');
      await expect(logo).toHaveAttribute('href', /^\/item-name\/.+/);
      await expect(logo.locator('img')).toHaveCount(1);

      // Title links to the same kind of page and is not empty.
      const title = card.locator('h3.shop-card__title');
      expect((await title.innerText()).trim().length).toBeGreaterThan(0);
      await expect(title.locator('a')).toHaveAttribute('href', /^\/item-name\/.+/);

      // Price (a number) and minimum level ("Level N+").
      const stats = card.locator('.shop-card__stats span');
      await expect(stats).toHaveCount(2);
      await expect(stats.nth(0)).toHaveText(/\d[\d,]*/);
      await expect(stats.nth(1)).toContainText(/Level\s*\d+\+?/i);

      // A buy button and a "sold" count are always shown.
      await expect(card.locator('.shop-buy-button')).toBeVisible();
      await expect(card.locator('.shop-card__bottom')).toContainText(/\d+\s*sold/i);
    }
  });

  // ---------------------------------------------------------------------------
  // 3) EVERY RELATED ITEM IS A BONUS
  // ---------------------------------------------------------------------------
  test('All related items are bonuses', async ({ page }) => {
    const logos = section(page).locator('article.shop-card a.shop-card__logo img');
    const count = await logos.count();
    expect(count).toBeGreaterThan(0);

    // The logo image is tagged with its item type; for this section it is always
    // "bonus" (and the class carries the same marker).
    for (let i = 0; i < count; i++) {
      await expect(logos.nth(i)).toHaveAttribute('data-type', 'bonus');
      await expect(logos.nth(i)).toHaveClass(/\bbonus\b/);
    }
  });

  // ---------------------------------------------------------------------------
  // 4) EACH ITEM IS EITHER "BUY NOW" (AVAILABLE) OR "SOLD OUT"
  // ---------------------------------------------------------------------------
  test('Each item is either available (Buy Now) or Sold Out, consistently', async ({ page }) => {
    const all = cards(page);
    const count = await all.count();

    for (let i = 0; i < count; i++) {
      const card = all.nth(i);
      const buy = card.locator('.shop-buy-button');
      const cls = (await buy.getAttribute('class')) || '';

      if (cls.includes('shop-buy-button--sold-out')) {
        // Sold out: button says so, and the bottom row carries the sold-out mark.
        await expect(buy).toHaveText(/Sold Out/i);
        await expect(card.locator('.shop-card__bottom .sold-out')).toBeVisible();
      } else {
        // Available: active button says "Buy Now" and an availability count shows.
        await expect(buy).toHaveClass(/shop-buy-button--active/);
        await expect(buy).toHaveText(/Buy Now/i);
        await expect(card.locator('.shop-card__bottom')).toContainText(/\d+\s*available/i);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 5) A RELATED CARD LINKS TO ITS ITEM PAGE
  // ---------------------------------------------------------------------------
  test('Clicking a related item opens its item page', async ({ page }) => {
    const first = cards(page).first();
    const href = await first.locator('a.shop-card__logo').getAttribute('href');

    await first.locator('h3.shop-card__title a').click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  });
});
