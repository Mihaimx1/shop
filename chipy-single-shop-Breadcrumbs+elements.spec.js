const { test, expect } = require('./cdp-fixtures');
const { ensureLoggedOut } = require('./chipy-auth');
const ITEM_URL = 'https://dev.chipy.com/item-name/311-free-spins-test';

test.describe('Chipy single item - breadcrumbs & item box', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded' });
    await ensureLoggedOut(page, ITEM_URL);
  });

  // ---------------------------------------------------------------------------
  // 1) BREADCRUMBS ARE PRESENT AND POINT TO THE RIGHT PAGES
  // ---------------------------------------------------------------------------
  test('Breadcrumbs are present with the correct links and home icon', async ({ page }) => {
    const crumbs = page.locator('.breadcrumbs');
    await expect(crumbs).toBeVisible();

    // Home link + its icon (correct href and alt text).
    const home = crumbs.locator('a.card__pagination-home');
    await expect(home).toHaveAttribute('href', '/');
    await expect(home.locator('img.homepage-icon')).toHaveAttribute('alt', 'homepage icon');

    // Shop and Shop Bonuses links point where they should.
    await expect(crumbs.getByRole('link', { name: 'Shop', exact: true }))
      .toHaveAttribute('href', '/shop');
    await expect(crumbs.getByRole('link', { name: 'Shop Bonuses', exact: true }))
      .toHaveAttribute('href', '/item-type/Bonus');

    // The current (last) crumb is the item itself and is not a link.
    await expect(crumbs.locator('.current_page')).toHaveText('311 Free Spins test');
  });

  // ---------------------------------------------------------------------------
  // 2) A BREADCRUMB ACTUALLY NAVIGATES (Shop -> /shop)
  // ---------------------------------------------------------------------------
  test('Clicking the Shop breadcrumb opens the shop page', async ({ page }) => {
    await page.locator('.breadcrumbs').getByRole('link', { name: 'Shop', exact: true }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  // ---------------------------------------------------------------------------
  // 3) THE 4 KEY STATS ARE PRESENT, AND "BUY NOW" PROMPTS TO LOG IN
  // ---------------------------------------------------------------------------
  test('Item box shows price/min level/available/sold and Buy Now prompts login', async ({ page }) => {
    const card = page.locator('article.single-shop-card');
    await expect(card).toBeVisible();

    // Name + logo image.
    await expect(card.locator('h2.single-shop-card__name')).toHaveText('311 Free Spins test');
    await expect(card.locator('.single-shop-card__logo img')).toBeVisible();

    // The four key stats are present, each with a numeric value and the correct
    // icon alt text.
    const stats = card.locator('.single-shop-card__stats');
    const KEY_STATS = [
      { label: 'Price',      alt: 'Chipy Coin' },
      { label: 'Min. level', alt: 'star icon' },
      { label: 'Available',  alt: 'available' },
      { label: 'Sold',       alt: 'sold' },
    ];
    for (const { label, alt } of KEY_STATS) {
      const row = stats.locator('span', { hasText: label });
      await expect(row).toBeVisible();
      // A numeric value, allowing thousands separators (e.g. "11" or "4,323").
      await expect(row.locator('strong')).toHaveText(/^\d[\d,]*$/);
      await expect(row.locator('img')).toHaveAttribute('alt', alt);
    }

    // Clicking "Buy Now" while logged out opens the login/join prompt. 
    // click only while the prompt is not yet shown and retry until it appears.
    const buyBtn = card.locator('.shop-buy-button');
    await expect(buyBtn).toHaveText('Buy Now');

    const loginPrompt = page.locator('.tooltipster-base.prompt');
    await expect(async () => {
      if (!(await loginPrompt.isVisible())) await buyBtn.click();
      await expect(loginPrompt).toBeVisible();
    }).toPass({ timeout: 15000 });

    // The prompt asks the user to log in or join before purchasing...
    await expect(loginPrompt).toContainText('Log in');
    await expect(loginPrompt).toContainText('to make a purchase');
    // ...and the "Log in" control is wired to open the login popup.
    await expect(loginPrompt.locator('[data-trigger="login-popup"]')).toHaveText('Log in');
  });

  // ---------------------------------------------------------------------------
  // 4) THE ITEM DESCRIPTION IS PRESENT
  // ---------------------------------------------------------------------------
  test('Item description is present', async ({ page }) => {
    const card = page.locator('article.single-shop-card');
    await expect(card.locator('.single-shop-card__caption')).toHaveText('Item Description');

    const description = card.locator('.single-shop-card__description');
    await expect(description).toBeVisible();
    expect((await description.innerText()).trim().length).toBeGreaterThan(0);
  });
});
