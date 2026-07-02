// =============================================================================
// HOW TO RUN THIS TEST (Cloudflare workaround via CDP)
// =============================================================================
// Same setup as the other shop tests: start a manual Chrome with a debug port,
// pass Cloudflare once, then this test attaches to it (see ../fixtures.js).
//
//   1) Start Chrome with debugging (PowerShell terminal in VS Code):
//        Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
//          -ArgumentList '--remote-debugging-port=9222', `
//                        '--user-data-dir=C:\Temp\chrome-cdp', `
//                        'https://dev.chipy.com/shop'
//   2) In that window, pass Cloudflare if asked and wait for the shop to load.
//   3) Run the test:
//        npx playwright test tests/chipy-shop-SEO.spec.js --workers=1
//
// Ask Claude in chat: "Start Chrome with debugging on port 9222 and run
// tests/shop/chipy-shop-SEO.spec.js". Claude starts Chrome and runs the test;
// you still pass Cloudflare by hand if a challenge appears.
// =============================================================================
const { test, expect } = require('../support/cdp');

const SHOP_URL = "https://dev.chipy.com/shop";

// NOTE: the dashes in "hard-earned" / "real-money" below are non-breaking
// hyphens (U+2011), not regular "-". They are copied verbatim from the page so
// the assertion matches exactly.
const EXPECTED = {
  h1: "Let's Shop - Buy Awesome Items with Chipy Coins!",
  title: "Chipy.com Shop - Turn Your Coins Into Cash, Bonuses & Avatars",
  description:
    "Welcome to the Chipy Shop! Trade your hard-earned coins for real-money rewards, bonus codes, or avatar items and level up your experience.",
  canonical: "https://dev.chipy.com/shop",
  alternates: [
    { hreflang: "en", href: "https://dev.chipy.com/shop" },
    { hreflang: "de", href: "https://dev.chipy.com/de/shop" },
    { hreflang: "es", href: "https://dev.chipy.com/es/tienda" },
    { hreflang: "ru", href: "https://dev.chipy.com/ru/magazin" },
  ],
};

test("Shop SEO - title, h1, meta description, canonical and hreflang alternates", async ({
  page,
}) => {
  // Open the shop page.
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });

  // 1) The visible page heading (<h1>) must match exactly.
  await expect(page.locator("h1")).toHaveText(EXPECTED.h1);

  // 2) The browser tab / <title> tag must match exactly.
  await expect(page).toHaveTitle(EXPECTED.title);

  // 3) The <meta name="description"> tag's "content" attribute must match.
  const metaDescription = page.locator('meta[name="description"]');
  await expect(metaDescription).toHaveAttribute("content", EXPECTED.description);

  // 4) The canonical <link> must point to the shop URL.
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", EXPECTED.canonical);

  // 5) There must be exactly 4 alternate (hreflang) <link> tags...
  const alternates = page.locator('link[rel="alternate"]');
  await expect(alternates).toHaveCount(4);

  // ...and each language must point to its expected URL.
  for (const alt of EXPECTED.alternates) {
    // Select the alternate link for this specific language.
    const link = page.locator(`link[rel="alternate"][hreflang="${alt.hreflang}"]`);
    // It must exist (exactly one) and have the expected href.
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", alt.href);
  }
});




