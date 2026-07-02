const { test, expect } = require('../_cdp');
const SHOP_URL = 'https://dev.chipy.com/shop';

// Covers the "Raffles" section of the shop page (raffles == "sweepstakes"):
//   <h2>Chipy's Exclusive Online Raffles - Win Real Money & Coins Prizes</h2>
//   <div class="sweepstake-list js-slider_section">
//     <a class="sweepstake-item" href="/sweepstakes/...">
//       <img alt="...">
//       <div class="sweepstake-date-start">Ends on ...</div>
//       <h3 class="h3title">...</h3>
//       <div class="description-text">...</div>
//       <div class="info-bottom"> ...<span class="level-ic">Level N+</span> </div>
//     </a> ...
//   </div>
//   <a class="load-more-btn" href="/sweepstakes">All Raffles</a>
//
// The cards are ordered by their required level, ascending. There are two
// `.sweepstake-list` nodes on the page, so the cards are addressed directly via
// `a.sweepstake-item`.
// ---------------------------------------------------------------------------
test.describe('Chipy Shop - Raffles section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  const heading = (page) => page.locator('h2', { hasText: 'Exclusive Online Raffles' });
  const cards   = (page) => page.locator('a.sweepstake-item');

  // ---------------------------------------------------------------------------
  // 1) THE H2 HEADING
  // ---------------------------------------------------------------------------
  test('Section H2 heading has the expected text', async ({ page }) => {
    const h2 = heading(page);
    await expect(h2).toBeVisible();
    await expect(h2).toHaveText(
      "Chipy's Exclusive Online Raffles - Win Real Money & Coins Prizes",
    );
  });

  // ---------------------------------------------------------------------------
  // 2) EVERY RAFFLE CARD HAS THE EXPECTED ELEMENTS
  // ---------------------------------------------------------------------------
  test('Each raffle card shows the expected elements', async ({ page }) => {
    const list = cards(page);

    const count = await list.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = list.nth(i);

      // The whole card links to a raffle page.
      await expect(card).toHaveAttribute('href', /^\/sweepstakes\/.+/);

      // Image, end date, title, description and the info row.
      await expect(card.locator('img').first()).toBeVisible();
      await expect(card.locator('.sweepstake-date-start')).toBeVisible();

      const title = card.locator('h3.h3title');
      await expect(title).toBeVisible();
      expect((await title.innerText()).trim().length).toBeGreaterThan(0);

      await expect(card.locator('.description-text')).toBeVisible();
      // The info row shows the free/coins entry and the required level.
      await expect(card.locator('.info-bottom')).toBeVisible();
      await expect(card.locator('.level-ic')).toContainText(/Level/i);
    }
  });

  // ---------------------------------------------------------------------------
  // 3) THE "ALL RAFFLES" CTA OPENS THE RAFFLES PAGE
  // ---------------------------------------------------------------------------
  test('All Raffles CTA opens the sweepstakes page', async ({ page }) => {
    const cta = page.getByRole('link', { name: 'All Raffles' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/sweepstakes');

    await cta.click();

    await expect(page).toHaveURL(/\/sweepstakes$/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 4) THE CARDS ARE SORTED BY LEVEL, ASCENDING
  // ---------------------------------------------------------------------------
  test('Raffle cards are sorted by required level, ascending', async ({ page }) => {
    // The required level is shown as "Level N+" inside each card's .level-ic.
    const levels = await cards(page)
      .locator('.level-ic')
      .evaluateAll((els) => els.map((e) => {
        const m = (e.textContent || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : NaN;
      }));

    expect(levels.length).toBeGreaterThan(0);
    // Every card yielded a real level number...
    expect(levels.every((n) => Number.isFinite(n))).toBe(true);
    // ...and they run low -> high (non-decreasing).
    const ascending = levels.every((v, i) => i === 0 || v >= levels[i - 1]);
    expect(ascending, `levels not ascending -> ${levels.join(', ')}`).toBe(true);
  });
});




