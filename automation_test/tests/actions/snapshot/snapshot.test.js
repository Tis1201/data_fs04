const {
  test,
  expect,
  createSnapshotContext,
  prepareSnapshotFlow,
  runSnapshotHappyFlow,
  setActualResult,
  setTestCaseMetadata,
} = require('./snapshot-test-helpers');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
} = require('../shared/device-action-common');

test.describe('Device detail - Snapshot action', () => {
  // ── TC-SNAPSHOT-001 ~ 003: Precondition, trigger, image display ──────────
  test('TC-SNAPSHOT-001~003: Precondition, trigger Snapshot, and verify image is displayed', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-SNAPSHOT-001~003',
      category: 'Snapshot',
      title: 'Verify precondition, trigger Snapshot, and verify image is displayed',
      precondition: 'User is logged in, target device is Online, and Snapshot action can be triggered',
      steps: [
        'Open Device detail page on Activity tab',
        'Verify device status is Online and Activity Logs are ready',
        'Click Snapshot button',
        'Wait for snapshot image modal',
        'Verify image is visible and fully loaded',
      ],
      expected: 'Snapshot is triggered and image is generated and displayed successfully',
    });

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

  // ── TC-SNAPSHOT-004 ~ 005: Activity Log + Close modal stability ─────────
  test('TC-SNAPSHOT-004~005: Verify Activity Log Success and modal close stability', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-SNAPSHOT-004~005',
      category: 'Snapshot',
      title: 'Verify Activity Log Success entry and close modal stability',
      precondition: 'User is logged in, target device is Online, and Snapshot action can be triggered',
      steps: [
        'Open Device detail page on Activity tab',
        'Capture existing Activity Log entries',
        'Click Snapshot button',
        'Wait for snapshot image and close modal',
        'Verify a new Snapshot-related Activity Log entry with Success status',
        'Verify Device detail page remains stable after closing modal',
      ],
      expected: 'A new Snapshot-related Activity Log entry is created with Success status and modal closes without breaking the page',
    });

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

  // ── TC-SNAPSHOT-006: Multiple runs ──────────────────────────────────────
  test('TC-SNAPSHOT-006: Trigger Snapshot 3 times and verify each run creates a new Success log', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-SNAPSHOT-006',
      category: 'Snapshot',
      title: 'Trigger Snapshot 3 times and verify each run creates a new Success log',
      precondition: 'User is logged in, target device is Online, and Snapshot action is supported by the device',
      steps: [
        'Open Device detail page on Activity tab',
        'Run Snapshot 3 times sequentially',
        'For each run, wait for snapshot image, close modal, and verify new Success log',
      ],
      expected: 'All 3 Snapshot runs complete successfully and each run creates its own new Success Activity Log entry',
    });

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

  // ── TC-SNAPSHOT-007: Terminal verification ──────────────────────────────
  test('TC-SNAPSHOT-007: Trigger Snapshot and verify Terminal remains usable on Android', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-SNAPSHOT-007',
      category: 'Snapshot Terminal',
      title: 'Trigger Snapshot and verify Terminal remains usable on Android',
      precondition: 'User is logged in, target device is Online, Snapshot action is supported, and Terminal can be opened for the same device',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Trigger Snapshot and verify the snapshot image appears',
        'Verify Activity Log shows Success',
        'Open Terminal for the same device',
        'Run the configured terminal verification command',
        'Verify terminal output confirms the Android shell remains usable',
      ],
      expected: 'Snapshot completes successfully and Terminal confirms the Android device remains reachable',
    });

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
