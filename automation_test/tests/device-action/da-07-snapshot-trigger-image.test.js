const base = require('@playwright/test');
const {
  expect,
  createSnapshotContext,
  prepareSnapshotFlow,
  runSnapshotHappyFlow,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/snapshot');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
} = require('../../pages/devices/device-detail/modules/device-actions/shared');
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

test.describe('Snapshot — trigger & image (subset · TC-DA-E2E-007)', () => {
  test('TC-DA-032~034: Precondition, trigger Snapshot, and verify image is displayed', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    await test.step('Trigger Snapshot and wait for preview image', async () => {
      const context = createSnapshotContext(page);

      // TC-DA-032: precondition
      await prepareSnapshotFlow(context);

      // TC-DA-033: trigger action + TC-DA-034: image display
      await context.deviceDetailPage.triggerSnapshot();
      await context.deviceDetailPage.waitForSnapshotImage();

      setActualResult(
        testInfo,
        'Snapshot button was clicked successfully, image was displayed, and the image source was loaded properly'
      );
    });
  });
});

test.describe('Section 2 — Activity Log and Modal Close', () => {
  test('TC-DA-035~036: Verify Activity Log Success and modal close stability', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    await test.step('Snapshot Success in Activity Log and stable UI after closing modal', async () => {
      const context = createSnapshotContext(page);

      await prepareSnapshotFlow(context);
      const existingLogSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.triggerSnapshot();
      await context.deviceDetailPage.waitForSnapshotImage();
      await context.deviceDetailPage.closeSnapshotModalIfVisible();

      // TC-DA-035: activity log
      const snapshotLog = await context.deviceDetailPage.waitForNewSnapshotSuccessLog(
        existingLogSignatures
      );
      expect(snapshotLog).not.toBeNull();
      expect(snapshotLog.statusText).toMatch(/Success/i);
      expect(
        `${snapshotLog.descriptionText} ${snapshotLog.detailsText} ${snapshotLog.rowText}`
      ).toMatch(/Screenshot|Snapshot|Captured screenshot/i);

      // TC-DA-036: close modal stability
      await expect(context.deviceDetailPage.screenshotModal).toBeHidden();
      await expect(context.deviceDetailPage.snapshotButton).toBeVisible();
      await expect(context.deviceDetailPage.activityLogsHeading).toBeVisible();

      setActualResult(
        testInfo,
        `A new Snapshot-related Activity Log entry was created successfully with status "${snapshotLog.statusText}", and Device detail page remained stable after closing modal`
      );
    });
  });
});

test.describe('Section 3 — Multiple Runs', () => {
  test('TC-DA-037: Trigger Snapshot 3 times and verify each run creates a new Success log', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('Three consecutive Snapshots each add a new Success log', async () => {
      const context = createSnapshotContext(page);
      const runResults = [];

      await prepareSnapshotFlow(context);

      for (let attempt = 1; attempt <= 3; attempt++) {
        const snapshotLog = await runSnapshotHappyFlow(context);
        runResults.push(
          `Run ${attempt}: ${snapshotLog.statusText} | ${snapshotLog.descriptionText || snapshotLog.rowText}`
        );
        await context.deviceDetailPage.waitForActivityLogsReady();
      }

      setActualResult(
        testInfo,
        `Snapshot completed successfully in 3 consecutive runs. ${runResults.join(' || ')}`
      );
    });
  });
});

test.describe('Section 4 — Terminal Verification', () => {
  test('TC-DA-038: Trigger Snapshot and verify Terminal remains usable on Android', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('After Snapshot, Terminal still responds on the device', async () => {
      const context = createSnapshotContext(page);

      await prepareSnapshotFlow(context);
      const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.triggerSnapshot();
      await context.deviceDetailPage.waitForSnapshotImage();
      await context.deviceDetailPage.closeSnapshotModalIfVisible();
      const activityLog = await context.deviceDetailPage.waitForNewSnapshotSuccessLog(previousSignatures);

      await openTerminalSession(context);

      const expectedPattern = toRegExp(context.terminalVerifyExpectedPattern, /uid=/i);
      const terminalOutput = await context.terminalPage.runCommandAndWaitForOutput(
        context.terminalVerifyCommand,
        expectedPattern
      );

      await attachJson(testInfo, 'snapshot-terminal-verification', {
        command: context.terminalVerifyCommand,
        terminalOutput,
        activityLog,
      });

      expect(terminalOutput).toMatch(expectedPattern);

      setActualResult(
        testInfo,
        `Snapshot completed successfully and terminal command "${context.terminalVerifyCommand}" confirmed the Android shell remained usable on the same device.`
      );
    });
  });
});

