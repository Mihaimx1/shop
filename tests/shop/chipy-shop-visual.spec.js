const { test, expect } = require('../support/cdp');
const fs = require('fs');
const path = require('path');
const {
  prepareShopVisualPage,
  loadShopLazyContent,
  shopScreenshotOptions,
} = require('../support/visual');

// Visual regression test for the shop page.
//
// The first run creates the baseline PNG automatically if it does not exist.
// Later runs compare the live page against that stored file.
// We hide the parts of the page that change across sessions so the screenshot
// stays stable over time.
test.describe('Chipy Shop - visual baseline', () => {
  test('Full-page screenshot matches the stored baseline', async ({ page }) => {
    test.setTimeout(120000);

    await prepareShopVisualPage(page);
    await loadShopLazyContent(page);

    // Wait for the main content to settle before comparing pixels.
    await expect(page.getByRole('heading', { name: "Let's Shop - Buy Awesome Items with Chipy Coins!" }))
      .toBeVisible();

    const snapshotPath = test.info().snapshotPath('shop-full-page.png');
    if (!fs.existsSync(snapshotPath)) {
      await fs.promises.mkdir(path.dirname(snapshotPath), { recursive: true });
      await page.screenshot({
        path: snapshotPath,
        ...shopScreenshotOptions(),
      });
      console.log(`Created visual baseline: ${snapshotPath}`);
      return;
    }

    await expect(page).toHaveScreenshot(
      'shop-full-page.png',
      shopScreenshotOptions(),
    );
  });
});
