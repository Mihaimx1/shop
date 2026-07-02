// =============================================================================
// HOW TO RUN THIS TEST (Cloudflare workaround via CDP)
// =============================================================================
// Same setup as the Real Money test: start a manual Chrome with a debug port,
// pass Cloudflare once, then this test attaches to it (see ../fixtures.js).
//
//   1) Start Chrome with debugging (PowerShell terminal in VS Code):
//        Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
//          -ArgumentList '--remote-debugging-port=9222', `
//                        '--user-data-dir=C:\Temp\chrome-cdp', `
//                        'https://dev.chipy.com/shop'
//   2) In that window, pass Cloudflare if asked and wait for the shop to load.
//   3) Run the test:
//        npx playwright test tests/chipy-shop-level-bar-filter.spec.js --workers=1
//
// Ask Claude in chat: "Start Chrome with debugging on port 9222 and run
// tests/shop/chipy-shop-level-bar-filter.spec.js". Claude starts Chrome and
// runs the test; you still pass Cloudflare by hand if a challenge appears.
// =============================================================================
const { test, expect } = require('../support/cdp');

test("Level filter", async ({ page }) => {
  // The dev server builds the slider widget slowly (lazy init on scroll), so
  // give this test extra time beyond the default 50s.
  test.setTimeout(120000);

  // Open the shop page.
  await page.goto("https://dev.chipy.com/shop");

  // Locator for the results counter (the number of items currently matching).
  const resultsLocator = page.locator(
    "div[class='shop-manage-panel__total'] span",
  );

  // Remember the counter text BEFORE filtering, so we can detect when it changes.
  const initialText = await resultsLocator.textContent();

  // The level filter is a noUiSlider with two handles (a min and a max).
  // We only move the LOWER handle, which sets the minimum level.
  const sliderBar = page.locator("#level-range"); // the slider track
  const lowerHandle = page.locator(".noUi-handle-lower"); // the left/min handle

  // The slider widget is built lazily and, on this dev server, relying on a
  // scroll to trigger that build is unreliable (it often never appears). What
  // DOES reliably build it is interacting with the filter panel. So we select
  // the "Real Money" filter and immediately deselect it: that forces the panel
  // (and the slider) to render, while leaving the list back in its full,
  // unfiltered state - exactly where we want to start the level test from.
  const realMoneyFilterBtn = page.getByRole("button", {
    name: "Real Money",
    exact: true,
  });
  await realMoneyFilterBtn.scrollIntoViewIfNeeded();

  // SELECT Real Money (retry the click until the button is marked "active").
  await expect(async () => {
    const isActive = await realMoneyFilterBtn.evaluate((el) =>
      el.classList.contains("active"),
    );
    if (!isActive) await realMoneyFilterBtn.click();
    await expect(realMoneyFilterBtn).toHaveClass(/\bactive\b/);
  }).toPass({ timeout: 15000 });

  // DESELECT Real Money (retry the click until it is no longer "active").
  await expect(async () => {
    const isActive = await realMoneyFilterBtn.evaluate((el) =>
      el.classList.contains("active"),
    );
    if (isActive) await realMoneyFilterBtn.click();
    await expect(realMoneyFilterBtn).not.toHaveClass(/\bactive\b/);
  }).toPass({ timeout: 15000 });

  // Wait until the counter returns to its original (unfiltered) value, so we
  // start the level filtering from the same state as a fresh page.
  await expect(resultsLocator).toHaveText(initialText, { timeout: 10000 });

  // The slider is now built - wait for its lower handle to be visible.
  await lowerHandle.waitFor({ state: "visible", timeout: 30000 });

  // Drag the lower handle to level 15. The scale is 0..20, so 15 sits at 75%
  // across the track. We wrap the drag in expect(...).toPass so that if the
  // drag lands a pixel off (14 or 16), the whole block retries until it reads 15.
  await expect(async () => {
    const barBox = await sliderBar.boundingBox(); // track position & size
    const handleBox = await lowerHandle.boundingBox(); // handle position & size
    const handleY = handleBox.y + handleBox.height / 2; // vertical center (unchanged)
    const targetX = barBox.x + barBox.width * (15 / 20); // x for value 15 (75%)

    // Press the mouse on the handle, move it to the 15 position, then release.
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleY);
    await page.mouse.down();
    await page.mouse.move(targetX, handleY, { steps: 10 }); // move in small steps
    await page.mouse.up();

    // Confirm the handle's value is exactly 15; if not, the block retries.
    await expect(lowerHandle).toHaveAttribute("aria-valuenow", "15.0");
  }).toPass({ timeout: 15000 });

  // Releasing the handle re-runs the filter, so the counter should now differ
  // from its initial value. Wait for that change before reading anything.
  await expect(resultsLocator).not.toHaveText(initialText, { timeout: 10000 });

  // Wait until the filtered data has finished loading (no network in flight).
  await page.waitForLoadState("networkidle");

  // The "Available Items" list (the first results list on the page).
  const availableItemsSection = page
    .locator(".shop-main-section__list")
    .first();

  // "Load More" button inside that list, if present. Keep clicking it until it
  // disappears, so EVERY matching card is rendered before we count and check.
  const loadMore = availableItemsSection.locator("button.shop-load-more");
  await expect(async () => {
    if (await loadMore.isVisible()) await loadMore.click();
    await expect(loadMore).toBeHidden();
  }).toPass({ timeout: 30000 });

  // Read the counter (e.g. "8") now that the filter is applied and all loaded.
  const resultsText = await resultsLocator.textContent();
  const resultsNumber = parseInt(resultsText);
  console.log(`Total results after filtering: ${resultsNumber}`);

  if (resultsNumber === 0) {
    // No results: the empty-state message must show instead of cards.
    const noResults = page.locator("span.no-results-text");
    await expect(noResults).toBeVisible();
    await expect(noResults).toHaveText(
      "No items found matching your criteria.",
    );
  } else {
    // There are results: the rendered card count must equal the counter, and
    // every card's required level must be 15 or higher.

    // All cards inside the "Available Items" list.
    const cards = availableItemsSection.locator("article.shop-card");

    // The number of rendered cards must match the counter.
    const cardsCount = await cards.count();
    expect(cardsCount).toBe(resultsNumber);

    // Pull the stats text of every card (each looks like "85 Level 20+").
    const statsTexts = await availableItemsSection
      .locator("article.shop-card .shop-card__stats")
      .allTextContents();

    // For each card, extract its level number and assert it is at least 15.
    for (const stats of statsTexts) {
      // Capture the digits right after the word "Level" (e.g. 20 in "Level 20+").
      const match = stats.match(/Level\s*(\d+)/);
      // Convert the captured digits into a number (NaN if not found).
      const level = match ? parseInt(match[1], 10) : NaN;
      // The item's minimum level must be 15 or higher.
      expect(level).toBeGreaterThanOrEqual(15);
    }
  }
});




