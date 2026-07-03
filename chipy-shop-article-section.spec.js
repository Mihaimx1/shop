const { test, expect } = require('./cdp-fixtures');
const SHOP_URL = 'https://dev.chipy.com/shop';

// ---------------------------------------------------------------------------
test.describe('Chipy Shop - Latest [articles] section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  const heading  = (page) => page.locator('h2', { hasText: 'Latest Neosurf News' });
  const articles = (page) => page.locator('a[href^="/news/"]:has(.box_title)');

  // ---------------------------------------------------------------------------
  // 1) THE H2 HEADING
  // ---------------------------------------------------------------------------
  test('Section H2 heading has the expected text', async ({ page }) => {
    const h2 = heading(page);
    await expect(h2).toBeVisible();
    await expect(h2).toContainText('Latest');
    await expect(h2).toContainText('News');
  });

  // ---------------------------------------------------------------------------
  // 2) EVERY ARTICLE CARD HAS THE EXPECTED ELEMENTS
  // ---------------------------------------------------------------------------
  test('Each article card shows the expected elements', async ({ page }) => {
    const list = articles(page);

    const count = await list.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = list.nth(i);

      // Links to an article page.
      await expect(card).toHaveAttribute('href', /^\/news\/.+/);

      // Thumbnail image.
      await expect(card.locator('.image_wrap img')).toBeVisible();

      // Title with non-empty text.
      const title = card.locator('.box_title');
      await expect(title).toBeVisible();
      expect((await title.innerText()).trim().length).toBeGreaterThan(0);

      // Footer: author, a dated <time>, and the read-time.
      await expect(card.locator('.box_date')).toBeVisible();
      await expect(card.locator('.box_read time')).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}/);
      await expect(card.locator('.box_rating')).toContainText(/min read/i);

      // Preview text.
      await expect(card.locator('.box_text_preview')).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // 3) THE "SEE ALL ARTICLES" CTA OPENS THE NEWS PAGE
  // ---------------------------------------------------------------------------
  test('See All Articles CTA opens the news page', async ({ page }) => {
    const cta = page.getByRole('link', { name: 'See All Articles' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/news');

    await cta.click();

    await expect(page).toHaveURL(/\/news$/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 4) CLICKING AN ARTICLE OPENS THAT ARTICLE
  // ---------------------------------------------------------------------------
  test('Clicking an article card opens its article page', async ({ page }) => {
    const card = articles(page).first();

    const href  = await card.getAttribute('href');
    const title = (await card.locator('.box_title').innerText()).trim();
    expect(href).toMatch(/^\/news\/.+/);

    await card.click();

    // We land on that exact article, and its heading matches the card title.
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.locator('h1').first()).toHaveText(title);
  });

  // ---------------------------------------------------------------------------
  // 5) THE ARTICLES ARE SORTED BY DATE (NEWEST FIRST)
  // ---------------------------------------------------------------------------
  test('Articles are sorted by date, newest first', async ({ page }) => {
    const datetimes = await articles(page)
      .locator('.box_read time')
      .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));

    expect(datetimes.length).toBeGreaterThan(0);

    // Every article has a valid date...
    const stamps = datetimes.map((d) => Date.parse(d));
    expect(stamps.every((n) => Number.isFinite(n))).toBe(true);

    // ...and they run newest -> oldest (non-increasing).
    const newestFirst = stamps.every((v, i) => i === 0 || v <= stamps[i - 1]);
    expect(newestFirst, `dates not newest-first -> ${datetimes.join(' | ')}`).toBe(true);
  });
});
