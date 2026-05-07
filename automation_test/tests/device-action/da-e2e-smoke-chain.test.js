const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const {
  createSnapshotContext,
  prepareSnapshotFlow,
  runSnapshotHappyFlow,
} = require('../../pages/devices/device-detail/modules/device-actions/snapshot');
const {
  createPushFileContext,
  openActivityTabReady,
  selectConfiguredPushFileResource,
  validDestinationPath,
  resolvePushFileTerminalTargetPath,
  cleanupPushFileTarget,
} = require('../../pages/devices/device-detail/modules/device-actions/push-file');
const {
  createPullFileContext,
  openActivityTabReady: openPullReady,
  validSourceFilePath,
} = require('../../pages/devices/device-detail/modules/device-actions/pull-file');
const {
  createInstallContext,
  installConfiguredApp,
  cleanupInstalledApp,
  ensureConfiguredPackageAbsent,
  setActualResult: setInstallResult,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
const { openTerminalSession, withFreshPageContext } = require('../../pages/devices/device-detail/modules/device-actions/shared');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

test.describe('E2E — Smoke chain', () => {
  test('TC-DA-E2E-048: Chained smoke — Snapshot → Push file → Pull file → Install → Terminal id', async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.RUN_DA_E2E_CHAIN !== '1',
      'Long-running cross-action chain; set RUN_DA_E2E_CHAIN=1 to enable (spreadsheet TC-DA-E2E-048).'
    );

    test.setTimeout(25 * 60 * 1000);
    let pushCleanupPath = '';

    await test.step('Snapshot', async () => {
      const ctx = createSnapshotContext(page);
      await prepareSnapshotFlow(ctx);
      await runSnapshotHappyFlow(ctx);
    });

    await test.step('Push file (minimal)', async () => {
      const ctx = createPushFileContext(page);
      pushCleanupPath = resolvePushFileTerminalTargetPath();
      if (pushCleanupPath) {
        await withFreshPageContext(page.context(), createPushFileContext, async (c) =>
          cleanupPushFileTarget(c, pushCleanupPath)
        );
      }
      await openActivityTabReady(ctx);
      const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
      await ctx.deviceDetailPage.clickPushFile();
      await ctx.deviceDetailPage.waitForPushFileModalVisible();
      await ctx.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
      const selectedResource = await selectConfiguredPushFileResource(ctx);
      await ctx.deviceDetailPage.confirmPushFile();
      await ctx.deviceDetailPage.waitForNewPushFileSuccessLog(prev);
      pushCleanupPath = resolvePushFileTerminalTargetPath(selectedResource) || pushCleanupPath;
    });

    await test.step('Prepare Pull source + Pull file', async () => {
      const ctx = createPullFileContext(page);
      await openTerminalSession(ctx);
      await ctx.terminalPage.runCommandAndWaitForTextChange(
        `echo chain-pull > ${validSourceFilePath}`
      );
      await openPullReady(ctx);
      const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
      await ctx.deviceDetailPage.clickPullFile();
      await ctx.deviceDetailPage.waitForPullFileModalVisible();
      await ctx.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
      await ctx.deviceDetailPage.confirmPullFile();
      await ctx.deviceDetailPage.waitForNewPullFileSuccessLog(prev);
      await ctx.terminalPage.runCommandAndWaitForTextChange(`rm -f ${validSourceFilePath}`);
    });

    let installRecord = null;
    await test.step('Install app + cleanup', async () => {
      const ctx = createInstallContext(page);
      await ensureConfiguredPackageAbsent(ctx);
      const result = await installConfiguredApp(ctx);
      installRecord = result.selectedRecord;
      expect(result.installSucceeded).toBeTruthy();
      await cleanupInstalledApp(ctx, installRecord);
    });

    await test.step('Terminal sanity', async () => {
      const ctx = createInstallContext(page);
      await ctx.deviceDetailPage.goto();
      await ctx.deviceDetailPage.waitForPageReady();
      await openTerminalSession(ctx);
      const cmd = config.pageURL?.devices?.terminal?.smokeCommand || 'id';
      const pattern = new RegExp(config.pageURL?.devices?.terminal?.smokeExpectedPattern || 'uid=', 'i');
      const out = await ctx.terminalPage.runCommandAndWaitForOutput(cmd, pattern);
      expect(out).toMatch(pattern);
    });

    if (pushCleanupPath) {
      await withFreshPageContext(page.context(), createPushFileContext, async (c) =>
        cleanupPushFileTarget(c, pushCleanupPath)
      );
    }

    setInstallResult(testInfo, 'TC-DA-E2E-048: Multi-action smoke chain completed when RUN_DA_E2E_CHAIN=1.');
  });
});
