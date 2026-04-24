const {
  test,
  expect,
  createControlContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  controlConfig,
  setActualResult,
  setTestCaseMetadata,
} = require('./controll-test-helpers');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
} = require('../shared/device-action-common');

test.describe('Device detail - Control action', () => {
  // ── TC-CONTROL-001 ~ 003: Precondition, Loading UI, Connected Session ────
  test('TC-CONTROL-001~003: Precondition, loading UI, and connected session', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-CONTROL-001~003',
      category: 'Control',
      title: 'Navigate to device detail, click Control, and verify session connects',
      precondition: 'User is logged in, target device is Online, and device can accept a remote desktop session',
      steps: [
        'Open Device detail page and verify device is Online',
        'Verify Control button is visible and enabled',
        'Click Control button',
        'Verify Remote Desktop page opens and shows loading state',
        'Wait for control session to connect',
        'Verify device screen is displayed',
      ],
      expected: 'Control session connects successfully and remote device screen is displayed',
    });

    const context = createControlContext(page);

    // TC-CONTROL-001: precondition
    await openOnlineDeviceDetail(context);

    // TC-CONTROL-002: loading UI
    await context.deviceDetailPage.openControlFromDeviceDetail();
    await context.deviceControlPage.waitForControlPageReady();
    await context.deviceControlPage.waitForLoadingState();

    // TC-CONTROL-003: connected session
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

  // ── TC-CONTROL-004: Activity Log Success ──────────────────────────────────
  test('TC-CONTROL-004: Verify Activity Log contains Control entry with Success status', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-CONTROL-004',
      category: 'Control',
      title: 'Verify Activity Log contains Control entry with Success status',
      precondition: 'User is logged in, target device is Online, and device can establish a control session successfully',
      steps: [
        'Open Device detail page on Activity tab',
        'Capture existing Activity Log entries',
        'Click Control button',
        'Wait for control session to connect successfully',
        'Open Activity tab again',
        'Wait for a new Control-related Activity Log entry',
        'Verify the final status is Success',
      ],
      expected: 'A new Control-related Activity Log entry is created with Success status after session connects',
    });

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

  // ── TC-CONTROL-005: Disconnected state ────────────────────────────────────
  test('TC-CONTROL-005: Verify disconnected UI when control session cannot connect', async ({ page }, testInfo) => {
    test.skip(
      !controlConfig.failureTargetDeviceId,
      'Set CONTROL_FAILURE_TARGET_DEVICE_ID or CONTROL_OFFLINE_TARGET_DEVICE_ID before running the negative Control test.'
    );

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-CONTROL-005',
      category: 'Control',
      title: 'Verify disconnected UI when control session cannot connect',
      precondition: 'User is logged in and a target device that cannot establish control session is available',
      steps: [
        'Open Device detail page for failure target',
        'Click Control button',
        'Verify Remote Desktop page opens and shows loading state',
        'Wait for timeout or disconnected state',
        'Verify disconnected UI is displayed',
      ],
      expected: 'If control session cannot connect, the page shows disconnected UI or timeout feedback',
    });

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

  // ── TC-CONTROL-006: Terminal verification ─────────────────────────────────
  test('TC-CONTROL-006: Start Control session and verify Terminal on the same Android device', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-CONTROL-006',
      category: 'Control Terminal',
      title: 'Start Control session and verify Terminal on the same Android device',
      precondition: 'User is logged in, target device is Online, the device can accept a control session, and Terminal can be opened for the same device',
      steps: [
        'Open Device detail page',
        'Start Control and wait for the session to connect successfully',
        'Open a fresh page for the same device',
        'Open Terminal for that device',
        'Run the configured terminal verification command',
        'Verify terminal output confirms the Android shell is reachable while Control is available',
      ],
      expected: 'Control session connects successfully and Terminal also works for the same Android device',
    });

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
