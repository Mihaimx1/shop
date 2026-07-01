# Playwright Tests for Shop Application

This repository contains Playwright tests for a shop application, designed to work around Cloudflare protection using the Chrome Debugging Protocol (CDP).

## Project Structure

```
.github/
  workflows/
    playwright.yml
reports/ (ignored by Git)
scripts/
  launchChrome.js
  run-tests.js
tests/
  _cdp.js
  fixtures.js
  chipy/
    chipy-shop-SEO.spec.js
    chipy-shop-by-category.spec.js
    chipy-shop-level-bar-filter.spec.js
    chipy-shop-real-money-filter.spec.js
    shop/
      chipy-shop-Q&As.spec.js
      chipy-shop-article-section.spec.js
      chipy-shop-create-account-block.spec.js
      chipy-shop-filter-avatars.spec.js
      chipy-shop-filter-bonuses.spec.js
      chipy-shop-page-contributors.spec.js
      chipy-shop-raffles.spec.js
      chipy-shop-sold-out-items.spec.js
      chipy-shop-sortbar.spec.js
      chipy-shop-upper-section.spec.js
.env.example
.gitignore
package.json
playwright.config.js
README.md
```

**Important:** No existing test files in the `tests/` directory have been modified. Their imports and relative paths remain exactly as they were.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Mihaimx1/shop.git
    cd shop
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create `.env` file:**
    Copy `.env.example` to `.env` and update the `SHOP_URL` if necessary.
    ```bash
    cp .env.example .env
    ```

## How to Run Tests

These tests utilize the Chrome Debugging Protocol (CDP) to bypass Cloudflare protection. This requires a manually launched Chrome instance with remote debugging enabled.

### Manual Execution (Recommended for initial setup and debugging)

1.  **Launch Chrome with remote debugging:**

    **On Windows (PowerShell):**
    ```powershell
    Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
      -ArgumentList '--remote-debugging-port=9222', `
                    '--user-data-dir=C:\Temp\chrome-cdp', `
                    'https://dev.chipy.com/shop'
    ```

    **On Linux/macOS (Bash):**
    ```bash
    google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp https://dev.chipy.com/shop &
    # Or if google-chrome is not found, try chromium-browser
    # chromium-browser --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp https://dev.chipy.com/shop &
    ```

    *   **Important:** After launching Chrome, if a Cloudflare challenge appears, solve it manually in the opened browser window. Once cleared, the tests should be able to run without further intervention as the clearance cookie is saved in the user data directory.

2.  **Run Playwright tests:**

    Once Chrome is launched and the shop page is accessible, you can run the tests. The `CDP_URL` environment variable will be automatically set by the `run-tests.js` script.

    To run all tests:
    ```bash
    npm run test:cdp
    ```

    To run a specific test file (e.g., `chipy-shop-real-money-filter.spec.js`):
    ```bash
    node scripts/run-tests.js tests/chipy/chipy-shop-real-money-filter.spec.js
    ```

### Automated Execution (via `npm` scripts)

-   **`npm run test:shop`**: Runs all tests located in `tests/chipy/shop/`.
    ```bash
    npm run test:shop
    ```

-   **`npm run test:all`**: Runs all Playwright tests in the `tests/` directory without the CDP workaround (Playwright will launch its own browser). This might be blocked by Cloudflare.
    ```bash
    npm run test:all
    ```

-   **`npm run test:cdp`**: Launches Chrome with remote debugging (using `scripts/launchChrome.js`), waits for the CDP endpoint, sets `CDP_URL`, and then runs all Playwright tests using the CDP connection. This is the recommended script for automated execution with the Cloudflare workaround.
    ```bash
    npm run test:cdp
    ```

## CI/CD with GitHub Actions

The `.github/workflows/playwright.yml` file configures GitHub Actions to run the tests on `ubuntu-latest` and `windows-latest` environments upon push or pull request to the `main` branch.

**Note on Cloudflare in CI/CD:**
Cloudflare might detect the GitHub Actions environment as suspicious, potentially leading to challenges. The current workflow attempts to use the CDP workaround, but a fully automated bypass for Cloudflare in a headless CI/CD environment can be complex and may require additional strategies (e.g., using a proxy, specific browser headers, or a CAPTCHA solving service) which are beyond the scope of this setup. For robust CI/CD, you might need to investigate these options or consider running tests against a staging environment without Cloudflare protection.

## Transferring to a Company Organization

To transfer this repository to a company organization on GitHub:

1.  **Ensure you have the necessary permissions:** You must have owner permissions in the target organization and admin permissions on the repository you wish to transfer.
2.  **Navigate to repository settings:** On GitHub, go to your repository's page, then click on "Settings".
3.  **Find "Transfer ownership":** Scroll down to the "Danger Zone" section and click on "Transfer".
4.  **Select the new owner:** In the dialog box, type the name of the target organization.
5.  **Confirm transfer:** Follow the prompts to confirm the transfer. You will need to enter your password.

After the transfer, the repository will belong to the organization, and its visibility (public/private) can be managed by the organization's administrators. Ensure that any sensitive environment variables or secrets are properly configured within the organization's GitHub Actions secrets after the transfer.
