## Description
This project provides a robust, maintainable, and scalable end-to-end test automation framework using Playwright (JavaScript), structured with the Page Object Model (POM).

## Structure
```
e2e-tests/
├── assets/                     # Test assets (images, videos)
│   ├── image/                  # Image files for testing
│   └── video/                  # Video files for testing
├── config/                     # Configuration files
│   ├── config-loader.js        # Configuration loader utility
│   └── environments/           # Environment-specific configs
├── pages/                      # Page Object Model (POM) files
│   ├── asset/                  # Asset-related page objects
│   ├── organizations/          # Organization page objects
│   ├── playlist/               # Playlist page objects
│   └── *.js                    # Other page objects
├── tests/                      # Test files
├── utils/                      # Utility functions and helpers
├── playwright-report/          # Generated test reports
├── test-results/               # Test execution results
├── user-data-dir/              # Browser user data
├── playwright.config.js        # Playwright configuration
├── package.json                # Project dependencies
├── save-complete-auth.js       # Support persistent login
└── testrail-reporter.js        # Support upload test results to TestRail
```

## Installation
1. Checkout the branch e2e-auto and cd to the test project:
  ```bash
  cd e2e-tests
  ```
2. Install dependencies:
  ```bash
  npm install
  ```
3. Install Playwright browsers:
  ```bash
  npx playwright install
  ```
4. Add .env file in e2e-tests/:
  ```bash
  SWAGGER_API_KEY=api_key_value
  ```

## How to Run Tests
- Before running the test, run this to keep logged in:
```bash
node save-complete-auth.js 
```
- Run all tests:
```bash
npx playwright test
```
- Run a specific test file:
```bash
npx playwright test tests/user.test.js
```
- Run in headed mode (visible browser):
```bash
npx playwright test --headed
```
- Run and upload test results to TestRail:
```bash
TESTRAIL_RUN_ID=304 npx playwright test
```