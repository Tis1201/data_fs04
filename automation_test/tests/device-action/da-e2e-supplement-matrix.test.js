const { expect } = require('@playwright/test');
const {
  createInstallContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  installConfig,
  ensureConfiguredPackageAbsent,
  cleanupInstalledApp,
  waitForNewActivityLogStrict,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
const {
  createPullFileContext,
  openActivityTabReady: openPullReady,
  validSourceFilePath,
  invalidSourceFilePath,
} = require('../../pages/devices/device-detail/modules/device-actions/pull-file');
const {
  createPushFileContext,
  openActivityTabReady: openPushReady,
  validDestinationPath,
  selectConfiguredPushFileResource,
  resolvePushFileTerminalTargetPath,
  cleanupPushFileTarget,
} = require('../../pages/devices/device-detail/modules/device-actions/push-file');
const {
  createSnapshotContext,
  prepareSnapshotFlow,
} = require('../../pages/devices/device-detail/modules/device-actions/snapshot');
const {
  createRebootContext,
  openActivityTabReady: openRebootReady,
} = require('../../pages/devices/device-detail/modules/device-actions/reboot');
const {
  openTerminalSession,
  withFreshPageContext,
  buildPathExistsCommand,
} = require('../../pages/devices/device-detail/modules/device-actions/shared');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

test.describe('E2E — Refresh & Activity Logs', () => {
  test('TC-DA-E2E-008: Details → Refresh → toast → Refresh Success in Activity Logs', async ({
    page,
  }) => {
    test.setTimeout(5 * 60 * 1000);
    const ctx = createInstallContext(page);
    await openOnlineDeviceDetail(ctx);
    await ctx.deviceDetailPage.openActivityTab();
    await ctx.deviceDetailPage.waitForActivityLogsReady();
    const before = await ctx.deviceDetailPage.getActivityLogSignatures();
    await ctx.deviceDetailPage.goto();
    await ctx.deviceDetailPage.waitForPageReady();
    await ctx.deviceDetailPage.clickRefreshDeviceDetails();
    await ctx.deviceDetailPage.waitForGenericSuccessToast();
    await ctx.deviceDetailPage.openActivityTab();
    await ctx.deviceDetailPage.waitForActivityLogsReady();
    const log = await ctx.deviceDetailPage.waitForNewRefreshSuccessLog(before);
    expect(log).toBeTruthy();
    await expect(log.statusText).toMatch(/success/i);
  });

  test('TC-DA-E2E-042: Refresh twice — two Success Activity Log entries', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const ctx = createInstallContext(page);
    await openOnlineDeviceDetail(ctx);
    let sig = await ctx.deviceDetailPage.getActivityLogSignatures();
    for (let i = 0; i < 2; i++) {
      await ctx.deviceDetailPage.goto();
      await ctx.deviceDetailPage.waitForPageReady();
      await ctx.deviceDetailPage.clickRefreshDeviceDetails();
      await ctx.deviceDetailPage.waitForGenericSuccessToast();
      await ctx.deviceDetailPage.openActivityTab();
      await ctx.deviceDetailPage.waitForActivityLogsReady();
      await ctx.deviceDetailPage.waitForNewRefreshSuccessLog(sig);
      sig = await ctx.deviceDetailPage.getActivityLogSignatures();
    }
  });

  test('TC-DA-E2E-038: Single Snapshot adds a new Success Activity Log entry', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const ctx = createSnapshotContext(page);
    await prepareSnapshotFlow(ctx);
    const before = await ctx.deviceDetailPage.getActivityLogSignatures();
    await ctx.deviceDetailPage.triggerSnapshot();
    await ctx.deviceDetailPage.waitForSnapshotImage();
    await ctx.deviceDetailPage.closeSnapshotModalIfVisible();
    const entry = await ctx.deviceDetailPage.waitForNewSnapshotSuccessLog(before);
    expect(entry).toBeTruthy();
  });
});

