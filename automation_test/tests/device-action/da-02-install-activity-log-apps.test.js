const base = require('@playwright/test');
const {
  expect,
  createInstallContext,
  installConfiguredApp,
  waitForInstalledAppVisible,
  cleanupInstalledApp,
  attachJson,
  setActualResult,
} = require('../../pages/devices/device-detail/test-helpers/install-test-helpers.js');
const { authFile } = require('./device-actions-shared');

// Rule 11.1 & 16.2: Use Fixture to initialize shared POM
const extendedTest = base.test.extend({
  page: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

const test = extendedTest;
test.use({ storageState: authFile });

test.describe('Section 1 — Install App Action: Activity Log and Installed Apps', () => {
  test('TC-DA-007~008: Install app and verify Activity Log and Installed Apps', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('Run main flow', async () => {
      const context = createInstallContext(page);
      let selectedRecord = null;
      let finalLog = null;

      try {
        const installResult = await installConfiguredApp(context);
        selectedRecord = installResult.selectedRecord;
        finalLog = installResult.finalLog;

        expect(
          installResult.installSucceeded,
          `Install did not finish successfully for "${selectedRecord.packageName}".`
        ).toBeTruthy();

        // TC-DA-008: verify in Installed Apps
        const installedRecord = await waitForInstalledAppVisible(context, selectedRecord);

        await attachJson(testInfo, 'install-activity-log-and-apps', {
          selectedRecord,
          finalLog,
          installedRecord,
        });

        setActualResult(
          testInfo,
          `Installed "${selectedRecord.packageName}" successfully, detected a new Activity Log entry, and confirmed the same package appears in Installed Apps.`
        );
      } finally {
        if (selectedRecord) {
          const cleanupResult = await cleanupInstalledApp(context, selectedRecord);
          await attachJson(testInfo, 'install-cleanup', {
            selectedRecord,
            cleanupResult,
          });
        }
      }
    });
  });
});

