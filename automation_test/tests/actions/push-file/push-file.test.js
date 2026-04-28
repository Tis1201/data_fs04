const {
  test,
  expect,
  createPushFileContext,
  openOnlineDeviceDetail,
  openPushFileModal,
  openActivityTabReady,
  selectConfiguredPushFileResource,
  validDestinationPath,
  invalidDestinationPath,
  noResultSearchKeyword,
  resolvePushFileTerminalTargetPath,
  cleanupPushFileTarget,
  setActualResult,
  setTestCaseMetadata,
} = require('../../../pages/devices/device-detail/test-helpers/push-file-test-helpers');
const {
  attachJson,
  buildPathExistsCommand,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
} = require('../../../pages/devices/device-detail/test-helpers/device-action-shared');

function getPushFileCleanupFailureMessage(phase, cleanupResult = {}) {
  if (!cleanupResult || cleanupResult.skipped || cleanupResult.cleaned) {
    return '';
  }

  return (
    cleanupResult.failureMessage ||
    `Push File cleanup failed during ${phase}${cleanupResult.targetPath ? ` for "${cleanupResult.targetPath}"` : ''}.`
  );
}

test.describe('Device detail - Push File action', () => {
  // ── TC-PUSHFILE-001 ~ 005: Precondition + Modal states + Confirm button ─
  test('TC-PUSHFILE-001~005: Precondition, modal initial state, and confirm button behaviour', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PUSHFILE-001~005',
      category: 'Push File',
      title: 'Verify precondition, modal initial state, and confirm button validation rules',
      precondition: 'User is logged in, target device is Online, and Push File modal is available',
      steps: [
        'Open Device detail page and verify device is Online',
        'Verify Push File button is visible and enabled',
        'Open Push File modal and verify Confirm is disabled initially',
        'Enter only destination path → Confirm remains disabled',
        'Select only file resource → Confirm remains disabled',
        'Enter destination path AND select file → Confirm becomes enabled',
        'Cancel modal without submitting',
      ],
      expected: 'Confirm button is disabled when inputs are incomplete and enabled only when both destination and resource are provided',
    });

    const context = createPushFileContext(page);

    // TC-PUSHFILE-001: precondition
    await openOnlineDeviceDetail(context);
    await expect(context.deviceDetailPage.pushFileButton).toBeVisible();
    await expect(context.deviceDetailPage.pushFileButton).toBeEnabled();

    // TC-PUSHFILE-002: modal initial state
    await openPushFileModal(context);
    expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

    // TC-PUSHFILE-003: destination only → disabled
    await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
    expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

    // Cancel and re-open for clean state
    await context.deviceDetailPage.cancelPushFileIfVisible();

    // TC-PUSHFILE-004: resource only → disabled
    await openPushFileModal(context);
    const selectedResource = await selectConfiguredPushFileResource(context);
    expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

    // TC-PUSHFILE-005: both destination + resource → enabled
    await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
    expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeFalsy();
    await context.deviceDetailPage.cancelPushFileIfVisible();

    setActualResult(
      testInfo,
      `Push File modal validation works correctly: Confirm disabled when inputs incomplete, enabled when both destination path and file resource (${selectedResource || 'first visible resource'}) are provided`
    );
  });

  // ── TC-PUSHFILE-006 ~ 007: Activity Log Success and Failed ─────────────
  test('TC-PUSHFILE-006~007: Push file successfully and with invalid path, verify Activity Log', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PUSHFILE-006~007',
      category: 'Push File',
      title: 'Push file with valid and invalid destination, verify Activity Log',
      precondition: 'User is logged in, target device is Online, a valid file resource exists, and destination path is writable on the device',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Push file with valid destination path and verify Activity Log Success',
        'Push file with invalid/read-only destination path and verify Activity Log Failed',
      ],
      expected: 'Valid push shows Success in Activity Log; invalid path shows Failed',
    });

    const context = createPushFileContext(page);
    let cleanupTargetPath = resolvePushFileTerminalTargetPath();
    const cleanupArtifacts = [];
    let cleanupFailureMessage = '';
    let mainFlowPassed = false;

    try {
      // TC-PUSHFILE-006: success
      await openActivityTabReady(context);
      let previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.clickPushFile();
      await context.deviceDetailPage.waitForPushFileModalVisible();
      await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
      const selectedResource = await selectConfiguredPushFileResource(context);
      cleanupTargetPath =
        cleanupTargetPath || resolvePushFileTerminalTargetPath(selectedResource);

      if (cleanupTargetPath) {
        const preCleanup = await withFreshPageContext(
          page.context(),
          createPushFileContext,
          async (cleanupContext) => {
            return cleanupPushFileTarget(
              cleanupContext,
              cleanupTargetPath
            );
          }
        );

        cleanupArtifacts.push({ phase: 'before_test', ...preCleanup });
        expect(
          preCleanup.skipped || preCleanup.cleaned,
          getPushFileCleanupFailureMessage('before_test', preCleanup)
        ).toBeTruthy();
      }

      await context.deviceDetailPage.confirmPushFile();
      await context.deviceDetailPage.waitForNewPushFileSuccessLog(previousSignatures);

      // TC-PUSHFILE-007: failed
      await openActivityTabReady(context);
      previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.clickPushFile();
      await context.deviceDetailPage.waitForPushFileModalVisible();
      await context.deviceDetailPage.fillPushFileDestinationPath(invalidDestinationPath);
      await selectConfiguredPushFileResource(context);
      await context.deviceDetailPage.confirmPushFile();
      await context.deviceDetailPage.waitForNewPushFileFailedLog(previousSignatures);

      setActualResult(
        testInfo,
        `Push file: valid path (${validDestinationPath}) → Success, invalid path (${invalidDestinationPath}) → Failed, using resource (${selectedResource || 'first visible resource'})`
      );
      mainFlowPassed = true;
    } finally {
      if (cleanupTargetPath) {
        const postCleanup = await withFreshPageContext(
          page.context(),
          createPushFileContext,
          async (cleanupContext) => {
            return cleanupPushFileTarget(
              cleanupContext,
              cleanupTargetPath
            );
          }
        );

        cleanupArtifacts.push({ phase: 'after_test', ...postCleanup });
        cleanupFailureMessage =
          cleanupFailureMessage || getPushFileCleanupFailureMessage('after_test', postCleanup);
      }

      if (cleanupArtifacts.length) {
        await attachJson(testInfo, 'push-file-cleanup', cleanupArtifacts);
      }

      if (cleanupFailureMessage && mainFlowPassed) {
        throw new Error(cleanupFailureMessage);
      }
    }
  });

  // ── TC-PUSHFILE-008: Empty search state ────────────────────────────────
  test('TC-PUSHFILE-008: Search with no matching file and verify empty state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PUSHFILE-008',
      category: 'Push File',
      title: 'Search with no matching file and verify empty state',
      precondition: 'User is logged in, target device is Online, and Push File modal is available',
      steps: [
        'Open Push File modal',
        `Search with no-result keyword: ${noResultSearchKeyword}`,
        'Verify empty state is displayed',
        'Verify Confirm button remains disabled',
      ],
      expected: 'Empty state displayed and Confirm remains disabled when no matching file resource is found',
    });

    const context = createPushFileContext(page);

    await openPushFileModal(context);
    const modal = await context.deviceDetailPage.waitForPushFileModalVisible();
    await context.deviceDetailPage.searchPushFileResource(noResultSearchKeyword);

    const emptyState = modal.getByText(
      context.deviceDetailPage.getPushFileUiText('PUSH_FILE_EMPTY', 'No files found'),
      { exact: true }
    );

    await expect(emptyState).toBeVisible();
    expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

    setActualResult(
      testInfo,
      `Search with keyword "${noResultSearchKeyword}" returned no matching file resource, empty state was displayed, and Confirm button remained disabled`
    );
  });

  // ── TC-PUSHFILE-009: Terminal verification ─────────────────────────────
  test('TC-PUSHFILE-009: Push file successfully and verify the pushed file from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-PUSHFILE-009',
      category: 'Push File Terminal',
      title: 'Push file successfully and verify the pushed file from Terminal',
      precondition: 'User is logged in, target device is Online, a valid file resource is available, and Terminal can be opened for the same device',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Push the configured file resource to the configured destination path',
        'Verify Activity Log shows Success',
        'Open Terminal for the same device',
        'Run a terminal command to verify the pushed file exists on Android',
      ],
      expected: 'Push File completes successfully and Terminal confirms the pushed file exists at the destination',
    });

    const context = createPushFileContext(page);
    let cleanupTargetPath = resolvePushFileTerminalTargetPath();
    const cleanupArtifacts = [];
    let cleanupFailureMessage = '';
    let mainFlowPassed = false;

    try {
      await openActivityTabReady(context);
      const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.clickPushFile();
      await context.deviceDetailPage.waitForPushFileModalVisible();
      await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
      const selectedResource = await selectConfiguredPushFileResource(context);
      const targetPath = resolvePushFileTerminalTargetPath(selectedResource);
      cleanupTargetPath = cleanupTargetPath || targetPath;

      expect(
        context.terminalVerifyCommand || targetPath,
        'Push File terminal verification requires PUSH_FILE_TERMINAL_VERIFY_COMMAND or a resolvable target path/file name.'
      ).toBeTruthy();

      if (cleanupTargetPath) {
        const preCleanup = await withFreshPageContext(
          page.context(),
          createPushFileContext,
          async (cleanupContext) => {
            return cleanupPushFileTarget(
              cleanupContext,
              cleanupTargetPath
            );
          }
        );

        cleanupArtifacts.push({ phase: 'before_test', ...preCleanup });
        expect(
          preCleanup.skipped || preCleanup.cleaned,
          getPushFileCleanupFailureMessage('before_test', preCleanup)
        ).toBeTruthy();
      }

      await context.deviceDetailPage.confirmPushFile();
      const activityLog = await context.deviceDetailPage.waitForNewPushFileSuccessLog(previousSignatures);

      await openTerminalSession(context);

      const command =
        context.terminalVerifyCommand || buildPathExistsCommand(targetPath);
      const expectedPattern = toRegExp(
        context.terminalVerifyExpectedPattern,
        /__E2E_EXISTS__/i
      );
      const terminalOutput = await context.terminalPage.runCommandAndWaitForOutput(
        command,
        expectedPattern
      );

      await attachJson(testInfo, 'push-file-terminal-verification', {
        selectedResource,
        targetPath,
        command,
        terminalOutput,
        activityLog,
      });

      expect(terminalOutput).toMatch(expectedPattern);

      setActualResult(
        testInfo,
        `Push File completed successfully using resource "${selectedResource || 'configured resource'}", and terminal output confirmed the pushed artifact exists at "${targetPath || validDestinationPath}".`
      );
      mainFlowPassed = true;
    } finally {
      if (cleanupTargetPath) {
        const postCleanup = await withFreshPageContext(
          page.context(),
          createPushFileContext,
          async (cleanupContext) => {
            return cleanupPushFileTarget(
              cleanupContext,
              cleanupTargetPath
            );
          }
        );

        cleanupArtifacts.push({ phase: 'after_test', ...postCleanup });
        cleanupFailureMessage =
          cleanupFailureMessage || getPushFileCleanupFailureMessage('after_test', postCleanup);
      }

      if (cleanupArtifacts.length) {
        await attachJson(testInfo, 'push-file-cleanup', cleanupArtifacts);
      }

      if (cleanupFailureMessage && mainFlowPassed) {
        throw new Error(cleanupFailureMessage);
      }
    }
  });
});
