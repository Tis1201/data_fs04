const { expect } = require('@playwright/test');
const {
  createControlContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  controlConfig,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/control');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
} = require('../../pages/devices/device-detail/modules/device-actions/shared');
const { createDeviceActionTest } = require('./da-e2e-shared');

const test = createDeviceActionTest();

test.describe('E2E — Control', () => {
  test('TC-DA-E2E-010: Full flow — Activity logs baseline → Control → Success log → close', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
    const context = createControlContext(page);

    await test.step('Capture Activity Log signatures', async () => {
      await openActivityTabReady(context);
    });

    const existingLogSignatures = await context.deviceDetailPage.getActivityLogSignatures();

    await test.step('Open Control and wait for connected remote session', async () => {
      await context.deviceDetailPage.openControlFromDeviceDetail();
      await context.deviceControlPage.waitForControlPageReady();
      await context.deviceControlPage.waitForLoadingState();
      const controlResult = await context.deviceControlPage.waitForConnected();
      expect(controlResult.isConnected).toBeTruthy();
      expect(
        controlResult.mediaVisible || controlResult.connectionState === 'connected'
      ).toBeTruthy();
    });

    await test.step('Return to Device detail Activity Logs and assert new Control Success entry', async () => {
      await context.deviceDetailPage.goto();
      await context.deviceDetailPage.waitForPageReady();
      await context.deviceDetailPage.openActivityTab();
      await context.deviceDetailPage.waitForActivityLogsReady();
      const controlLog = await context.deviceDetailPage.waitForNewControlSuccessLog(existingLogSignatures);
      expect(controlLog).not.toBeNull();
      expect(controlLog.statusText).toMatch(/success/i);
    });

    setActualResult(
      testInfo,
      `TC-DA-E2E-010: Control reached connected state and Activity Logs show Success for the session.`
    );
  });

  test('TC-DA-E2E-010 · Regression: Terminal command still validates same device after Control', async ({
    page,
  }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
    const context = createControlContext(page);

    await test.step('Establish Control session', async () => {
      await openOnlineDeviceDetail(context);
      await context.deviceDetailPage.openControlFromDeviceDetail();
      await context.deviceControlPage.waitForControlPageReady();
      await context.deviceControlPage.waitForLoadingState();
      const controlResult = await context.deviceControlPage.waitForConnected();
      expect(controlResult.isConnected).toBeTruthy();
    });

    let terminalOutput = '';
    await test.step('Fresh page: Terminal smoke command', async () => {
      await withFreshPageContext(page.context(), createControlContext, async (terminalContext) => {
        await openOnlineDeviceDetail(terminalContext);
        await openTerminalSession(terminalContext);
        const expectedPattern = toRegExp(
          terminalContext.terminalVerifyExpectedPattern,
          /uid=/i
        );
        terminalOutput = await terminalContext.terminalPage.runCommandAndWaitForOutput(
          terminalContext.terminalVerifyCommand,
          expectedPattern
        );
        expect(terminalOutput).toMatch(expectedPattern);
      });
    });

    await attachJson(testInfo, 'tc-da-e2e-010-terminal', { terminalOutput });
    setActualResult(testInfo, 'Terminal smoke command succeeded after Control session (cross-check).');
  });

  test('TC-DA-E2E-044: Second Control attempt after returning to Device detail remains stable', async ({
    page,
  }) => {
    test.setTimeout(6 * 60 * 1000);
    const context = createControlContext(page);
    await openOnlineDeviceDetail(context);
    await context.deviceDetailPage.openControlFromDeviceDetail();
    await context.deviceControlPage.waitForControlPageReady();
    await context.deviceControlPage.waitForLoadingState();
    await context.deviceControlPage.waitForConnected();
    await context.deviceDetailPage.goto();
    await context.deviceDetailPage.waitForPageReady();
    await context.deviceDetailPage.openControlFromDeviceDetail();
    await context.deviceControlPage.waitForControlPageReady();
    await context.deviceControlPage.waitForLoadingState();
    const second = await context.deviceControlPage.waitForConnected();
    expect(second.isConnected).toBeTruthy();
  });

  test('TC-DA-E2E-010-Negative (legacy TC-DA-005): failure device stays disconnected', async ({
    page,
  }, testInfo) => {
    test.skip(
      !controlConfig.failureTargetDeviceId || process.env.RUN_NEGATIVE_CONTROL !== '1',
      'Set RUN_NEGATIVE_CONTROL=1 and configure devices.control.failureTargetDeviceId to run.'
    );

    const context = createControlContext(page, controlConfig.failureTargetDeviceId);
    await context.deviceDetailPage.goto();
    await context.deviceDetailPage.waitForPageReady();
    await context.deviceDetailPage.openControlFromDeviceDetail();
    await context.deviceControlPage.waitForControlPageReady();
    await context.deviceControlPage.waitForLoadingState();

    const failureResult = await context.deviceControlPage.waitForDisconnectedOrTimeout();

    expect(failureResult.isDisconnected || failureResult.isTimedOut).toBeTruthy();
    expect(failureResult.isConnected).toBeFalsy();

    setActualResult(
      testInfo,
      'Negative Control path: session did not connect; UI ended disconnected or timed out.'
    );
  });
});
