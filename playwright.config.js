const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://localhost:5000';

module.exports = defineConfig({
  testDir: './tests/mobile',
  timeout: 45_000,
  workers: 1,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-small-android',
      use: { browserName: 'chromium', ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-large-android',
      use: { browserName: 'chromium', ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-ios',
      use: { browserName: 'chromium', ...devices['iPhone 12'] },
    },
    {
      name: 'tablet-ios',
      use: { browserName: 'chromium', ...devices['iPad Mini'] },
    },
  ],
  webServer: {
    command: 'node index.js',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PORT: '5000',
      NODE_ENV: 'test',
    },
  },
});
