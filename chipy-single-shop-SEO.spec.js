const { test, expect } = require('./cdp-fixtures');
const ITEM_URL = 'https://dev.chipy.com/item-name/311-free-spins-test';

// Expected SEO values for this item
const EXPECTED = {
  title:       '311 Free Spins Test',   
  description: '311 Free Spins Test',   
  h1:          '311 Free Spins test',   
  canonical:   ITEM_URL,                

  // save the alternates
  alternates: {
    en: ITEM_URL,
    de: 'https://dev.chipy.com/de/artikelname/150-freispiele-fuer-tarot-destiny-bei-diamond-reels',
    es: 'https://dev.chipy.com/es/nombre-articulo/311-free-spins-test',
    ru: 'https://dev.chipy.com/ru/nazvanie-tovara/311-free-spins-test-ru',
  },
};

test.describe('Chipy single item - SEO (title, meta description, H1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded' });
  });

  // ---------------------------------------------------------------------------
  // 1) META TITLE
  // ---------------------------------------------------------------------------
  test('Meta title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(EXPECTED.title);
  });

  // ---------------------------------------------------------------------------
  // 2) META DESCRIPTION
  // ---------------------------------------------------------------------------
  test('Meta description is present and correct', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveCount(1);
    await expect(metaDescription).toHaveAttribute('content', EXPECTED.description);
  });

  // ---------------------------------------------------------------------------
  // 3) H1
  // ---------------------------------------------------------------------------
  test('Page has exactly one H1 with the expected text', async ({ page }) => {
    const h1 = page.locator('h1');
    // SEO best practice: check for a single H1 per page
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(EXPECTED.h1);
  });

  // ---------------------------------------------------------------------------
  // 4) CANONICAL (bonus SEO check)
  // ---------------------------------------------------------------------------
  test('Canonical link points to this item page', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', EXPECTED.canonical);
  });

  // ---------------------------------------------------------------------------
  // 5) HREFLANG ALTERNATES (other language versions)
  // ---------------------------------------------------------------------------
  test('Page exposes the expected hreflang alternates', async ({ page }) => {
    const alternates = page.locator('link[rel="alternate"][hreflang]');

    // check if no alternate is missing or extra
    await expect(alternates).toHaveCount(Object.keys(EXPECTED.alternates).length);

    // Each language points at the right URL.
    for (const [lang, href] of Object.entries(EXPECTED.alternates)) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveAttribute('href', href);
    }

    // The "en" alternate should match the canonical (this page itself).
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', EXPECTED.canonical);
  });
});
