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
//        npx playwright test tests/chipy-shop-by-category.spec.js --workers=1
//
// Ask Claude in chat: "Pornește Chrome cu debugging pe portul 9222 și rulează
// testul tests/chipy-shop-by-category.spec.js" — Claude starts Chrome + runs the
// test; you still pass Cloudflare by hand if a challenge appears.
// =============================================================================
const { test, expect } = require("../fixtures");

const SHOP_URL = "https://dev.chipy.com/shop";
const SHOP_ORIGIN = "https://dev.chipy.com";

// What we expect each of the 3 category boxes to contain, in DOM order.
const EXPECTED_BOXES = [
  { name: "Real Money", alt: "real money icon" },
  { name: "Shop Bonuses", alt: "shop bonuses icon" },
  { name: "Avatars", alt: "avatars icon" },
];

test("Shop by Category - boxes, icons, names and counters match their pages", async ({
  page,
}) => {
  // Opening one category page per box means a bit more navigation, so allow
  // more time than the default 50s.
  test.setTimeout(120000);

  // Open the shop page.
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });

  // The whole "Shop by Category" section.
  const section = page.locator("section.shop-by-category");
  await expect(section).toBeVisible();

  // 1) The section heading must read "Shop by Category".
  await expect(section.locator("h2")).toHaveText("Shop by Category");

  // 2) There must be exactly 3 category boxes (one <li> per box).
  const boxes = section.locator(".shop-by-category__list > li");
  await expect(boxes).toHaveCount(3);

  // 3 + 4) Check each box's icon (by its alt text) and its name (the <strong>).
  for (let i = 0; i < EXPECTED_BOXES.length; i++) {
    const box = boxes.nth(i); // the i-th box
    // The icon image must have the expected alt text.
    await expect(box.locator("img")).toHaveAttribute(
      "alt",
      EXPECTED_BOXES[i].alt,
    );
    // The bold name (<strong>) must match the expected category name.
    await expect(box.locator("strong")).toHaveText(EXPECTED_BOXES[i].name);
  }

  // 5 + 6) Collect each box's item count and its link, BEFORE we navigate away
  // (once we leave the shop page this section no longer exists).
  const collected = [];
  for (let i = 0; i < EXPECTED_BOXES.length; i++) {
    const box = boxes.nth(i);

    // The counter text looks like "See 4 items" — grab the number out of it.
    const counterText = await box.locator("span").textContent();
    const boxCount = parseInt(counterText.replace(/\D/g, ""), 10); // keep digits only

    // The link the box points to (e.g. "/item-type/Real-Money").
    const href = await box.locator("a").getAttribute("href");

    collected.push({ name: EXPECTED_BOXES[i].name, boxCount, href });
  }
  console.log("Collected boxes:", JSON.stringify(collected));

  // 7) Open each box's link and check the page's own counter matches the box.
  for (const item of collected) {
    // Build an absolute URL (href is relative like "/item-type/Real-Money").
    const fullUrl = SHOP_ORIGIN + item.href;
    await page.goto(fullUrl, { waitUntil: "domcontentloaded" });

    // The results counter on the category page.
    const pageCounter = page.locator("div.shop-manage-panel__total > span");
    await expect(pageCounter).toBeVisible({ timeout: 15000 });

    // Read it and turn it into a number.
    const pageCount = parseInt((await pageCounter.textContent()).trim(), 10);
    console.log(`${item.name}: box=${item.boxCount}, page=${pageCount}`);

    // The box's "See N items" must equal the category page's own count.
    expect(pageCount).toBe(item.boxCount);
  }
});
