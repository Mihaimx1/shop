const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120 * 1000,
  fullyParallel: false, // CDP requires serial execution
  workers: 1,
  retries: 2,
  reporter: 'html',
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...require('@playwright/test').devices['Desktop Chrome'] },
    },
  ],
});
