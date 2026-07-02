# Test Infrastructure

This repository keeps the browser tests under `tests/shop`, with shared support
code and runner helpers around them.

## Files

- `playwright.config.js` defines the global Playwright defaults, browser
  project, retry policy, and output settings.
- `tests/support/cdp.js` exports the shared `test` and `expect` fixtures. It
  can reuse a live Chrome session through `CDP_URL` when manual browser setup
  is needed.
- `tests/_cdp.js` stays as a compatibility wrapper for the existing specs.
- `scripts/launchChrome.js` starts a local Chrome instance with remote
  debugging enabled so Playwright can attach over CDP. It uses a persistent
  Chrome profile by default.
- `scripts/run-tests.js` orchestrates the CDP flow: launch Chrome, wait for the
  debugging endpoint, pause for manual Cloudflare handling, and run Playwright
  with the right environment.
- `package.json` exposes the supported entry points for running the suite.

## Usage

- `npm run test:shop` runs the shop spec folder directly.
- `npm run test:all` runs all Playwright specs under `tests`.
- `npm run test:cdp` launches Chrome and then runs the suite through the CDP
  helper. The runner pauses after Chrome opens so you can pass Cloudflare and
  press Enter to continue.

## Persistent Profile

- The default Chrome profile lives outside the repo at
  `%USERPROFILE%\.chipy-shop\chrome-profile` on Windows.
- Set `CHROME_PROFILE_MODE=temporary` if you want a fresh profile for one run.
- Set `CHROME_PROFILE_DIR` if you want to point Chrome at a custom profile
  location.

## Notes

- The real test scenarios were kept intact.
- The support layer was cleaned up to use ASCII-only comments and safer process
  spawning.
