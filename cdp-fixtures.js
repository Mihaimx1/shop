// Shared test fixtures with the Cloudflare workaround (works on Linux & Windows).
//
// The shop site sits behind Cloudflare, which blocks Playwright's own freshly
// launched browser. So the tests ATTACH over CDP to a REAL Chrome you launch by
// hand (the Cloudflare clearance cookie lives in that session, so they pass).
//
// Linux:
//   1) CHROME=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | sort -V | tail -1)
//      "$CHROME" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp https://dev.chipy.com/shop &
// Windows (PowerShell):
//   1) & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Temp\chrome-cdp" https://dev.chipy.com/shop
//
//   2) pass the Cloudflare check in that window
//   3) npx playwright test --workers=1        (then: npx playwright show-report)
//
// The tests attach to http://localhost:9222 by default; override with the
// CDP_URL env var if you used a different port.
const base = require('@playwright/test');

const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';

const test = base.test.extend({
  // Reuse the context/page from the manually-opened Chrome instead of letting
  // Playwright launch (and close) its own browser.
  context: async ({}, use) => {
    const browser = await base.chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0] || (await browser.newContext());
    await use(context);
    // Intentionally do NOT close — it's your manual Chrome session.
  },
  page: async ({ context }, use) => {
    // Pick the real site tab — skip DevTools / about:blank / extension pages,
    // otherwise pages()[0] can be a `devtools://` tab and tests run on the
    // wrong page.
    const pages = context.pages();
    const page =
      pages.find((p) => /^https?:\/\//.test(p.url())) ||
      pages[0] ||
      (await context.newPage());
    await use(page);
  },
});

module.exports = { test, expect: base.expect };
