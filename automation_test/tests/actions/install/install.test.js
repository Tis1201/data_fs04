const {
  test,
  expect,
  createInstallContext,
  installConfiguredApp,
  waitForInstalledAppVisible,
  verifyInstalledAppInTerminal,
  cleanupInstalledApp,
  attachJson,
  setActualResult,
} = require('../../../pages/devices/device-detail/test-helpers/install-test-helpers');

test.describe('Device detail - Install App action', () => {
  // ── TC-INSTALL-V2-001 ~ 002: Activity Log + Installed Apps ───────────────
  test('TC-INSTALL-V2-001~002: Install app and verify Activity Log and Installed Apps', async ({ page }, testInfo) => {
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

          // TC-INSTALL-V2-002: verify in Installed Apps
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

  // ── TC-INSTALL-V2-003: Terminal verification ────────────────────────────
  test('TC-INSTALL-V2-003: Install app and verify the package from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);
await test.step('Run main flow', async () => {
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
