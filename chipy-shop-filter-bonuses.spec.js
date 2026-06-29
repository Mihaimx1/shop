const { test, expect } = require('../../_cdp');
const SHOP_URL = 'https://dev.chipy.com/shop';

// This file covers the "Shop Bonuses" category filter on the shop page.
//
// THE FILTER MARKUP (top of the shop items list):
//   <div class="shop-filters">
//     <div class="shop-filters__inner js-slider_section">
//       <button class="shop-filters__item shop-filters__item--radio" data-name="category-3">Real Money</button>
//       <button class="shop-filters__item shop-filters__item--radio" data-name="category-2">Shop Bonuses</button>
//       <button id="avatars" class="shop-filters__item shop-filters__item--toggler" data-name="category-1">Avatars</button>
//     </div>
//   </div>
//
// Each product is an <article class="shop-card"> whose logo <img> carries a
// data-type ("bonus", "real-money", "body", "eyes", ...). Selecting a filter
// hides the cards that don't match (display:none) and adds the active class
// to the chosen filter button.
//
// QUIRK ON THE CURRENT DEV BUILD (important for the click logic below):
// The filter slider (js-slider_section) lazily initialises on the FIRST user
// interaction, so the very first click on a filter is swallowed and does
// nothing. The second click actually filters. Clicking an already-active radio
// a further time toggles the filter back OFF (all items shown again).
// Because of this we click ONLY while the button is not yet active and retry
// until it activates â€” that is robust whether or not the first click is eaten,
// and never accidentally toggles the filter back off.
// ---------------------------------------------------------------------------
test.describe('Chipy Shop - Shop Bonuses filter', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  // ---------------------------------------------------------------------------
  // 1) THE "SHOP BONUSES" FILTER IS PRESENT
  // ---------------------------------------------------------------------------
  test('Shop Bonuses filter button is shown in the filter panel', async ({ page }) => {
    // The filter panel that holds the category buttons.
    const filterPanel = page.locator('.shop-filters');
    await expect(filterPanel).toBeVisible();

    // The "Shop Bonuses" filter itself: a radio-style filter button.
    const bonusesFilter = page.getByRole('button', { name: 'Shop Bonuses', exact: true });
    await expect(bonusesFilter).toBeVisible();
    await expect(bonusesFilter).toHaveClass(/shop-filters__item--radio/);

    // It is not selected by default.
    await expect(bonusesFilter).not.toHaveClass(/\bactive\b/);
  });

  // ---------------------------------------------------------------------------
  // 2) SELECTING "SHOP BONUSES" FILTERS THE LIST DOWN TO BONUS ITEMS
  // ---------------------------------------------------------------------------
  test('Selecting Shop Bonuses shows only bonus items', async ({ page }) => {
    const bonusesFilter = page.getByRole('button', { name: 'Shop Bonuses', exact: true });

    // Every shop card currently visible, and the bonus / non-bonus subsets.
    const visibleCards    = page.locator('article.shop-card:visible');
    const visibleBonus    = page.locator('article.shop-card:visible:has(img[data-type="bonus"])');
    const visibleNonBonus = page.locator('article.shop-card:visible:not(:has(img[data-type="bonus"]))');

    // ---- DEFAULT (no filter): the list is a mix of categories -------------
    const totalBefore = await visibleCards.count();
    expect(totalBefore).toBeGreaterThan(0);
    // Some non-bonus items (avatars / real money) are visible before filtering.
    expect(await visibleNonBonus.count()).toBeGreaterThan(0);

    // ---- SELECT THE "SHOP BONUSES" FILTER ---------------------------------
    // Click only while it is not yet active, retrying until it activates. This
    // absorbs the slider's swallowed first click without ever toggling an
    // already-active filter back off (see the quirk note at the top).
    await expect(async () => {
      const isActive = await bonusesFilter.evaluate((el) => el.classList.contains('active'));
      if (!isActive) await bonusesFilter.click();
      await expect(bonusesFilter).toHaveClass(/\bactive\b/);
    }).toPass({ timeout: 15000 });

    // ---- FILTERED STATE ----------------------------------------------------
    // Only bonus cards remain visible: there are some, and NONE of the visible
    // cards are non-bonus.
    expect(await visibleBonus.count()).toBeGreaterThan(0);
    await expect(visibleNonBonus).toHaveCount(0);

    // The filter genuinely narrowed the list (fewer cards than the full mix).
    expect(await visibleCards.count()).toBeLessThan(totalBefore);
    // Every visible card is a bonus card.
    expect(await visibleCards.count()).toBe(await visibleBonus.count());
  });

  // ---------------------------------------------------------------------------
  // 3) "LOAD MORE" LOADS EVERY ITEM AND THE TOTAL MATCHES THE RESULTS COUNTER
  // ---------------------------------------------------------------------------
  // The shop renders TWO section.shop-main-section blocks:
  //   - "Available Items"  -> has the filters, the results counter
  //                           (<div class="shop-manage-panel__total"><span>115</span> results</div>)
  //                           and the "Load More" button.
  //   - "Sold Out Items"   -> a separate list with its own cards, NO counter and
  //                           NO load-more.
  // The counter only describes the Available Items list, so everything here is
  // scoped to that section (the one that owns the manage panel) â€” otherwise the
  // sold-out cards would be counted too and the totals would never match.
  //
  // "Load More" appends the next batch of cards on each click and disappears
  // once every item is loaded. Once it is gone the rendered card count must
  // equal the number shown in the results counter.
  test('Load More loads all items and the count matches the results counter', async ({ page }) => {
    // The "Available Items" section: the only main section with a manage panel.
    const availableSection = page.locator('section.shop-main-section', {
      has: page.locator('.shop-manage-panel'),
    });

    const cards    = availableSection.locator('article.shop-card');
    const loadMore = availableSection.locator('button.shop-load-more');
    const counter  = availableSection.locator('.shop-manage-panel__total span');

    // The results counter, e.g. "115".
    const expectedCount = parseInt((await counter.innerText()).trim(), 10);
    expect(expectedCount).toBeGreaterThan(0);

    // Before loading more, only the first batch is rendered (fewer than total).
    expect(await cards.count()).toBeLessThan(expectedCount);

    // Click "Load More" until it disappears. Each click appends the next batch
    // and the button is removed (display:none) once every item is loaded. Note:
    // like the filter slider, the FIRST click is swallowed by lazy init, so we
    // just keep clicking while the button is visible and retry until it is gone
    // (self-healing â€” a swallowed click simply gets retried on the next pass).
    await expect(async () => {
      if (await loadMore.isVisible()) await loadMore.click();
      await expect(loadMore).toBeHidden();
    }).toPass({ timeout: 30000 });

    // Everything is loaded: the button is gone...
    await expect(loadMore).toBeHidden();
    // ...the rendered card count equals the results counter...
    await expect(cards).toHaveCount(expectedCount);
    // ...and every loaded card is a real product (has an item link).
    await expect(cards.locator('a[href^="/item-name/"]').first()).toBeVisible();
    expect(await cards.filter({ has: page.locator('a[href^="/item-name/"]') }).count())
      .toBe(expectedCount);
  });
});



