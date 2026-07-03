const { test, expect } = require('./cdp-fixtures');
const SHOP_URL = 'https://dev.chipy.com/shop';

test.describe('Chipy Shop - Q&As section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  const qna   = (page) => page.locator('section.qna-section');
  const cards = (page) => qna(page).locator('.qna-section__list .qna-card');

  // ---------------------------------------------------------------------------
  // 1) CHECK H2
  // ---------------------------------------------------------------------------
  test('Section H2 heading has the expected text', async ({ page }) => {
    const section = qna(page);
    await expect(section).toBeVisible();
    await expect(section.locator('h2')).toHaveText('Shop Q&As');
  });

  // ---------------------------------------------------------------------------
  // 2) EVERY Q&A CARD HAS THE EXPECTED ELEMENTS
  // ---------------------------------------------------------------------------
  test('Each Q&A card shows the expected elements', async ({ page }) => {
    const list = cards(page);

    const count = await list.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = list.nth(i);

      // Author block: avatar, username and level.
      await expect(card.locator('.comments__pic img').first()).toBeVisible();
      await expect(card.locator('.comments__user')).toBeVisible();
      await expect(card.locator('.level')).toBeVisible();

      // The posting date (shown on the right) with a parseable datetime.
      const time = card.locator('time.comments__time');
      await expect(time).toBeVisible();
      await expect(time).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}/);

      // Title link -> a question page.
      const titleLink = card.locator('a.qna-card__title--link');
      await expect(titleLink).toBeVisible();
      await expect(titleLink).toHaveAttribute('href', /^\/questions\/\d+/);
      expect((await titleLink.innerText()).trim().length).toBeGreaterThan(0);

      // Body and stats (followers / answers).
      await expect(card.locator('.qna-card__body')).toBeVisible();
      await expect(card.locator('.qna-card__stats')).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // 3) "ASK A QUESTION" OPENS THE ASK PAGE
  // ---------------------------------------------------------------------------
  test('Ask a Question button opens the ask-a-question page', async ({ page }) => {
    const askBtn = qna(page).locator('a.qna-section__ask-btn');
    await expect(askBtn).toBeVisible();
    await expect(askBtn).toHaveText('Ask a Question');
    await expect(askBtn).toHaveAttribute('href', '/questions/ask');

    await askBtn.click();

    await expect(page).toHaveURL(/\/questions\/ask$/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 4) CLICKING A QUESTION TITLE OPENS THAT QUESTION
  // ---------------------------------------------------------------------------
  test('Clicking a question title opens its question page', async ({ page }) => {
    const titleLink = cards(page).first().locator('a.qna-card__title--link');

    const href  = await titleLink.getAttribute('href');
    const title = (await titleLink.innerText()).trim();
    expect(href).toMatch(/^\/questions\/\d+/);

    await titleLink.click();

    // We land on that exact question page, and its heading matches the title.
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.locator('h1').first()).toHaveText(title);
  });

  // ---------------------------------------------------------------------------
  // 5) THE CARDS ARE SORTED BY DATE (NEWEST FIRST)
  // ---------------------------------------------------------------------------
  test('Q&A cards are sorted by date, newest first', async ({ page }) => {
    const datetimes = await cards(page)
      .locator('time.comments__time')
      .evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));

    expect(datetimes.length).toBeGreaterThan(0);

    // Every <time> is a valid date...
    const stamps = datetimes.map((d) => Date.parse((d || '').replace(' ', 'T')));
    expect(stamps.every((n) => Number.isFinite(n))).toBe(true);

    // ...and they run newest -> oldest (non-increasing).
    const newestFirst = stamps.every((v, i) => i === 0 || v <= stamps[i - 1]);
    expect(newestFirst, `dates not newest-first -> ${datetimes.join(' | ')}`).toBe(true);
  });
});
