// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Path to the authentication state file - use absolute path for reliability
const authFile = path.resolve(__dirname, 'user.json');
console.log(`authFile: ${authFile}`);

// Determine if tests should run headless or with browser visible
// Use: npx playwright test --headed
// or set HEADLESS=0 in your environment
const headless = process.env.HEADLESS !== '0';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    /.*(\.|-)(test|spec)\.[cm]?[jt]sx?$/,
    /.*[\\/]actions[\\/][^\\/]+[\\/]index\.js$/,
  ],
  timeout: 180 * 1000, // Increase timeout for auth processes
  expect: {
    timeout: 10000  // Increase assertion timeout
  },
  /* Run tests in files in parallel */
  fullyParallel: false, // Set to false to ensure tests don't interfere with each other
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 0 : 0, // Add a retry for more stability
  /* Opt out of parallel tests on CI. */
  workers: 1, // Use a single worker to avoid auth conflicts
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
reporter: [
  ['list'],
  ['./reporters/usecase-reporter.js'],
],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    headless,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
    trace: 'on-first-retry',
    launchOptions: {
      slowMo: 300,
    },
    // Set storage state for all browsers
    storageState: fs.existsSync(authFile) ? authFile : undefined,
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        // Use stored auth state explicitly
        storageState: authFile,
      },
    },
    // {
    //   name: 'firefox',
    //   use: { 
    //     browserName: 'firefox',
    //     storageState: fs.existsSync(authFile) ? authFile : undefined,
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: { 
    //     browserName: 'webkit',
    //     storageState: fs.existsSync(authFile) ? authFile : undefined,
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