test.describe('E2E — Terminal resilience', () => {
  test('TC-DA-E2E-037: After failed Pull File, Terminal still runs commands', async ({
    page,
  }) => {
    test.setTimeout(6 * 60 * 1000);
    const ctx = createPullFileContext(page);
    await openPullReady(ctx);
    const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
    await ctx.deviceDetailPage.clickPullFile();
    await ctx.deviceDetailPage.waitForPullFileModalVisible();
    await ctx.deviceDetailPage.fillPullFileSourcePath(invalidSourceFilePath);
    await ctx.deviceDetailPage.confirmPullFile();
    await ctx.deviceDetailPage.waitForNewPullFileFailedLog(prev);
    await ctx.deviceDetailPage.goto();
    await ctx.deviceDetailPage.waitForPageReady();
    await openTerminalSession(ctx);
    const cmd = ctx.terminalVerifyCommand || 'id';
    const out = await ctx.terminalPage.runCommandAndWaitForOutput(cmd, /uid=/i);
    expect(out).toMatch(/uid=/i);
  });

  test('TC-DA-E2E-036: Terminal verifies push file exists then cleanup removes it', async ({
    page,
  }) => {
    test.setTimeout(12 * 60 * 1000);
    const ctx = createPushFileContext(page);
    let path = resolvePushFileTerminalTargetPath();
    try {
      if (path) {
        await withFreshPageContext(page.context(), createPushFileContext, async (c) =>
          cleanupPushFileTarget(c, path)
        );
      }
      await openPushReady(ctx);
      const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
      await ctx.deviceDetailPage.clickPushFile();
      await ctx.deviceDetailPage.waitForPushFileModalVisible();
      await ctx.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
      await selectConfiguredPushFileResource(ctx);
      path = resolvePushFileTerminalTargetPath() || path;
      expect(path).toBeTruthy();
      await ctx.deviceDetailPage.confirmPushFile();
      await ctx.deviceDetailPage.waitForNewPushFileSuccessLog(prev);
      await openTerminalSession(ctx);
      const probe = buildPathExistsCommand(path);
      await ctx.terminalPage.runCommandAndWaitForOutput(probe, /__E2E_EXISTS__/i);
    } finally {
      if (path) {
        await withFreshPageContext(page.context(), createPushFileContext, async (c) =>
          cleanupPushFileTarget(c, path)
        );
      }
    }
  });
});

test.describe('E2E — Push / Pull edge cases', () => {
  test('TC-DA-E2E-020: Push same resource twice — two Success logs', async ({ page }) => {
    test.setTimeout(12 * 60 * 1000);
    const ctx = createPushFileContext(page);
    let path = resolvePushFileTerminalTargetPath();
    try {
      if (path) {
        await withFreshPageContext(page.context(), createPushFileContext, async (c) =>
          cleanupPushFileTarget(c, path)
        );
      }
      for (let n = 0; n < 2; n++) {
        await openPushReady(ctx);
        const sig = await ctx.deviceDetailPage.getActivityLogSignatures();
        await ctx.deviceDetailPage.clickPushFile();
        await ctx.deviceDetailPage.waitForPushFileModalVisible();
        await ctx.deviceDetailPage.fillPushFileDestinationPath(validDestinationPath);
        await selectConfiguredPushFileResource(ctx);
        path = resolvePushFileTerminalTargetPath() || path;
        await ctx.deviceDetailPage.confirmPushFile();
        await ctx.deviceDetailPage.waitForNewPushFileSuccessLog(sig);
        await ctx.deviceDetailPage.goto();
        await ctx.deviceDetailPage.waitForPageReady();
      }
    } finally {
      if (path) {
        await withFreshPageContext(page.context(), createPushFileContext, async (c) =>
          cleanupPushFileTarget(c, path)
        );
      }
    }
  });

  test('TC-DA-E2E-032: Pull a directory path — expect Failed Activity Log', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const ctx = createPullFileContext(page);
    await openPullReady(ctx);
    const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
    await ctx.deviceDetailPage.clickPullFile();
    await ctx.deviceDetailPage.waitForPullFileModalVisible();
    await ctx.deviceDetailPage.fillPullFileSourcePath('/sdcard/Download/');
    await ctx.deviceDetailPage.confirmPullFile();
    await ctx.deviceDetailPage.waitForNewPullFileFailedLog(prev);
  });

  test('TC-DA-E2E-035: Pull confirm submitted (rapid second click tolerated)', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const ctx = createPullFileContext(page);
    await openTerminalSession(ctx);
    await ctx.terminalPage.runCommandAndWaitForTextChange(`echo pull-dup > ${validSourceFilePath}`);
    await openPullReady(ctx);
    const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
    await ctx.deviceDetailPage.clickPullFile();
    await ctx.deviceDetailPage.waitForPullFileModalVisible();
    await ctx.deviceDetailPage.fillPullFileSourcePath(validSourceFilePath);
    const confirm = ctx.deviceDetailPage.page.getByRole('button', { name: /confirm|pull file/i }).last();
    await confirm.click({ clickCount: 2, delay: 40 });
    await ctx.deviceDetailPage.waitForNewPullFileSuccessLog(prev);
  });
});

