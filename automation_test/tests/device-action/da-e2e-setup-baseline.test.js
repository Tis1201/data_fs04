const { expect } = require('@playwright/test');
const {
  createInstallContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
} = require('../../pages/devices/device-detail/modules/device-actions/install');
const { openTerminalSession, toRegExp } = require('../../pages/devices/device-detail/modules/device-actions/shared');
const config = require('../../config/config-loader');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();
const terminalCfg = config.pageURL?.devices?.terminal || {};

test.describe('E2E — Setup / Baseline', () => {
  test('TC-DA-E2E-001: Login state — open online device detail (Activity ready)', async ({ page }) => {
    const context = createInstallContext(page);

    await test.step('Navigate to device detail and land on Activity Logs', async () => {
      await openOnlineDeviceDetail(context);
      await openActivityTabReady(context);
      await expect(context.deviceDetailPage.activityLogsHeading).toBeVisible();
    });
  });

  test('TC-DA-E2E-002: Terminal baseline — connect and run safe commands', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const context = createInstallContext(page);

    await test.step('Open Terminal and wait for shell', async () => {
      await openOnlineDeviceDetail(context);
      await openTerminalSession(context);
    });

    const cmd = terminalCfg.smokeCommand || 'id';
    const pattern = toRegExp(terminalCfg.smokeExpectedPattern, /uid=/i);

    await test.step('Run id (or configured smoke command)', async () => {
      const outId = await context.terminalPage.runCommandAndWaitForOutput(cmd, pattern);
      expect(outId).toMatch(pattern);
    });

    await test.step('Run pwd', async () => {
      const outPwd = await context.terminalPage.runCommandAndWaitForOutput('pwd', /\//);
      expect(outPwd.length).toBeGreaterThan(0);
    });
  });
});
