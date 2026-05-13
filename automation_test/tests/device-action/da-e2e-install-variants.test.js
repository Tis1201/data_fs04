const { expect } = require('@playwright/test');
const {
  createInstallContext,
  installConfiguredApp,
  openActivityTabReady,
  openOnlineDeviceDetail,
  waitForNewActivityLogStrict,
  cleanupInstalledApp,
  ensureConfiguredPackageAbsent,
  installConfig,
  attachJson,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

function buildInstallGroups(record) {
  const g = [];
  if (record?.packageName) {
    g.push([/install/i, record.packageName]);
  }
  if (record?.name) {
    g.push([/install/i, record.name]);
  }
  return g.length ? g : [[/install/i]];
}

async function installByExactName(context, exactName) {
  await openActivityTabReady(context);
  const prev = await context.deviceDetailPage.getActivityLogSignatures();
  await context.deviceDetailPage.clickInstallApp();
  await context.installModal.waitForVisible();
  await context.installModal.search(exactName);
  const selected = await context.installModal.selectAppByName(exactName);
  await context.installModal.confirm();
  const log = await waitForNewActivityLogStrict(context.deviceDetailPage, {
    previousSignatures: prev,
    statusPattern: /success|failed|error/i,
    requiredAnyPatternGroups: buildInstallGroups(selected),
    timeout:
      installConfig.finalStatusTimeoutMs ||
      context.deviceDetailPage.timeouts?.activityLog ||
      180000,
    message: `Install Activity Log for resource "${exactName}"`,
  });
  return {
    selected,
    log,
    installSucceeded: /success/i.test(log.statusText),
  };
}

async function readPackageVersionName(context, packageName) {
  await openOnlineDeviceDetail(context);
  await context.deviceDetailPage.openTerminalFromDeviceDetail();
  await context.terminalPage.waitForTerminalPageReady();
  await context.terminalPage.waitForTerminalConnected();
  await context.terminalPage.waitForShellPrompt();
  const out = await context.terminalPage.runCommandAndWaitForOutput(
    `dumpsys package ${packageName} | grep versionName`,
    /versionName=/i
  );
  const m = out.match(/versionName=([^\s\r\n]+)/);
  return (m && m[1]) || '';
}

test.describe('E2E — Install App variants', () => {
  test('TC-DA-E2E-011: Install the same resource twice — two Activity Log entries', async ({
    page,
  }, testInfo) => {
    test.setTimeout(14 * 60 * 1000);
    const context = createInstallContext(page);
    let record = null;

    try {
      await test.step('Pre-clean target package before install-twice flow', async () => {
        await ensureConfiguredPackageAbsent(context);
      });

      await test.step('Run first install and verify final status', async () => {
        const first = await installConfiguredApp(context);
        record = first.selectedRecord;
        expect(first.installSucceeded).toBeTruthy();
      });

      await test.step('Second install with the same modal selection', async () => {
        await openActivityTabReady(context);
        const prev = await context.deviceDetailPage.getActivityLogSignatures();
        await context.deviceDetailPage.clickInstallApp();
        await context.installModal.waitForVisible();
        const searchTerm =
          installConfig.resourceExactName ||
          installConfig.resourceSearchKeyword ||
          record.packageName ||
          record.name;
        await context.installModal.search(searchTerm);
        await context.installModal.selectAppByRecord({
          name: record.name,
          packageName: record.packageName,
        });
        await context.installModal.confirm();

        const secondLog = await waitForNewActivityLogStrict(context.deviceDetailPage, {
          previousSignatures: prev,
          statusPattern: /success|failed|error/i,
          requiredAnyPatternGroups: buildInstallGroups(record),
          timeout:
            installConfig.finalStatusTimeoutMs ||
            context.deviceDetailPage.timeouts?.activityLog ||
            180000,
          message: 'Second install did not produce a final Activity Log entry.',
        });
        expect(secondLog).not.toBeNull();
        await attachJson(testInfo, 'tc-da-e2e-011-second-log', { secondLog });
      });
    } finally {
      await test.step('Cleanup: remove installed package', async () => {
        if (record) {
          await cleanupInstalledApp(context, record);
        }
      });
    }

    setActualResult(
      testInfo,
      'TC-DA-E2E-011: Two install attempts recorded; second operation reached a final log state.'
    );
  });

  test('TC-DA-E2E-013: Upgrade — older APK then newer APK (same package)', async ({
    page,
  }, testInfo) => {
    test.skip(
      !installConfig.e2eOlderResourceExactName ||
        !installConfig.e2eNewerResourceExactName ||
        !installConfig.packageName,
      'Set devices.installApp.e2eOlderResourceExactName, e2eNewerResourceExactName, and packageName (same package for both APKs).'
    );

    test.setTimeout(20 * 60 * 1000);
    const ctx = createInstallContext(page);
    const pkg = installConfig.packageName;

    try {
      await test.step('Pre-clean package before upgrade flow', async () => {
        await ensureConfiguredPackageAbsent(ctx);
      });

      let vBefore = '';
      await test.step('Install older build and capture versionName', async () => {
        const older = await installByExactName(ctx, installConfig.e2eOlderResourceExactName);
        expect(older.installSucceeded).toBeTruthy();
        vBefore = await readPackageVersionName(ctx, pkg);
        await attachJson(testInfo, 'tc-da-e2e-013-version-before', { vBefore });
      });

      await test.step('Install newer build and verify version changes', async () => {
        const newer = await installByExactName(ctx, installConfig.e2eNewerResourceExactName);
        expect(newer.installSucceeded).toBeTruthy();

        const vAfter = await readPackageVersionName(ctx, pkg);
        await attachJson(testInfo, 'tc-da-e2e-013-version-after', { vAfter });

        expect(vAfter.length).toBeGreaterThan(0);
        if (vBefore && vAfter) {
          expect(vAfter).not.toBe(vBefore);
        }
      });
    } finally {
      await test.step('Cleanup: remove target package', async () => {
        await cleanupInstalledApp(ctx, { packageName: pkg }).catch(() => {});
      });
    }

    setActualResult(testInfo, 'TC-DA-E2E-013: Newer build reported a different versionName in dumpsys after upgrade.');
  });

  test('TC-DA-E2E-014: Re-install equal version (same versionName after second install)', async ({
    page,
  }, testInfo) => {
    test.skip(
      !installConfig.e2eEqualResourceExactName || !installConfig.packageName,
      'Set devices.installApp.e2eEqualResourceExactName and packageName.'
    );

    test.setTimeout(16 * 60 * 1000);
    const ctx = createInstallContext(page);
    const pkg = installConfig.packageName;

    try {
      await test.step('Pre-clean package before equal-version reinstall flow', async () => {
        await ensureConfiguredPackageAbsent(ctx);
      });

      await test.step('Install same build twice and compare versionName', async () => {
        const first = await installByExactName(ctx, installConfig.e2eEqualResourceExactName);
        expect(first.installSucceeded).toBeTruthy();
        const v1 = await readPackageVersionName(ctx, pkg);

        const second = await installByExactName(ctx, installConfig.e2eEqualResourceExactName);
        expect(second.installSucceeded).toBeTruthy();
        const v2 = await readPackageVersionName(ctx, pkg);

        expect(v2).toBe(v1);
        await attachJson(testInfo, 'tc-da-e2e-014-versions', { v1, v2 });
      });
    } finally {
      await test.step('Cleanup: remove target package', async () => {
        await cleanupInstalledApp(ctx, { packageName: pkg }).catch(() => {});
      });
    }

    setActualResult(testInfo, 'TC-DA-E2E-014: versionName unchanged after reinstalling the same APK build.');
  });

  test('TC-DA-E2E-015: Downgrade — newer installed then attempt older APK', async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.RUN_DA_E2E_DOWNGRADE !== '1' ||
        !installConfig.e2eOlderResourceExactName ||
        !installConfig.e2eNewerResourceExactName ||
        !installConfig.packageName,
      'Risky: set RUN_DA_E2E_DOWNGRADE=1 and both e2e APK names. Skipped by default.'
    );

    test.setTimeout(20 * 60 * 1000);
    const ctx = createInstallContext(page);
    const pkg = installConfig.packageName;

    try {
      await test.step('Pre-clean package before downgrade flow', async () => {
        await ensureConfiguredPackageAbsent(ctx);
      });

      await test.step('Install newer build and capture versionName', async () => {
        await installByExactName(ctx, installConfig.e2eNewerResourceExactName);
      });

      await test.step('Install older build and verify version changed', async () => {
        const vHigh = await readPackageVersionName(ctx, pkg);
        const down = await installByExactName(ctx, installConfig.e2eOlderResourceExactName);
        expect(down.installSucceeded).toBeTruthy();
        const vLow = await readPackageVersionName(ctx, pkg);

        await attachJson(testInfo, 'tc-da-e2e-015-downgrade', { vHigh, vLow });
        expect(vLow).not.toBe(vHigh);
      });
    } finally {
      await test.step('Cleanup: remove target package', async () => {
        await cleanupInstalledApp(ctx, { packageName: pkg }).catch(() => {});
      });
    }

    setActualResult(testInfo, 'TC-DA-E2E-015: Downgrade path executed (device-dependent).');
  });
});
