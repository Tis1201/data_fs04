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

## APK Test Files

APK files are **not committed to this repository**. If you are running test cases that require an APK file, you must prepare them locally before running.

The following test cases in `tests/resources/` require APK files:

| Test Case | Required config | Description |
|---|---|---|
| TC-RS-031 | `apkFile` + `apkFileHigher` | Upload APK with lower version after a higher-version APK |
| TC-RS-032 | `apkFile` + `apkFileHigher` | Upload APK with higher version after a lower-version APK |
| TC-RS-035 | `apkFile` | Newly created APK appears at top of Install Resources picker |
| TC-RS-036 | `apkFile` | Upload APK and ZIP back-to-back (cross-type coexistence) |
| TC-RS-037 | `apkFile` | APK and ZIP with identical display name — both allowed |

**Setup steps:**

1. Prepare **two APK files** with the **same `packageName`** but **different `versionName`** (e.g. `v1.0` and `v2.0`).
2. Place them in the `static/` directory:
   ```
   automation_test/static/<yourapp>_v1.apk    ← apkFile (lower version)
   automation_test/static/<yourapp>_v2.apk    ← apkFileHigher (higher version)
   ```
3. Update the paths in `config/environments/dev.js`:
   ```js
   apkFile: 'static/<yourapp>_v1.apk',
   apkFileHigher: 'static/<yourapp>_v2.apk',
   ```

> If `apkFile` is not configured, all APK-dependent test cases will be **automatically skipped** — they will not cause failures.

---

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