const { expect } = require('@playwright/test');
const {
  createPushFileContext,
  openActivityTabReady,
  selectConfiguredPushFileResource,
  validDestinationPath,
  resolvePushFileTerminalTargetPath,
  cleanupPushFileTarget,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/push-file');
const {
  createPullFileContext,
  openActivityTabReady: openActivityPullReady,
  validSourceFilePath,
  setActualResult: setPullActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/pull-file');
const {
  attachJson,
  buildPathExistsCommand,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
} = require('../../pages/devices/device-detail/modules/device-actions/shared');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

test.describe('E2E — Full flow · Push / Pull file', () => {
  test('TC-DA-E2E-005: Full flow — cleanup target → Push file → Activity Log + Terminal → cleanup', async ({
    page,
  }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const context = createPushFileContext(page);
    let cleanupTargetPath = resolvePushFileTerminalTargetPath();
    let resolvedTargetPath = '';
    const cleanupArtifacts = [];
    let mainFlowPassed = false;

    try {
      await test.step('Prepare: remove remote file if present', async () => {
        if (cleanupTargetPath) {
          const pre = await withFreshPageContext(page.context(), createPushFileContext, async (ctx) =>
            cleanupPushFileTarget(ctx, cleanupTargetPath)
          );
          cleanupArtifacts.push({ phase: 'pre', ...pre });
        }
      });

      await test.step('Push file and wait for Success log', async () => {
        await openActivityTabReady(context);
        const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
        await context.deviceDetailPage.clickPushFile();
        await context.deviceDetailPage.waitForPushFileModalVisible();
        await context.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
        const selectedResource = await selectConfiguredPushFileResource(context);
        resolvedTargetPath = resolvePushFileTerminalTargetPath(selectedResource);
        cleanupTargetPath = cleanupTargetPath || resolvedTargetPath;

        expect(
          context.terminalVerifyCommand || resolvedTargetPath,
          'Configure pushFile.terminalVerifyPath or terminalVerifyCommand for terminal assertion.'
        ).toBeTruthy();

        await context.deviceDetailPage.confirmPushFile();
        await context.deviceDetailPage.waitForNewPushFileSuccessLog(previousSignatures);
        await attachJson(testInfo, 'tc-da-e2e-005', { selectedResource, resolvedTargetPath });
      });

      await test.step('Terminal: pushed file exists on device', async () => {
        await openTerminalSession(context);
        const command =
          context.terminalVerifyCommand || buildPathExistsCommand(resolvedTargetPath);
        const expectedPattern = toRegExp(context.terminalVerifyExpectedPattern, /__E2E_EXISTS__/i);
        const terminalOutput = await context.terminalPage.runCommandAndWaitForOutput(
          command,
          expectedPattern
        );
        expect(terminalOutput).toMatch(expectedPattern);
      });

      mainFlowPassed = true;
      setActualResult(
        testInfo,
        'TC-DA-E2E-005: Push succeeded; terminal confirmed file on device; cleanup runs in finally.'
      );
    } finally {
      if (cleanupTargetPath) {
        const post = await withFreshPageContext(page.context(), createPushFileContext, async (ctx) =>
          cleanupPushFileTarget(ctx, cleanupTargetPath)
        );
        cleanupArtifacts.push({ phase: 'post', ...post });
        const cleanupFailureMessage =
          post.skipped || post.cleaned ? '' : post.failureMessage || 'Push cleanup failed after test.';
        await attachJson(testInfo, 'tc-da-e2e-005-cleanup', cleanupArtifacts);
        if (cleanupFailureMessage && mainFlowPassed) {
          throw new Error(cleanupFailureMessage);
        }
      }
    }
  });

  test('TC-DA-E2E-006: Full flow — create source on device → Pull file → Activity Log + Terminal → cleanup', async ({
    page,
  }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const context = createPullFileContext(page);

    await test.step('Terminal: ensure source file exists', async () => {
      await openTerminalSession(context);
      const writeCmd = `echo e2e-pull-content > ${validSourceFilePath}`;
      await context.terminalPage.runCommandAndWaitForTextChange(writeCmd);
      const verifyCat = await context.terminalPage.runCommandAndWaitForOutput(
        `cat ${validSourceFilePath}`,
        /e2e-pull-content/
      );
      expect(verifyCat).toMatch(/e2e-pull-content/);
    });

    await test.step('Pull file and wait for Success log', async () => {
      await openActivityPullReady(context);
      const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.clickPullFile();
      await context.deviceDetailPage.waitForPullFileModalVisible();
      await context.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
      await context.deviceDetailPage.confirmPullFile();
      const log = await context.deviceDetailPage.waitForNewPullFileSuccessLog(previousSignatures);
      await attachJson(testInfo, 'tc-da-e2e-006-log', { log });
    });

    await test.step('Terminal: source file still readable', async () => {
      await context.deviceDetailPage.goto();
      await context.deviceDetailPage.waitForPageReady();
      await openTerminalSession(context);
      const command =
        context.terminalVerifyCommand || buildPathExistsCommand(validSourceFilePath);
      const expectedPattern = toRegExp(context.terminalVerifyExpectedPattern, /__E2E_EXISTS__/i);
      const out = await context.terminalPage.runCommandAndWaitForOutput(command, expectedPattern);
      expect(out).toMatch(expectedPattern);
    });

    await test.step('Cleanup: remove source file on device', async () => {
      await context.deviceDetailPage.goto();
      await context.deviceDetailPage.waitForPageReady();
      await openTerminalSession(context);
      await context.terminalPage.runCommandAndWaitForTextChange(`rm -f ${validSourceFilePath}`);
    });

    setPullActualResult(
      testInfo,
      'TC-DA-E2E-006: Pull file succeeded after creating source content via Terminal.'
    );
  });
});
