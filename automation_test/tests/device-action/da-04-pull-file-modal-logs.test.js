const base = require('@playwright/test');
const {
  expect,
  createPullFileContext,
  openOnlineDeviceDetail,
  openPullFileModal,
  openActivityTabReady,
  validSourceFilePath,
  invalidSourceFilePath,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/pull-file');
const {
  attachJson,
  buildPathExistsCommand,
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

test.describe('Section 1 — Pull File Action: Precondition and Modal States', () => {
  test('TC-DA-010~013: Precondition, modal initial state, and confirm button behaviour', async ({ page }, testInfo) => {
    await test.step('Pull File modal: open, validation, confirm enable/disable', async () => {
      const context = createPullFileContext(page);

      // TC-DA-010: precondition
      await openOnlineDeviceDetail(context);
      await expect(context.deviceDetailPage.pullFileButton).toBeVisible();
      await expect(context.deviceDetailPage.pullFileButton).toBeEnabled();

      // TC-DA-011: modal initial state → disabled
      await openPullFileModal(context);
      expect(await context.deviceDetailPage.isPullFileConfirmDisabled()).toBeTruthy();

      // TC-DA-012: empty source → disabled (already verified above)
      expect(await context.deviceDetailPage.isPullFileConfirmDisabled()).toBeTruthy();

      // TC-DA-013: enter source path → enabled
      await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
      expect(await context.deviceDetailPage.isPullFileConfirmDisabled()).toBeFalsy();
      await context.deviceDetailPage.cancelPullFileIfVisible();

      setActualResult(
        testInfo,
        `Pull File modal validation works correctly: Confirm disabled when source path empty, enabled after entering source path (${validSourceFilePath})`
      );
    });
  });
});

test.describe('Section 2 — Activity Log Success and Failed', () => {
  test('TC-DA-014~015: Pull file successfully and with invalid path, verify Activity Log', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    await test.step('Pull valid path then invalid path; assert Success and Failed logs', async () => {
      const context = createPullFileContext(page);

      // TC-DA-014: success
      await openActivityTabReady(context);
      let previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.clickPullFile();
      await context.deviceDetailPage.waitForPullFileModalVisible();
      await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
      await context.deviceDetailPage.confirmPullFile();
      await context.deviceDetailPage.waitForNewPullFileSuccessLog(previousSignatures);

      // TC-DA-015: failed
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
  });
});

test.describe('Section 3 — Cancel without Log', () => {
  test('TC-DA-016: Verify Pull File modal can be cancelled without creating new Activity Log', async ({ page }, testInfo) => {
    await test.step('Cancel Pull File modal without creating Activity Log entry', async () => {
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
  });
});

test.describe('Section 4 — Terminal Verification', () => {
  test('TC-DA-017: Pull file successfully and verify the source path from Terminal', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('Successful pull then Terminal check on source path', async () => {
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
});

