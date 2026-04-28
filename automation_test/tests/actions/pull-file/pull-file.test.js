const {
  test,
  expect,
  createPullFileContext,
  openOnlineDeviceDetail,
  openPullFileModal,
  openActivityTabReady,
  validSourceFilePath,
  invalidSourceFilePath,
  setActualResult,
  setTestCaseMetadata,
} = require('../../../pages/devices/device-detail/test-helpers/pull-file-test-helpers');
const {
  attachJson,
  buildPathExistsCommand,
  openTerminalSession,
  toRegExp,
} = require('../../../pages/devices/device-detail/test-helpers/device-action-shared');

test.describe('Device detail - Pull File action', () => {
  // ── TC-PULLFILE-001 ~ 004: Precondition + Modal states + Confirm button ─
  test('TC-PULLFILE-001~004: Precondition, modal initial state, and confirm button behaviour', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PULLFILE-001~004',
      category: 'Pull File',
      title: 'Verify precondition, modal initial state, and confirm button validation',
      precondition: 'User is logged in, target device is Online, and Pull File modal is available',
      steps: [
        'Open Device detail page and verify device is Online',
        'Verify Pull File button is visible and enabled',
        'Open Pull File modal and verify Confirm is disabled initially',
        'Verify Confirm remains disabled when source path is empty',
        'Enter source path and verify Confirm becomes enabled',
        'Cancel modal without submitting',
      ],
      expected: 'Confirm button is disabled when source path is empty and enabled after entering a source path',
    });

    const context = createPullFileContext(page);

    // TC-PULLFILE-001: precondition
    await openOnlineDeviceDetail(context);
    await expect(context.deviceDetailPage.pullFileButton).toBeVisible();
    await expect(context.deviceDetailPage.pullFileButton).toBeEnabled();

    // TC-PULLFILE-002: modal initial state → disabled
    await openPullFileModal(context);
    expect(await context.deviceDetailPage.isPullFileConfirmDisabled()).toBeTruthy();

    // TC-PULLFILE-003: empty source → disabled (already verified above)
    expect(await context.deviceDetailPage.isPullFileConfirmDisabled()).toBeTruthy();

    // TC-PULLFILE-004: enter source path → enabled
    await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
    expect(await context.deviceDetailPage.isPullFileConfirmDisabled()).toBeFalsy();
    await context.deviceDetailPage.cancelPullFileIfVisible();

    setActualResult(
      testInfo,
      `Pull File modal validation works correctly: Confirm disabled when source path empty, enabled after entering source path (${validSourceFilePath})`
    );
  });

  // ── TC-PULLFILE-005 ~ 006: Activity Log Success and Failed ─────────────
  test('TC-PULLFILE-005~006: Pull file successfully and with invalid path, verify Activity Log', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PULLFILE-005~006',
      category: 'Pull File',
      title: 'Pull file with valid and invalid source path, verify Activity Log',
      precondition: 'User is logged in, target device is Online, and source file path exists on the device',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Pull file with valid source path and verify Activity Log Success',
        'Pull file with invalid source path and verify Activity Log Failed',
      ],
      expected: 'Valid pull shows Success in Activity Log; invalid path shows Failed',
    });

    const context = createPullFileContext(page);

    // TC-PULLFILE-005: success
    await openActivityTabReady(context);
    let previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
    await context.deviceDetailPage.clickPullFile();
    await context.deviceDetailPage.waitForPullFileModalVisible();
    await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
    await context.deviceDetailPage.confirmPullFile();
    await context.deviceDetailPage.waitForNewPullFileSuccessLog(previousSignatures);

    // TC-PULLFILE-006: failed
    await openActivityTabReady(context);
    previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
    await context.deviceDetailPage.clickPullFile();
    await context.deviceDetailPage.waitForPullFileModalVisible();
    await context.deviceDetailPage.fillPullFileSourcePath(invalidSourceFilePath);
    await context.deviceDetailPage.confirmPullFile();
    await context.deviceDetailPage.waitForNewPullFileFailedLog(previousSignatures);

    setActualResult(
      testInfo,
      `Pull File: valid path (${validSourceFilePath}) → Success, invalid path (${invalidSourceFilePath}) → Failed`
    );
  });

  // ── TC-PULLFILE-007: Cancel without creating log ───────────────────────
  test('TC-PULLFILE-007: Verify Pull File modal can be cancelled without creating new Activity Log', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PULLFILE-007',
      category: 'Pull File',
      title: 'Verify Pull File modal can be cancelled without creating new Activity Log',
      precondition: 'User is logged in, target device is Online, and Pull File modal is available',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Capture existing Activity Log entries',
        'Click Pull File button',
        'Enter source file path',
        'Click Cancel',
        'Verify modal is closed',
        'Wait briefly and verify no new Pull File Activity Log entry is created',
      ],
      expected: 'Cancel closes the Pull File modal without creating a new Pull File Activity Log entry',
    });

    const context = createPullFileContext(page);

    await openActivityTabReady(context);
    const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
    await context.deviceDetailPage.clickPullFile();
    await context.deviceDetailPage.waitForPullFileModalVisible();
    await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
    await context.deviceDetailPage.cancelPullFileIfVisible();
    await context.deviceDetailPage.page.waitForTimeout(3000);
    await context.deviceDetailPage.waitForActivityLogsReady();

    const newPullFileLog = await context.deviceDetailPage.findNewPullFileLogByStatus(
      previousSignatures,
      /.*/,
      30
    );

    expect(newPullFileLog).toBeNull();

    setActualResult(
      testInfo,
      'Pull File modal was cancelled successfully and no new Pull File Activity Log entry was created'
    );
  });

  // ── TC-PULLFILE-008: Terminal verification ─────────────────────────────
  test('TC-PULLFILE-008: Pull file successfully and verify the source path from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PULLFILE-008',
      category: 'Pull File Terminal',
      title: 'Pull file successfully and verify the source path from Terminal',
      precondition: 'User is logged in, target device is Online, the source file path exists on the Android device, and Terminal can be opened for the same device',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Trigger Pull File with the configured valid source path',
        'Verify Activity Log shows Success',
        'Open Terminal for the same device',
        'Run a terminal command to verify the source path still exists on Android',
      ],
      expected: 'Pull File completes successfully and Terminal confirms the configured source path exists on the Android device',
    });

    const context = createPullFileContext(page);

    await openActivityTabReady(context);
    const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
    await context.deviceDetailPage.clickPullFile();
    await context.deviceDetailPage.waitForPullFileModalVisible();
    await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
    await context.deviceDetailPage.confirmPullFile();
    const activityLog = await context.deviceDetailPage.waitForNewPullFileSuccessLog(previousSignatures);

    await openTerminalSession(context);

    const command =
      context.terminalVerifyCommand || buildPathExistsCommand(validSourceFilePath);
    const expectedPattern = toRegExp(
      context.terminalVerifyExpectedPattern,
      /__E2E_EXISTS__/i
    );
    const terminalOutput = await context.terminalPage.runCommandAndWaitForOutput(
      command,
      expectedPattern
    );

    await attachJson(testInfo, 'pull-file-terminal-verification', {
      sourcePath: validSourceFilePath,
      command,
      terminalOutput,
      activityLog,
    });

    expect(terminalOutput).toMatch(expectedPattern);

    setActualResult(
      testInfo,
      `Pull File completed successfully for source path "${validSourceFilePath}" and terminal output confirmed the expected Android path verification command succeeded.`
    );
  });
});
