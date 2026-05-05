const base = require('@playwright/test');
const {
  expect,
  createInstallContext,
  installConfiguredApp,
  waitForInstalledAppVisible,
  verifyInstalledAppInTerminal,
  cleanupInstalledApp,
  attachJson,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
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

test.describe('Section 2 — Install App Action: Terminal Verification', () => {
  test('TC-DA-009: Install app and verify the package from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);

    await test.step('Install, confirm package in Terminal, cleanup in fresh page', async () => {
      const context = createInstallContext(page);
      let selectedRecord = null;
      let cleanupRecord = null;

      try {
        const installResult = await installConfiguredApp(context);
        selectedRecord = installResult.selectedRecord;

        expect(
          installResult.installSucceeded,
          `Install did not finish successfully for "${selectedRecord.packageName}".`
        ).toBeTruthy();

        const installedRecord = await waitForInstalledAppVisible(context, selectedRecord);
        cleanupRecord = installedRecord;
        const terminalOutput = await verifyInstalledAppInTerminal(context, installedRecord);

        await attachJson(testInfo, 'install-terminal-verification', {
          selectedRecord,
          installedRecord,
          terminalOutput,
        });

        setActualResult(
          testInfo,
          `Installed "${installedRecord.packageName}" successfully and terminal output confirmed the package is present on the device.`
        );
      } finally {
        if (cleanupRecord || selectedRecord) {
          const browserContext = page.context();
          await page.close().catch(() => {});
          const cleanupPage = await browserContext.newPage();
          try {
            const cleanupContext = createInstallContext(cleanupPage);
            const cleanupResult = await cleanupInstalledApp(
              cleanupContext,
              cleanupRecord || selectedRecord
            );
            await attachJson(testInfo, 'install-terminal-cleanup', {
              selectedRecord: cleanupRecord || selectedRecord,
              cleanupResult,
            });
          } finally {
            await cleanupPage.close().catch(() => {});
          }
        }
      }
    });
  });
});

