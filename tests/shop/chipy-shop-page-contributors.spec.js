const { test, expect } = require('../support/cdp');
const SHOP_URL = 'https://dev.chipy.com/shop';

// Covers the "Page Contributors" section of the shop page:
//   <div class="authors-section">
//     <h3 class="authors-section__title">Page Contributors</h3>
//     <div class="author-card">
//       <div class="author-card__main-info">
//         <div class="author-card__img"><img alt="Adela Ababi"></div>
//         <h2 class="author-card__name">Adela Ababi</h2>
//         <p class="author-card__role">Community Manager</p>
//         <ul class="author-card__socials"><li><a ...></li>...</ul>
//       </div>
//       <div class="author-card__content">
//         ... <a class="author-card__link" href="/author/adela-ababi">Read Full Bio</a>
//       </div>
//     </div> ...
//   </div>
//
// This section is OPTIONAL: a page may have no contributors at all. Every test
// first checks for the section and `test.skip()`s when it is absent.
// ---------------------------------------------------------------------------
test.describe('Chipy Shop - Page Contributors section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  const section = (page) => page.locator('.authors-section');
  const cards   = (page) => section(page).locator('.author-card');

  // Skip the test when the page has no Page Contributors section. Give the
  // server-rendered block a short chance to show, then decide.
  async function skipIfAbsent(page) {
    await section(page).first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    const present = (await section(page).count()) > 0;
    test.skip(!present, 'No Page Contributors section on this page');
  }

  // ---------------------------------------------------------------------------
  // 1) THE H3 HEADING
  // ---------------------------------------------------------------------------
  test('Section H3 heading has the expected text', async ({ page }) => {
    await skipIfAbsent(page);
    await expect(section(page).locator('h3.authors-section__title')).toHaveText('Page Contributors');
  });

  // ---------------------------------------------------------------------------
  // 2) EVERY CONTRIBUTOR CARD HAS THE EXPECTED ELEMENTS
  // ---------------------------------------------------------------------------
  test('Each contributor card shows the expected elements', async ({ page }) => {
    await skipIfAbsent(page);
    const list = cards(page);

    const count = await list.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = list.nth(i);

      // Avatar image.
      await expect(card.locator('.author-card__img img')).toBeVisible();

      // Name (non-empty) and role.
      const name = card.locator('.author-card__name');
      await expect(name).toBeVisible();
      expect((await name.innerText()).trim().length).toBeGreaterThan(0);
      await expect(card.locator('.author-card__role')).toBeVisible();

      // Social links are NOT mandatory - some contributors have none. The
      // socials list is part of the card; if it contains links, each must point
      // somewhere, but zero links is perfectly valid.
      await expect(card.locator('.author-card__socials')).toBeAttached();
      const socialLinks = card.locator('.author-card__socials a');
      for (let s = 0; s < (await socialLinks.count()); s++) {
        await expect(socialLinks.nth(s)).toHaveAttribute('href', /.+/);
      }

      // The "Read Full Bio" link points at the author's page.
      const bio = card.locator('a.author-card__link');
      await expect(bio).toHaveText('Read Full Bio');
      await expect(bio).toHaveAttribute('href', /^\/author\/.+/);
    }
  });

  // ---------------------------------------------------------------------------
  // 3) "READ FULL BIO" OPENS THE AUTHOR PAGE
  // ---------------------------------------------------------------------------
  test('Read Full Bio opens the contributor author page', async ({ page }) => {
    await skipIfAbsent(page);
    const card = cards(page).first();
    const bio  = card.locator('a.author-card__link');

    const href = await bio.getAttribute('href');
    const name = (await card.locator('.author-card__name').innerText()).trim();
    expect(href).toMatch(/^\/author\/.+/);

    await bio.click();

    // We land on that author's page, and its heading matches the contributor name.
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.locator('h1').first()).toHaveText(name);
  });
});




