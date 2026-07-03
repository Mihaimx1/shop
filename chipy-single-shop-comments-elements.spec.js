const { test, expect } = require('./cdp-fixtures');
const ITEM_URL = 'https://dev.chipy.com/item-name/311-free-spins-test';

// Top-level comments only (replies are data-role="reply").
const TOP_COMMENTS = '#comments_wrap .comments__wrap[data-role="comment"]';

// Picks a sort option, the click is retried until it registers
// (the #sort-txt label reflects the chosen option).
async function sortBy(page, orderBy) {
  const label = orderBy === 'newest' ? 'Newest' : 'Most Helpful';
  await expect(async () => {
    await page.locator('#sort-txt').click({ force: true }); // open the sort dropdown
    await page.locator(`#sort-shop-wrap .filter-by-option[data-order-by="${orderBy}"] label`).click({ force: true });
    await expect(page.locator('#sort-txt')).toContainText(label, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await page.waitForTimeout(1000); // let the re-sorted list settle
}

// Clicks "Show N more" until every comment is loaded.
async function loadAllComments(page) {
  const btn = page.locator('.shop-comments__load-more');
  await expect(async () => {
    while (await btn.isVisible().catch(() => false)) {
      const before = await page.locator(TOP_COMMENTS).count();
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      // Either more comments arrived, or the button is gone.
      await page.waitForFunction(
        (n) => {
          const b = document.querySelector('.shop-comments__load-more');
          const grown = document.querySelectorAll('#comments_wrap .comments__wrap[data-role="comment"]').length > n;
          return grown || !b || b.offsetParent === null;
        },
        before,
        { timeout: 8000 },
      );
    }
  }).toPass({ timeout: 30000 });
}

// Reads {id, datetime, helpful} for every loaded top-level comment, de-duplicated
// by id (paging after a sort can momentarily re-append a comment).
async function readComments(page) {
  const rows = await page.locator(TOP_COMMENTS).evaluateAll((els) =>
    els.map((e) => ({
      id: e.id,
      datetime: (e.querySelector('.comments__time') || {}).getAttribute?.('datetime') || '',
      helpful: Number((e.querySelector('.helpful_value') || {}).textContent || '0'),
    })),
  );
  const seen = new Set();
  return rows.filter((c) => !seen.has(c.id) && seen.add(c.id));
}

test.describe('Chipy single item - comment elements & sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(TOP_COMMENTS).first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 1) EVERY COMMENT SHOWS A USERNAME AND A LEVEL
  // ---------------------------------------------------------------------------
  test('Each comment displays a username and a level', async ({ page }) => {
    await loadAllComments(page);

    const comments = page.locator(TOP_COMMENTS);
    const count = await comments.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const c = comments.nth(i);

      // Author (the visible username).
      const user = c.locator('.comments__user').first();
      await expect(user).toBeVisible();
      expect((await user.innerText()).trim().length).toBeGreaterThan(0);

      // Level.
      await expect(c.locator('.level_and_country .level').first()).toHaveText(/Level\s*\d+/i);
    }
  });

  // ---------------------------------------------------------------------------
  // 2) COUNTRY IS SHOWN FOR USERS THAT HAVE ONE
  // ---------------------------------------------------------------------------
  test('Comments show a country when the user has set one', async ({ page }) => {
    await loadAllComments(page);

    const countries = page.locator(`${TOP_COMMENTS} .level_and_country .country`);
    // At least one commenter on this item has a country on record...
    expect(await countries.count()).toBeGreaterThan(0);
    // ...and wherever a country is shown it is non-empty text.
    for (let i = 0; i < (await countries.count()); i++) {
      expect((await countries.nth(i).innerText()).trim().length).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------------------
  // 3) SORT CONTROLS DEFAULT TO "MOST HELPFUL"
  // ---------------------------------------------------------------------------
  test('Sort controls default to "Most Helpful"', async ({ page }) => {
    await expect(page.locator('.shop-comments__total')).toHaveText(/\d+\s*comments?/i);
    await expect(page.locator('#sort-txt')).toContainText('Most Helpful');

    const helpful = page.locator('#sort-shop-wrap .filter-by-option[data-order-by="helpful"]');
    const newest = page.locator('#sort-shop-wrap .filter-by-option[data-order-by="newest"]');
    await expect(helpful).toHaveAttribute('data-selected', 'true');
    await expect(newest).toHaveAttribute('data-selected', 'false');
    await expect(helpful).toContainText('Most Helpful');
    await expect(newest).toContainText('Newest');
  });

  // ---------------------------------------------------------------------------
  // 4) "NEWEST" ORDERS EVERY COMMENT BY DATE, NEWEST FIRST
  // ---------------------------------------------------------------------------
  test('Sorting by Newest orders all comments newest-first', async ({ page }) => {
    await sortBy(page, 'newest');
    await expect(page.locator('#sort-shop-wrap .filter-by-option[data-order-by="newest"]'))
      .toHaveAttribute('data-selected', 'true');

    await loadAllComments(page);
    const comments = await readComments(page);
    expect(comments.length).toBeGreaterThan(1);

    // The datetime attribute is "YYYY-MM-DD HH:MM:SS", lexically sortable,
    // so each comment must be at least as new as the one after it.
    for (let i = 1; i < comments.length; i++) {
      expect(
        comments[i - 1].datetime >= comments[i].datetime,
        `#${comments[i - 1].id} (${comments[i - 1].datetime}) should not be older than #${comments[i].id} (${comments[i].datetime})`,
      ).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 5) "MOST HELPFUL" ORDERS EVERY COMMENT BY HELPFUL COUNT, HIGHEST FIRST
  // ---------------------------------------------------------------------------
  test('Sorting by Most Helpful orders all comments by helpful count', async ({ page }) => {
    // Switch away and back so we exercise the toggle in both directions.
    await sortBy(page, 'newest');
    await sortBy(page, 'helpful');
    await expect(page.locator('#sort-txt')).toContainText('Most Helpful');
    await expect(page.locator('#sort-shop-wrap .filter-by-option[data-order-by="helpful"]'))
      .toHaveAttribute('data-selected', 'true');

    await loadAllComments(page);
    const comments = await readComments(page);
    expect(comments.length).toBeGreaterThan(1);

    // Helpful counts must be non-increasing down the list.
    for (let i = 1; i < comments.length; i++) {
      expect(
        comments[i - 1].helpful >= comments[i].helpful,
        `#${comments[i - 1].id} (${comments[i - 1].helpful} helpful) should not rank below #${comments[i].id} (${comments[i].helpful} helpful)`,
      ).toBe(true);
    }
  });
});
