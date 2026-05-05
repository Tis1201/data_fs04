const base = require('@playwright/test');
const {
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
} = require('../../pages/devices/device-detail/modules/device-actions/push-file');
const {
  attachJson,
  buildPathExistsCommand,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
} = require('../../pages/devices/device-detail/modules/device-actions/shared');
const { authFile } = require('./device-actions-shared');

function getPushFileCleanupFailureMessage(phase, cleanupResult = {}) {
  if (!cleanupResult || cleanupResult.skipped || cleanupResult.cleaned) {
    return '';
  }

  return (
    cleanupResult.failureMessage ||
    `Push File cleanup failed during ${phase}${cleanupResult.targetPath ? ` for "${cleanupResult.targetPath}"` : ''}.`
  );
}

// Rule 11.1 & 16.2: Use Fixture to initialize shared POM
const extendedTest = base.test.extend({
  page: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

const test = extendedTest;
test.use({ storageState: authFile });

test.describe('Section 1 — Push File Action: Precondition and Modal States', () => {
  test('TC-DA-018~022: Precondition, modal initial state, and confirm button behaviour', async ({ page }, testInfo) => {
    await test.step('Push File modal: precondition, resource/destination rules, confirm state', async () => {
      const context = createPushFileContext(page);

      // TC-DA-018: precondition
      await openOnlineDeviceDetail(context);
      await expect(context.deviceDetailPage.pushFileButton).toBeVisible();
      await expect(context.deviceDetailPage.pushFileButton).toBeEnabled();

      // TC-DA-019: modal initial state
      await openPushFileModal(context);
      expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

      // TC-DA-020: destination only → disabled
      await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
      expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

      // Cancel and re-open for clean state
      await context.deviceDetailPage.cancelPushFileIfVisible();

      // TC-DA-021: resource only → disabled
      await openPushFileModal(context);
      const selectedResource = await selectConfiguredPushFileResource(context);
      expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeTruthy();

      // TC-DA-022: both destination + resource → enabled
      await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
      expect(await context.deviceDetailPage.isPushFileConfirmDisabled()).toBeFalsy();
      await context.deviceDetailPage.cancelPushFileIfVisible();

      setActualResult(
        testInfo,
        `Push File modal validation works correctly: Confirm disabled when inputs incomplete, enabled when both destination path and file resource (${selectedResource || 'first visible resource'}) are provided`
      );
    });
  });
});

test.describe('Section 2 — Activity Log Success and Failed', () => {
  test('TC-DA-023~024: Push file successfully and with invalid path, verify Activity Log', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    await test.step('Push success and failure paths with pre/post cleanup on device', async () => {
      const context = createPushFileContext(page);
      let cleanupTargetPath = resolvePushFileTerminalTargetPath();
      const cleanupArtifacts = [];
      let cleanupFailureMessage = '';
      let mainFlowPassed = false;

      try {
        // TC-DA-023: success
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

        // TC-DA-024: failed
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
  });
});

test.describe('Section 3 — Empty Search State', () => {
  test('TC-DA-025: Search with no matching file and verify empty state', async ({ page }, testInfo) => {
    await test.step('Search with no results: empty state and Confirm stays disabled', async () => {
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
  });
});

test.describe('Section 4 — Terminal Verification', () => {
  test('TC-DA-026: Push file successfully and verify the pushed file from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('Push file, verify on disk via Terminal, enforce cleanup', async () => {
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
});

