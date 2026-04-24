const {
  test,
  expect,
  createRebootContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  setActualResult,
  setTestCaseMetadata,
} = require('./reboot-test-helpers');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
} = require('../shared/device-action-common');

test.describe('Device detail - Reboot action', () => {
  // ── TC-REBOOT-001 ~ 003: Precondition, Modal, Cancel ────────────────────
  test('TC-REBOOT-001~003: Precondition, modal content, and cancel without rebooting', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-REBOOT-001~003',
      category: 'Reboot',
      title: 'Verify reboot precondition, modal content, and cancel behaviour',
      precondition: 'User is logged in, target device is Online, and Device detail page is available',
      steps: [
        'Open Device detail page and verify device is Online',
        'Verify Reboot button is visible and enabled',
        'Click Reboot button and verify confirmation modal',
        'Verify modal title, description, Cancel and Reboot buttons',
        'Click Cancel and verify modal closes without sending reboot command',
      ],
      expected: 'Reboot button is ready, modal shows correct content, and Cancel closes modal without rebooting',
    });

    const context = createRebootContext(page);

    // TC-REBOOT-001: precondition
    await openOnlineDeviceDetail(context);
    await expect(context.deviceDetailPage.rebootButton).toBeVisible();
    await expect(context.deviceDetailPage.rebootButton).toBeEnabled();

    // TC-REBOOT-002: modal content
    await context.deviceDetailPage.clickReboot();
    const rebootModal = await context.deviceDetailPage.waitForRebootModalVisible();
    await expect(context.deviceDetailPage.getRebootModalTitle()).toBeVisible();
    await expect(context.deviceDetailPage.getRebootModalDescription()).toBeVisible();
    await expect(rebootModal.getByRole('button', { name: /^cancel$/i })).toBeVisible();
    await expect(rebootModal.getByRole('button', { name: /^reboot$/i })).toBeVisible();

    // TC-REBOOT-003: cancel without rebooting
    await context.deviceDetailPage.cancelRebootIfVisible();
    await expect(context.deviceDetailPage.getRebootModal()).toBeHidden();
    await expect(context.deviceDetailPage.rebootSuccessToast).toBeHidden();

    setActualResult(
      testInfo,
      'Reboot button was ready, confirmation modal displayed correct content, and Cancel closed modal without sending reboot command'
    );
  });

  // ── TC-REBOOT-004: Confirm reboot and verify Activity Log ───────────────
  test('TC-REBOOT-004: Confirm reboot and verify Activity Log transitions from In Progress to Success', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-REBOOT-004',
      category: 'Reboot',
      title: 'Confirm reboot and verify Activity Log transitions from In Progress to Success',
      precondition: 'User is logged in, target device is Online, and the target device can receive reboot commands',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Capture existing Activity Log entries',
        'Click Reboot button and confirm',
        'Verify reboot success toast',
        'Wait for In Progress then Success in Activity Log',
      ],
      expected: 'Reboot command submitted, Activity Log shows In Progress then Success',
    });

    const context = createRebootContext(page);

    await openActivityTabReady(context);
    const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
    await context.deviceDetailPage.clickReboot();
    await context.deviceDetailPage.waitForRebootModalVisible();
    await context.deviceDetailPage.confirmReboot();

    const successToastText = await context.deviceDetailPage.waitForRebootSuccessToast();
    const inProgressLog = await context.deviceDetailPage.waitForNewRebootInProgressLog(previousSignatures);

    let finalLog;
    try {
      finalLog = await context.deviceDetailPage.waitForNewRebootSuccessLog(previousSignatures);
    } catch (error) {
      const latestSignatures = await context.deviceDetailPage.getActivityLogSignatures(10);
      setActualResult(testInfo, [
        `Reboot command was submitted and initial status reached "${inProgressLog?.statusText || 'In Progress'}",`,
        'but final Success status was not observed within the configured timeout.',
        `Toast: ${successToastText || 'N/A'}`,
        `Latest activity signatures: ${latestSignatures.join(' || ')}`,
      ].join(' '));
      throw error;
    }

    setActualResult(testInfo, [
      'Reboot command was submitted successfully.',
      `Toast message: ${successToastText || 'Reboot command sent to device'}.`,
      `Initial reboot log status: ${inProgressLog?.statusText || 'In Progress'}.`,
      `Final reboot log status: ${finalLog?.statusText || 'Success'}.`,
    ].join(' '));
  });

  // ── TC-REBOOT-005: Terminal verification after reboot ───────────────────
  test('TC-REBOOT-005: Reboot the device and verify Terminal reconnects on Android', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);

    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-REBOOT-005',
      category: 'Reboot Terminal',
      title: 'Reboot the device and verify Terminal reconnects on Android',
      precondition: 'User is logged in, target device is Online, and Terminal can be opened for the same device',
      steps: [
        'Open Device detail page on Activity Logs tab',
        'Trigger Reboot and verify the reboot flow reaches Success',
        'Open Terminal for the same device after reboot completes',
        'Run the configured terminal verification command',
        'Verify terminal output confirms the Android shell is reachable again',
      ],
      expected: 'Reboot completes successfully and Terminal reconnects with valid shell output',
    });

    const context = createRebootContext(page);

    await openActivityTabReady(context);
    const previousSignatures = await context.deviceDetailPage.getActivityLogSignatures();
    await context.deviceDetailPage.clickReboot();
    await context.deviceDetailPage.waitForRebootModalVisible();
    await context.deviceDetailPage.confirmReboot();
    const successToastText = await context.deviceDetailPage.waitForRebootSuccessToast();
    const inProgressLog = await context.deviceDetailPage.waitForNewRebootInProgressLog(previousSignatures);
    const finalLog = await context.deviceDetailPage.waitForNewRebootSuccessLog(previousSignatures);

    await openTerminalSession(context);

    const expectedPattern = toRegExp(context.terminalVerifyExpectedPattern, /uid=/i);
    const terminalOutput = await context.terminalPage.runCommandAndWaitForOutput(
      context.terminalVerifyCommand,
      expectedPattern
    );

    await attachJson(testInfo, 'reboot-terminal-verification', {
      command: context.terminalVerifyCommand,
      terminalOutput,
      successToastText,
      inProgressLog,
      finalLog,
    });

    expect(terminalOutput).toMatch(expectedPattern);

    setActualResult(
      testInfo,
      `Reboot completed successfully with final status "${finalLog?.statusText || 'Success'}", and terminal command "${context.terminalVerifyCommand}" confirmed the Android shell was reachable after the reboot.`
    );
  });
});
