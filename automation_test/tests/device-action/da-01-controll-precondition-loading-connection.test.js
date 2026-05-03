const base = require('@playwright/test');
const controlHelpers = require('../../pages/devices/device-detail/test-helpers/control-test-helpers');
const {
  expect,
  createControlContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  controlConfig,
  setActualResult,
} = controlHelpers;
const {
  attachJson,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
} = require('../../pages/devices/device-detail/test-helpers/device-action-shared');
const { authFile } = require('./device-actions-shared');

// Rule 11.1 & 16.2: Use Fixture to initialize shared POM
const extendedTest = base.test.extend({
  page: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

const extendedTest1 = extendedTest;
extendedTest1.use({ storageState: authFile });
const test = extendedTest1;

extendedTest1.describe('Section 1 — Device Control Action: Precondition, Loading, Connection', () => {
  extendedTest1('TC-DA-001~003: Precondition, loading UI, and connected session', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    await test.step('Run main flow', async () => {
      const context = createControlContext(page);

      // TC-DA-001: precondition
      await openOnlineDeviceDetail(context);

      // TC-DA-002: loading UI
      await context.deviceDetailPage.openControlFromDeviceDetail();
      await context.deviceControlPage.waitForControlPageReady();
      await context.deviceControlPage.waitForLoadingState();

      // TC-DA-003: connected session
      const controlResult = await context.deviceControlPage.waitForConnected();
      expect(controlResult.isConnected).toBeTruthy();
      expect(
        controlResult.mediaVisible || controlResult.connectionState === 'connected'
      ).toBeTruthy();

      setActualResult(
        testInfo,
        `Control session connected successfully and the page reached connected state${controlResult.mediaVisible ? ' with remote screen media visible' : ''}`
      );
    });
  });
});

extendedTest1.describe('Section 2 — Activity Log Verification', () => {
  extendedTest1('TC-DA-004: Verify Activity Log contains Control entry with Success status', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    await test.step('Run main flow', async () => {
      const context = createControlContext(page);

      await openActivityTabReady(context);
      const existingLogSignatures = await context.deviceDetailPage.getActivityLogSignatures();
      await context.deviceDetailPage.openControlFromDeviceDetail();
      await context.deviceControlPage.waitForControlPageReady();
      await context.deviceControlPage.waitForLoadingState();
      await context.deviceControlPage.waitForConnected();

      await context.deviceDetailPage.openActivityTab();
      await context.deviceDetailPage.waitForPageReady();
      await context.deviceDetailPage.waitForActivityLogsReady();

      const controlLog = await context.deviceDetailPage.waitForNewControlSuccessLog(
        existingLogSignatures
      );

      expect(controlLog).not.toBeNull();
      expect(controlLog.statusText).toMatch(/success/i);

      setActualResult(
        testInfo,
        `A new Control-related Activity Log entry was created successfully with status "${controlLog.statusText}"`
      );
    });
  });
});

extendedTest1.describe('Section 3 — Negative: Disconnected State', () => {
  extendedTest1('TC-DA-005: Verify disconnected UI when control session cannot connect', async ({ page }, testInfo) => {
    test.skip(
      !controlConfig.failureTargetDeviceId || process.env.RUN_NEGATIVE_CONTROL !== '1',
      'Negative Control test is skipped unless RUN_NEGATIVE_CONTROL=1 and a failureTargetDeviceId is configured.'
    );

    await test.step('Run main flow', async () => {
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
        `Control session did not connect successfully and the page ended in ${failureResult.isTimedOut ? 'timeout' : 'disconnected'} state`
      );
    });
  });
});

extendedTest1.describe('Section 4 — Terminal Verification', () => {
  extendedTest1('TC-DA-006: Start Control session and verify Terminal on the same Android device', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('Run main flow', async () => {
      const context = createControlContext(page);

      await openOnlineDeviceDetail(context);
      await context.deviceDetailPage.openControlFromDeviceDetail();
      await context.deviceControlPage.waitForControlPageReady();
      await context.deviceControlPage.waitForLoadingState();
      const controlResult = await context.deviceControlPage.waitForConnected();

      let terminalOutput = '';
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

      await attachJson(testInfo, 'control-terminal-verification', {
        controlResult,
        command: context.terminalVerifyCommand,
        terminalOutput,
      });

      setActualResult(
        testInfo,
        `Control session connected successfully${controlResult.mediaVisible ? ' with remote media visible' : ''}, and terminal command "${context.terminalVerifyCommand}" also confirmed the same Android device was reachable.`
      );
    });
  });
});
