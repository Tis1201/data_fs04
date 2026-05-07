const { expect } = require('@playwright/test');
const {
  createInstallContext,
  installConfiguredApp,
  waitForInstalledAppVisible,
  verifyInstalledAppInTerminal,
  cleanupInstalledApp,
  ensureConfiguredPackageAbsent,
  attachJson,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

test.describe('E2E — Full flow · Install App', () => {
  test('TC-DA-E2E-003: Full flow — cleanup if needed → install → logs → Installed Apps → Terminal → cleanup', async ({
    page,
  }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const context = createInstallContext(page);
    let selectedRecord = null;

    try {
      await test.step('Pre: remove package if already present', async () => {
        await ensureConfiguredPackageAbsent(context);
      });

      let installResult;
      await test.step('Install from resources and wait for Activity Log', async () => {
        installResult = await installConfiguredApp(context);
        selectedRecord = installResult.selectedRecord;
        expect(
          installResult.installSucceeded,
          `Install did not finish successfully for "${selectedRecord.packageName}".`
        ).toBeTruthy();
      });

      await test.step('Verify Installed Apps lists the package', async () => {
        await waitForInstalledAppVisible(context, selectedRecord);
      });

      await test.step('Terminal: package present on device', async () => {
        const terminalOutput = await verifyInstalledAppInTerminal(context, selectedRecord);
        await attachJson(testInfo, 'tc-da-e2e-003-terminal', { terminalOutput, selectedRecord });
      });
    } finally {
      await test.step('Cleanup: uninstall test package', async () => {
        if (selectedRecord) {
          const cleanupResult = await cleanupInstalledApp(context, selectedRecord);
          await attachJson(testInfo, 'tc-da-e2e-003-cleanup', { selectedRecord, cleanupResult });
        }
      });
    }

    setActualResult(
      testInfo,
      'TC-DA-E2E-003: End-to-end install with Installed Apps + Terminal verification and cleanup.'
    );
  });
});
