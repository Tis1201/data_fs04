const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../config/config-loader');
const DeviceDetailPage = require('../pages/devices/device-detail/device-detail-page');
const DeviceTerminalPage = require('../pages/iot/device-terminal-page');

const authFile = path.join(__dirname, '..', 'user.json');

test.use({ storageState: authFile });

function setTestCaseMetadata(testInfo, data) {
  testInfo.annotations.push({ type: 'testcase_id', description: data.testcaseId });
  testInfo.annotations.push({ type: 'category', description: data.category });
  testInfo.annotations.push({ type: 'title', description: data.title });
  testInfo.annotations.push({ type: 'precondition', description: data.precondition });
  testInfo.annotations.push({ type: 'steps', description: data.steps.join(' | ') });
  testInfo.annotations.push({ type: 'expected', description: data.expected });
}

function setActualResult(testInfo, actualResult) {
  testInfo.annotations.push({ type: 'actual_result', description: actualResult });
}

test.describe('Device detail - Terminal action', () => {
  let deviceDetailPage;
  let terminalPage;

  const terminalConfig = config.pageURL?.devices?.terminal || {};
  const targetDeviceId =
    terminalConfig.targetDeviceId ||
    config.pageURL?.devices?.installApp?.targetDeviceId ||
    config.pageURL?.devices?.snapshotTargetDeviceId;

  const smokeExpectedPattern = new RegExp(terminalConfig.smokeExpectedPattern || 'uid=', 'i');
  const invalidExpectedPattern = new RegExp(
    terminalConfig.invalidExpectedPattern ||
      'not found|inaccessible|unknown command|No such file|permission denied',
    'i'
  );
  const recoveryExpectedPattern = new RegExp(
    terminalConfig.recoveryExpectedPattern || terminalConfig.smokeExpectedPattern || 'uid=',
    'i'
  );

  test.beforeEach(async ({ page }) => {
    deviceDetailPage = new DeviceDetailPage(page, {
      appUrl: config.appURL,
      devicePath: config.pageURL?.devices?.detailPath,
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        activityLog: config.timeouts?.activityLogMs,
      },
      maxActivityLogRows: 20,
    });

    terminalPage = new DeviceTerminalPage(page, {
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        terminalReady: config.timeouts?.terminalReadyMs,
        terminalCommand: config.timeouts?.terminalCommandMs,
      },
    });
  });

  test('TC-TERMINAL-001: Navigate to Device detail and verify terminal precondition', async ({}, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-TERMINAL-001',
      category: 'Terminal',
      title: 'Navigate to Device detail and verify terminal precondition',
      precondition: 'User is logged in and target device exists',
      steps: [
        'Open Device detail page',
        'Verify page is loaded',
        'Verify device status is Online',
        'Verify Terminal button is visible',
        'Verify Terminal button is enabled',
      ],
      expected:
        'Device detail page loads successfully, target device is Online, and Terminal button is ready for interaction',
    });

    await deviceDetailPage.goto();
    await deviceDetailPage.waitForPageReady();
    await deviceDetailPage.verifyDeviceIsOnline();
    await expect(deviceDetailPage.terminalButton).toBeVisible();
    await expect(deviceDetailPage.terminalButton).toBeEnabled();

    setActualResult(
      testInfo,
      'Device detail page loaded successfully, target device was Online, and Terminal button was visible and enabled'
    );
  });

  test('TC-TERMINAL-002: Open Terminal page from Device detail', async ({}, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-TERMINAL-002',
      category: 'Terminal',
      title: 'Open Terminal page from Device detail',
      precondition: 'User is logged in, target device is Online, and Device detail page is opened',
      steps: [
        'Open Device detail page',
        'Verify device status is Online',
        'Click Terminal button',
        'Verify Terminal page is displayed',
        'Verify URL contains the target device id and /terminal',
      ],
      expected:
        'User is redirected to the Terminal page for the same device successfully',
    });

    await deviceDetailPage.goto();
    await deviceDetailPage.waitForPageReady();
    await deviceDetailPage.verifyDeviceIsOnline();
    await deviceDetailPage.openTerminalFromDeviceDetail();
    await terminalPage.waitForTerminalPageReady();

    setActualResult(
      testInfo,
      `Terminal page opened successfully for device ${targetDeviceId}`
    );
  });

  test('TC-TERMINAL-003: Verify terminal connection is established successfully', async ({}, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-TERMINAL-003',
      category: 'Terminal',
      title: 'Verify terminal connection is established successfully',
      precondition:
        'User is logged in, target device is Online, and Terminal page can be opened',
      steps: [
        'Open Device detail page',
        'Click Terminal button',
        'Wait for Terminal page to load',
        'Wait for terminal connection to be established',
        'Verify ready text or shell prompt is displayed',
      ],
      expected:
        'Terminal connects successfully and displays ready text or a usable shell prompt',
    });

    await deviceDetailPage.goto();
    await deviceDetailPage.waitForPageReady();
    await deviceDetailPage.verifyDeviceIsOnline();
    await deviceDetailPage.openTerminalFromDeviceDetail();
    await terminalPage.waitForTerminalPageReady();
    await terminalPage.waitForTerminalConnected();

    const terminalText = await terminalPage.verifyTerminalSessionReady();
    expect(terminalText).toBeTruthy();

    setActualResult(
      testInfo,
      'Terminal connection was established successfully and ready text or shell prompt was displayed'
    );
  });

  test('TC-TERMINAL-004: Execute a safe terminal command and verify output', async ({}, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-TERMINAL-004',
      category: 'Terminal',
      title: 'Execute a safe terminal command and verify output',
      precondition:
        'User is logged in, target device is Online, and terminal connection is available',
      steps: [
        'Open Device detail page',
        'Click Terminal button',
        'Wait for terminal connection',
        `Run safe command: ${terminalConfig.smokeCommand || 'id'}`,
        'Verify terminal output matches the expected result pattern',
      ],
      expected:
        'Terminal executes the safe command successfully and returns the expected output',
    });

    await deviceDetailPage.goto();
    await deviceDetailPage.waitForPageReady();
    await deviceDetailPage.verifyDeviceIsOnline();
    await deviceDetailPage.openTerminalFromDeviceDetail();
    await terminalPage.waitForTerminalPageReady();
    await terminalPage.waitForTerminalConnected();

    const output = await terminalPage.runSmokeCommand(
      terminalConfig.smokeCommand || 'id',
      smokeExpectedPattern
    );

    expect(output).toMatch(smokeExpectedPattern);

    setActualResult(
      testInfo,
      `Terminal executed command "${terminalConfig.smokeCommand || 'id'}" successfully and returned the expected output`
    );
  });

  test('TC-TERMINAL-005: Execute an invalid command and verify terminal error handling', async ({}, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-TERMINAL-005',
      category: 'Terminal',
      title: 'Execute an invalid command and verify terminal error handling',
      precondition:
        'User is logged in, target device is Online, and terminal connection is available',
      steps: [
        'Open Device detail page',
        'Click Terminal button',
        'Wait for terminal connection',
        `Run invalid command: ${terminalConfig.invalidCommand || 'definitely_not_a_real_command_e2e_12345'}`,
        'Verify terminal shows an error response instead of hanging or crashing',
      ],
      expected:
        'Terminal returns an error message for the invalid command and the session remains responsive',
    });

    await deviceDetailPage.goto();
    await deviceDetailPage.waitForPageReady();
    await deviceDetailPage.verifyDeviceIsOnline();
    await deviceDetailPage.openTerminalFromDeviceDetail();
    await terminalPage.waitForTerminalPageReady();
    await terminalPage.waitForTerminalConnected();

    const output = await terminalPage.runInvalidCommand(
      terminalConfig.invalidCommand || 'definitely_not_a_real_command_e2e_12345',
      invalidExpectedPattern
    );

    expect(output).toMatch(invalidExpectedPattern);

    setActualResult(
      testInfo,
      'Terminal returned an expected error message for the invalid command and did not freeze or disconnect'
    );
  });

  test('TC-TERMINAL-006: Verify terminal remains usable after an invalid command', async ({}, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-TERMINAL-006',
      category: 'Terminal',
      title: 'Verify terminal remains usable after an invalid command',
      precondition:
        'User is logged in, target device is Online, terminal connection is available, and an invalid command can be submitted',
      steps: [
        'Open Device detail page',
        'Click Terminal button',
        'Wait for terminal connection',
        'Run an invalid command and verify error message',
        `Run recovery command: ${terminalConfig.recoveryCommand || terminalConfig.smokeCommand || 'id'}`,
        'Verify terminal still returns valid output after the previous failed command',
      ],
      expected:
        'Terminal session stays alive after an invalid command and can still execute subsequent valid commands',
    });

    await deviceDetailPage.goto();
    await deviceDetailPage.waitForPageReady();
    await deviceDetailPage.verifyDeviceIsOnline();
    await deviceDetailPage.openTerminalFromDeviceDetail();
    await terminalPage.waitForTerminalPageReady();
    await terminalPage.waitForTerminalConnected();

    const invalidOutput = await terminalPage.runInvalidCommand(
      terminalConfig.invalidCommand || 'definitely_not_a_real_command_e2e_12345',
      invalidExpectedPattern
    );
    expect(invalidOutput).toMatch(invalidExpectedPattern);

    const recoveryOutput = await terminalPage.runSmokeCommand(
      terminalConfig.recoveryCommand || terminalConfig.smokeCommand || 'id',
      recoveryExpectedPattern
    );
    expect(recoveryOutput).toMatch(recoveryExpectedPattern);

    setActualResult(
      testInfo,
      'After an invalid command, terminal session remained active and executed the recovery command successfully'
    );
  });
});