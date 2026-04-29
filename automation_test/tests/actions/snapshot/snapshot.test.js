const {
  test,
  expect,
  createSnapshotContext,
  prepareSnapshotFlow,
  runSnapshotHappyFlow,
  setActualResult,
} = require('../../../pages/devices/device-detail/test-helpers/snapshot-test-helpers');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
} = require('../../../pages/devices/device-detail/test-helpers/device-action-shared');

test.describe('Device detail - Snapshot action', () => {
  // ── TC-SNAPSHOT-001 ~ 003: Precondition, trigger, image display ──────────
  test('TC-SNAPSHOT-001~003: Precondition, trigger Snapshot, and verify image is displayed', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);
await test.step('Run main flow', async () => {
        const context = createSnapshotContext(page);

        // TC-SNAPSHOT-001: precondition
        await prepareSnapshotFlow(context);

        // TC-SNAPSHOT-002: trigger action + TC-SNAPSHOT-003: image display
        await context.deviceDetailPage.triggerSnapshot();
        await context.deviceDetailPage.waitForSnapshotImage();

        setActualResult(
          testInfo,
          'Snapshot button was clicked successfully, image was displayed, and the image source was loaded properly'
        );
    });
});

  // ── TC-SNAPSHOT-004 ~ 005: Activity Log + Close modal stability ─────────
  test('TC-SNAPSHOT-004~005: Verify Activity Log Success and modal close stability', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);
await test.step('Run main flow', async () => {
        const context = createSnapshotContext(page);

        await prepareSnapshotFlow(context);
        const existingLogSignatures = await context.deviceDetailPage.getActivityLogSignatures();
        await context.deviceDetailPage.triggerSnapshot();
        await context.deviceDetailPage.waitForSnapshotImage();
        await context.deviceDetailPage.closeSnapshotModalIfVisible();

        // TC-SNAPSHOT-004: activity log
        const snapshotLog = await context.deviceDetailPage.waitForNewSnapshotSuccessLog(
          existingLogSignatures
        );
        expect(snapshotLog).not.toBeNull();
        expect(snapshotLog.statusText).toMatch(/Success/i);
        expect(
          `${snapshotLog.descriptionText} ${snapshotLog.detailsText} ${snapshotLog.rowText}`
        ).toMatch(/Screenshot|Snapshot|Captured screenshot/i);

        // TC-SNAPSHOT-005: close modal stability
        await expect(context.deviceDetailPage.screenshotModal).toBeHidden();
        await expect(context.deviceDetailPage.snapshotButton).toBeVisible();
        await expect(context.deviceDetailPage.activityLogsHeading).toBeVisible();

        setActualResult(
          testInfo,
          `A new Snapshot-related Activity Log entry was created successfully with status "${snapshotLog.statusText}", and Device detail page remained stable after closing modal`
        );
    });
});

  // ── TC-SNAPSHOT-006: Multiple runs ──────────────────────────────────────
  test('TC-SNAPSHOT-006: Trigger Snapshot 3 times and verify each run creates a new Success log', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
await test.step('Run main flow', async () => {
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

  // ── TC-SNAPSHOT-007: Terminal verification ──────────────────────────────
  test('TC-SNAPSHOT-007: Trigger Snapshot and verify Terminal remains usable on Android', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
await test.step('Run main flow', async () => {
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
