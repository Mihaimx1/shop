// Shared test fixtures with an optional Cloudflare workaround.
//
// The shop site sits behind Cloudflare, which blocks Playwright's own freshly
// launched browser. To get around it, launch a REAL Chrome with a debug port,
// solve the Cloudflare challenge by hand, then have the tests ATTACH to that
// already-open browser over CDP (the Cloudflare clearance cookie lives in that
// session, so the tests are let through).
//
//   1) CHROME=$(ls -d /home/razvani/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | sort -V | tail -1)
//      "$CHROME" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp https://dev.chipy.com/shop &
//   2) (in that window) pass the Cloudflare check so the shop page loads
//   3) CDP_URL=http://localhost:9222 npx playwright test shop/ --project=chromium --workers=1
//
// When CDP_URL is NOT set, this behaves exactly like `@playwright/test` and the
// tests launch their own browser as usual.
const base = require('@playwright/test');

const CDP_URL = process.env.CDP_URL; // e.g. http://localhost:9222

const test = CDP_URL
  ? base.test.extend({
      // Reuse the context/page from the manually-opened Chrome instead of
      // letting Playwright launch and close its own browser.
      context: async ({}, use) => {
        const browser = await base.chromium.connectOverCDP(CDP_URL);
        const context = browser.contexts()[0] || (await browser.newContext());
        await use(context);
        // Intentionally do NOT close — it's the user's manual Chrome.
      },
      page: async ({ context }, use) => {
        const page = context.pages()[0] || (await context.newPage());
        await use(page);
      },
    })
  : base.test;

module.exports = { test, expect: base.expect };
