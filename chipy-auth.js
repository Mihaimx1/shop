// Shared login helper for the (Cloudflare-cleared) Chipy dev site.
//
// The site logs users in through a popup that is opened from the header. When
// logged in, <body> gains the `user-logged-in` class, which is what the rest of
// the tests key off. Login markup (captured from dev):
//
//   .header-login-items .log-out.non-user .log-out__open   -> "Log in" trigger
//   #login_input_username / #login_input_password          -> the fields
//   .btn-submit.login_exec                                 -> the submit button
//
// The trigger's click handler is bound only once the large deferred JS bundle
// has run, so opening the popup is retried until the username field appears.
//
// Usage:  await ensureLoggedIn(page, { username: 'crosby54', password: 'q1w2e3r4' });
const { expect } = require('@playwright/test');

/**
 * Logs in via the header popup, unless already logged in. Safe to call in every
 * beforeEach — it's a no-op when the session is already authenticated.
 */
async function ensureLoggedIn(page, { username, password }) {
  const alreadyIn = await page.evaluate(() => document.body.classList.contains('user-logged-in'));
  if (alreadyIn) return;

  // Open the login popup from the header. Retry the click until the field shows
  // (the handler attaches after deferred.js loads, so early clicks no-op).
  const user = page.locator('#login_input_username');
  await expect(async () => {
    await page.locator('.header-login-items .log-out.non-user .log-out__open').first().click({ force: true });
    await expect(user).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  // Fill the credentials and submit.
  await user.fill(username);
  await page.locator('#login_input_password').fill(password);
  await page.locator('.btn-submit.login_exec').click();

  // The login is confirmed once <body> flips to the logged-in state (the popup
  // does this after the request resolves; the page may reload in the process).
  await page.waitForFunction(() => document.body.classList.contains('user-logged-in'), null, {
    timeout: 15000,
  });
}

module.exports = { ensureLoggedIn };
