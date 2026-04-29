const {
  test,
  expect,
  createRebootContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  setActualResult,
} = require('../../../pages/devices/device-detail/test-helpers/reboot-test-helpers');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
} = require('../../../pages/devices/device-detail/test-helpers/device-action-shared');

test.describe('Device detail - Reboot action', () => {
  // ── TC-REBOOT-001 ~ 003: Precondition, Modal, Cancel ────────────────────
  test('TC-REBOOT-001~003: Precondition, modal content, and cancel without rebooting', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
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
});

  // ── TC-REBOOT-004: Confirm reboot and verify Activity Log ───────────────
  test('TC-REBOOT-004: Confirm reboot and verify Activity Log transitions from In Progress to Success', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);
await test.step('Run main flow', async () => {
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
});

  // ── TC-REBOOT-005: Terminal verification after reboot ───────────────────
  test('TC-REBOOT-005: Reboot the device and verify Terminal reconnects on Android', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);
await test.step('Run main flow', async () => {
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
});
