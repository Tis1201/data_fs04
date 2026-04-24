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
  setTestCaseMetadata,
} = require('./install-test-helpers');

test.describe('Device detail - Install App action', () => {
  // ── TC-INSTALL-V2-001 ~ 002: Activity Log + Installed Apps ───────────────
  test('TC-INSTALL-V2-001~002: Install app and verify Activity Log and Installed Apps', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-INSTALL-V2-001~002',
      category: 'Install App',
      title: 'Install app and verify Activity Log entry and Installed Apps',
      precondition: 'User is logged in, target device is Online, and configured install app is available for installation',
      steps: [
        'Open target device detail page',
        'Select a managed install candidate that is not already on the device',
        'Open Install App modal',
        'Install the configured app',
        'Verify a new install log is created for the same app',
        'Verify the app appears in Installed Apps',
        'Delete the installed app to restore the original device state',
      ],
      expected: 'A new Activity Log row is created and the app appears in Installed Apps; cleanup removes the app afterward',
    });

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

  // ── TC-INSTALL-V2-003: Terminal verification ────────────────────────────
  test('TC-INSTALL-V2-003: Install app and verify the package from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-INSTALL-V2-003',
      category: 'Install App Terminal',
      title: 'Install app and verify the package from Terminal',
      precondition: 'User is logged in, target device is Online, configured install app is available for installation, and Terminal can be opened for the same device',
      steps: [
        'Open target device detail page',
        'Select a managed install candidate that is not already on the device',
        'Open Install App modal',
        'Install the configured app',
        'Open Terminal for the same device',
        'Run the package verification command',
        'Verify terminal output confirms the installed package',
        'Delete the installed app from Installed Apps to restore the original device state',
      ],
      expected: 'Terminal confirms the installed package exists on the device and cleanup removes the installed app afterward',
    });

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
