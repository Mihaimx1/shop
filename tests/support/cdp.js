// Shared Playwright fixtures with an optional CDP attachment flow.
//
// When `CDP_URL` is set, the tests reuse an already-open Chrome session
// instead of launching a new browser. This is useful when a manual browser
// session is required before the automated assertions can continue.
const base = require('@playwright/test');

const CDP_URL = process.env.CDP_URL;

const test = CDP_URL
  ? base.test.extend({
      context: async ({}, use) => {
        const browser = await base.chromium.connectOverCDP(CDP_URL);
        const context = browser.contexts()[0] || (await browser.newContext());
        await use(context);
      },
      page: async ({ context }, use) => {
        const page = context.pages()[0] || (await context.newPage());
        await use(page);
      },
    })
  : base.test;

module.exports = { test, expect: base.expect };