// for run: Cei 3 pași — fă-i în ordine
// Pasul 1 — pornește un Chrome cu „debugging" activat. Deschide PowerShell și rulează:


//
// Se deschide o fereastră Chrome nouă, separată. (Dacă Chrome nu e la calea aia, zi-mi și-ți dau calea corectă.)


// Pasul 2 — treci de Cloudflare ca om. În acea fereastră Chrome, intră pe:


// https://dev.chipy.com/shop
// Rezolvă verificarea Cloudflare. De data asta va trece (e un Chrome real, fără urme de automatizare) și vei vedea produsele + filtrele. Lasă fereastra deschisă.

// Pasul 3 — rulează testul (în terminalul tău obișnuit, nu închide Chrome-ul):


// cd C:\Users\razva\playwright-project
// npx playwright test tests/chipy/shop/chipy-shop-filter-bonuses.spec.js --project="Google Chrome" --workers=1
// Testul va folosi tab-ul din Chrome-ul tău, unde Cloudflare e deja trecut.

// Note:

// Folosim --user-data-dir="C:\Temp\chrome-cdp" ca să fie un profil separat care reține verificarea Cloudflare — data viitoare nu mai trebuie s-o refaci.
// Dacă la pasul 1 zice că „Chrome already running", închide toate ferestrele Chrome întâi, apoi reia comanda.
// Spune-mi ce iese după pasul 3.