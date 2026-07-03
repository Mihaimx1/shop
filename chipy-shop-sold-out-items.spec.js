const { test, expect } = require('./cdp-fixtures');
const SHOP_URL = 'https://dev.chipy.com/shop';

test.describe('Chipy Shop - Sold Out Items section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  const soldOut = (page) =>
    page.locator('section.shop-main-section[data-section="soldOut"]');

  // ---------------------------------------------------------------------------
  // 1) Check H2
  // ---------------------------------------------------------------------------
  test('Section H2 heading has the expected text', async ({ page }) => {
    const section = soldOut(page);
    await expect(section).toBeVisible();
    await expect(section.locator('h2')).toHaveText(
      'Sold Out Items - Your Favorites Will Be Back, Start Saving Up Coins!',
    );
  });

  // ---------------------------------------------------------------------------
  // 2) EVERY SOLD-OUT CARD HAS THE EXPECTED ELEMENTS
  // ---------------------------------------------------------------------------
  test('Each sold-out card shows the expected elements (inactive buy + info trigger)', async ({ page }) => {
    const cards = soldOut(page).locator('article.shop-card');

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);

      // Logo image.
      await expect(card.locator('.shop-card__logo img')).toBeVisible();

      // Title link points at an item page and is not empty.
      const titleLink = card.locator('h3.shop-card__title a');
      await expect(titleLink).toBeVisible();
      await expect(titleLink).toHaveAttribute('href', /^\/item-name\/.+/);
      expect((await titleLink.innerText()).trim().length).toBeGreaterThan(0);

      // Stats: coins + level.
      await expect(card.locator('.shop-card__stats span')).toHaveCount(2);

      // The buy button is INACTIVE: it has the sold-out modifier, NOT the
      // active one, and reads "Sold Out".
      const buyBtn = card.locator('.shop-buy-button');
      await expect(buyBtn).toHaveClass(/shop-buy-button--sold-out/);
      await expect(buyBtn).not.toHaveClass(/shop-buy-button--active/);
      await expect(buyBtn).toHaveText('Sold Out');

      // The sold-out badge in the card footer.
      await expect(card.locator('.shop-card__bottom .sold-out')).toContainText('Sold Out');

      // The info popup TRIGGER: the tooltip button with the info icon and a
      // non-empty data-description (the popup's content). See the note on top.
      const infoTrigger = card.locator('.shop-card__tooltip');
      await expect(infoTrigger).toBeVisible();
      await expect(infoTrigger.locator('img')).toHaveAttribute('alt', 'info icon');
      const description = await infoTrigger.getAttribute('data-description');
      expect((description || '').length).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------------------
  // 3) HOVERING THE INFO ICON SHOWS THE DESCRIPTION POPUP
  // ---------------------------------------------------------------------------
  test('Hovering a sold-out card info icon shows its description popup', async ({ page }) => {
    const card        = soldOut(page).locator('article.shop-card').first();
    const infoTrigger = card.locator('.shop-card__tooltip');
    const raw = await infoTrigger.getAttribute('data-description');
    const description = decodeURIComponent(raw || '').replace(/^"|"$/g, '').trim();
    expect(description.length).toBeGreaterThan(0);

    // Target the tooltip that actually holds THIS item's description: several
    // (stale, hidden) `.tooltipster-base` nodes can linger on the page, so match
    // by content instead of grabbing the first one.
    const popup = page.locator('.tooltipster-base', { hasText: description.slice(0, 40) });

    // Hover to open the Tooltipster popup. It uses hover-intent, so move the
    // mouse away and hover again until the populated popup shows.
    await expect(async () => {
      await page.mouse.move(0, 0);
      await infoTrigger.hover();
      await expect(popup).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // The popup shows this item's description.
    await expect(popup).toContainText(description.slice(0, 40));
  });

  // ---------------------------------------------------------------------------
  // 4) CLICKING A CARD TITLE NAVIGATES TO ITS ITEM PAGE
  // ---------------------------------------------------------------------------
  test('Clicking a sold-out card title opens its item page', async ({ page }) => {
    const titleLink = soldOut(page)
      .locator('article.shop-card h3.shop-card__title a')
      .first();

    // Remember where it points and what it says before navigating.
    const href  = await titleLink.getAttribute('href');
    const title = (await titleLink.innerText()).trim();
    expect(href).toMatch(/^\/item-name\/.+/);

    await titleLink.click();

    // We land on that exact item page...
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    // ...and the item page shows the same title as its heading.
    await expect(page.locator('h1').first()).toHaveText(title);
  });
});
