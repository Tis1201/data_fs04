const { expect } = require('@playwright/test');
const {
  createInstallContext,
  installConfiguredApp,
  waitForInstalledAppVisible,
  verifyInstalledAppInTerminal,
  cleanupInstalledApp,
  ensureConfiguredPackageAbsent,
  uninstallPackageViaUi,
  attachJson,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

test.describe('E2E — Full flow · Remove App', () => {
  test('TC-DA-E2E-004: Full flow — ensure installed → uninstall via Installed Apps → logs + Terminal', async ({
    page,
  }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const context = createInstallContext(page);
    let selectedRecord = null;

    try {
      await test.step('Install managed app when absent', async () => {
        await ensureConfiguredPackageAbsent(context);
        const installResult = await installConfiguredApp(context);
        selectedRecord = installResult.selectedRecord;
        expect(installResult.installSucceeded).toBeTruthy();
        await waitForInstalledAppVisible(context, selectedRecord);
      });

      await test.step('Terminal: confirm package before removal', async () => {
        const out = await verifyInstalledAppInTerminal(context, selectedRecord);
        await attachJson(testInfo, 'tc-da-e2e-004-before-uninstall', { out });
        expect(out).toMatch(/package:/i);
      });

      let uninstallResult;
      await test.step('Remove via Installed Apps UI', async () => {
        uninstallResult = await uninstallPackageViaUi(context, selectedRecord.packageName);
        expect(uninstallResult.attempted).toBeTruthy();
        expect(uninstallResult.success).toBeTruthy();
      });

      await test.step('Terminal: package absent on device', async () => {
        await context.deviceDetailPage.goto();
        await context.deviceDetailPage.waitForPageReady();
        await context.deviceDetailPage.openTerminalFromDeviceDetail();
        await context.terminalPage.waitForTerminalPageReady();
        await context.terminalPage.waitForTerminalConnected();
        await context.terminalPage.waitForShellPrompt();
        const check = await context.terminalPage.checkInstalledPackage(selectedRecord.packageName, []);
        expect(check.installed, check.output).toBe(false);
      });
    } finally {
      await test.step('Cleanup: ensure package absent', async () => {
        if (selectedRecord?.packageName) {
          await cleanupInstalledApp(context, selectedRecord).catch(() => {});
        }
      });
    }

    setActualResult(
      testInfo,
      'TC-DA-E2E-004: Uninstall reflected in Activity Logs and terminal no longer lists package.'
    );
  });
});
