const { test, expect } = require('../_cdp');
const ITEM_URL = 'https://dev.chipy.com/item-name/311-free-spins-test';

// Covers the "Relevant Pages" section on a single shop item page:
//   <section class="relevant-pages-for-shop">
//     <h2>Relevant pages for Wixstars Casino</h2>
//     <div class="relevant-pages-for-shop__cards">
//       <a class="relevant-pages-for-shop__card relevant-pages-for-shop__card--casino"
//          href="/casinos/wixstars-casino-review">
//         <strong>Wixstars Casino Review</strong>
//         <div class="relevant-pages-for-shop__card-stats">
//           <span class="rating">4.4</span><span class="stars">...</span>
//           <span class="rating-text"><span>Very Good</span> (148 votes)</span>
//         </div>
//       </a>
//       <a class="relevant-pages-for-shop__card relevant-pages-for-shop__card--bonus"
//          href="/bonus-blog/casino/wixstars-casino-bonus-codes">
//         <strong>Wixstars Casino Bonus Codes</strong><span>517 active bonuses</span>
//       </a>
//     </div>
//   </section>
//
// NOTE: the casino name (and the slug inside the hrefs) can change per item, so
// the tests assert only casino-name-INDEPENDENT things: the stable "Relevant
// pages for" heading prefix and href PATTERNS, never the literal "Wixstars".
// ---------------------------------------------------------------------------

// Brand accent colours of the card titles (stable, not tied to the casino).
const COLORS = {
  h2:          'rgb(64, 64, 64)',
  casinoTitle: 'rgb(66, 155, 244)', // blue
  bonusTitle:  'rgb(255, 81, 88)',  // red
};

test.describe('Chipy single item - Relevant Pages section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded' });
  });

  const section    = (page) => page.locator('section.relevant-pages-for-shop');
  const casinoCard = (page) => section(page).locator('a.relevant-pages-for-shop__card--casino');
  const bonusCard  = (page) => section(page).locator('a.relevant-pages-for-shop__card--bonus');

  // ---------------------------------------------------------------------------
  // 1) THE H2 (casino-name INDEPENDENT)
  // ---------------------------------------------------------------------------
  test('H2 shows the "Relevant pages for" heading without hardcoding the casino name', async ({ page }) => {
    const h2 = section(page).locator('h2');
    await expect(h2).toBeVisible();
    // Only assert the stable prefix - the casino name after it can change.
    await expect(h2).toContainText('Relevant pages for');
  });

  // ---------------------------------------------------------------------------
  // 2) THE TWO CARDS: ELEMENTS + LINKS
  // ---------------------------------------------------------------------------
  test('Both relevant-page cards show their elements and link correctly', async ({ page }) => {
    await expect(section(page)).toBeVisible();
    await expect(section(page).locator('.relevant-pages-for-shop__card')).toHaveCount(2);

    // --- Casino review card ---
    const casino = casinoCard(page);
    await expect(casino).toBeVisible();
    // Link points to a casino review page (slug varies, so match the pattern).
    await expect(casino).toHaveAttribute('href', /^\/casinos\/.+-review$/);
    // Title + rating stats.
    await expect(casino.locator('strong')).toBeVisible();
    expect((await casino.locator('strong').innerText()).trim().length).toBeGreaterThan(0);
    await expect(casino.locator('.rating')).toHaveText(/^\d+(\.\d+)?$/);
    await expect(casino.locator('.stars')).toBeVisible();
    await expect(casino.locator('.rating-text')).toContainText(/votes/i);

    // --- Bonus codes card ---
    const bonus = bonusCard(page);
    await expect(bonus).toBeVisible();
    // Link points to the casino's bonus-codes page (slug varies).
    await expect(bonus).toHaveAttribute('href', /^\/bonus-blog\/casino\/.+-bonus-codes$/);
    await expect(bonus.locator('strong')).toBeVisible();
    expect((await bonus.locator('strong').innerText()).trim().length).toBeGreaterThan(0);
    // Sub-line, e.g. "517 active bonuses".
    await expect(bonus.locator('span')).toContainText(/active bonuses/i);
  });

  // ---------------------------------------------------------------------------
  // 3) THE CARD TITLES USE THE EXPECTED TEXT COLORS
  // ---------------------------------------------------------------------------
  test('Heading and card titles use the expected text colors', async ({ page }) => {
    await expect(section(page).locator('h2')).toHaveCSS('color', COLORS.h2);
    await expect(casinoCard(page).locator('strong')).toHaveCSS('color', COLORS.casinoTitle);
    await expect(bonusCard(page).locator('strong')).toHaveCSS('color', COLORS.bonusTitle);
  });

  // ---------------------------------------------------------------------------
  // 4) A CARD LINK ACTUALLY NAVIGATES
  // ---------------------------------------------------------------------------
  test('Clicking the casino review card opens a casino review page', async ({ page }) => {
    await casinoCard(page).click();
    await expect(page).toHaveURL(/\/casinos\/.+-review$/);
  });

  // ---------------------------------------------------------------------------
  // 5) THE CASINO VOTE COUNT MATCHES THE CASINO REVIEW PAGE
  // ---------------------------------------------------------------------------
  test('Casino card vote count matches the casino review page', async ({ page }) => {
    const votesOf = (s) => {
      const m = (s || '').match(/([\d,]+)\s*votes/i);
      return m ? parseInt(m[1].replace(/,/g, ''), 10) : NaN;
    };

    // Save the vote count shown on the item's casino card, e.g. "(148 votes)".
    const card = casinoCard(page);
    const cardVotes = votesOf(await card.locator('.rating-text').innerText());
    expect(Number.isFinite(cardVotes)).toBe(true);

    // Go to the casino review page.
    await card.click();
    await expect(page).toHaveURL(/\/casinos\/.+-review$/);

    // The review page shows the same vote count.
    const pageVotes = votesOf(await page.locator('.casino-score__votes').first().innerText());
    expect(pageVotes).toBe(cardVotes);
  });
});