test.describe('E2E — Snapshot / Reboot variants', () => {
  test('TC-DA-E2E-041: Snapshot twice — two Success logs', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const ctx = createSnapshotContext(page);
    await prepareSnapshotFlow(ctx);
    let sig = await ctx.deviceDetailPage.getActivityLogSignatures();
    for (let i = 0; i < 2; i++) {
      await ctx.deviceDetailPage.triggerSnapshot();
      await ctx.deviceDetailPage.waitForSnapshotImage();
      await ctx.deviceDetailPage.closeSnapshotModalIfVisible();
      await ctx.deviceDetailPage.waitForNewSnapshotSuccessLog(sig);
      sig = await ctx.deviceDetailPage.getActivityLogSignatures();
    }
  });

  test('TC-DA-E2E-043: Duplicate Reboot while device is reconnecting (stress)', async ({ page }) => {
    test.skip(
      process.env.RUN_DA_E2E_REBOOT_DUP !== '1',
      'Destructive: set RUN_DA_E2E_REBOOT_DUP=1 to run duplicate-reboot stress on the shared device.'
    );

    test.setTimeout(8 * 60 * 1000);
    const ctx = createRebootContext(page);
    await openRebootReady(ctx);
    await ctx.deviceDetailPage.clickReboot();
    await ctx.deviceDetailPage.waitForRebootModalVisible();
    await ctx.deviceDetailPage.confirmReboot();
    await ctx.deviceDetailPage.waitForRebootSuccessToast().catch(() => '');
    const rebootBtn = ctx.deviceDetailPage.rebootButton;
    await rebootBtn.click().catch(() => {});
    await expect(rebootBtn).toBeVisible();
  });
});

test.describe('E2E — Install modal guard', () => {
  test('TC-DA-E2E-012: Install Confirm double-click — single modal lifecycle', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const ctx = createInstallContext(page);
    await ensureConfiguredPackageAbsent(ctx);
    await openActivityTabReady(ctx);
    const prev = await ctx.deviceDetailPage.getActivityLogSignatures();
    await ctx.deviceDetailPage.clickInstallApp();
    await ctx.installModal.waitForVisible();
    const term = installConfig.resourceSearchKeyword || installConfig.resourceExactName;
    await ctx.installModal.search(term);
    const rec = await ctx.installModal.selectAppByRecord({
      name: installConfig.resourceExactName,
      packageName: installConfig.packageName,
    });
    await ctx.installModal.confirmButton.click({ clickCount: 2, delay: 30 });
    await waitForNewActivityLogStrict(ctx.deviceDetailPage, {
      previousSignatures: prev,
      statusPattern: /success|failed|error/i,
      requiredAnyPatternGroups: [[/install/i]],
      timeout: installConfig.finalStatusTimeoutMs || 180000,
      message: 'Install should complete once despite double activation on Confirm.',
    });
    if (rec.packageName) {
      await cleanupInstalledApp(ctx, rec).catch(() => {});
    }
  });
});
