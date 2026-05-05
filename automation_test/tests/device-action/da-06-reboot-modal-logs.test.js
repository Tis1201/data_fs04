const base = require('@playwright/test');
const {
  expect,
  createRebootContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  setActualResult,
} = require('../../pages/devices/device-detail/modules/device-actions/reboot');
const {
  attachJson,
  openTerminalSession,
  toRegExp,
} = require('../../pages/devices/device-detail/modules/device-actions/shared');
const { authFile } = require('./device-actions-shared');

// Rule 11.1 & 16.2: Use Fixture to initialize shared POM
const extendedTest = base.test.extend({
  page: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

const test = extendedTest;
test.use({ storageState: authFile });

test.describe('Section 1 — Reboot Action: Precondition, Modal, Cancel', () => {
  test('TC-DA-027~029: Precondition, modal content, and cancel without rebooting', async ({ page }, testInfo) => {
    await test.step('Reboot modal: open, content, cancel without sending reboot', async () => {
      const context = createRebootContext(page);

      // TC-DA-027: precondition
      await openOnlineDeviceDetail(context);
      await expect(context.deviceDetailPage.rebootButton).toBeVisible();
      await expect(context.deviceDetailPage.rebootButton).toBeEnabled();

      // TC-DA-028: modal content
      await context.deviceDetailPage.clickReboot();
      const rebootModal = await context.deviceDetailPage.waitForRebootModalVisible();
      await expect(context.deviceDetailPage.getRebootModalTitle()).toBeVisible();
      await expect(context.deviceDetailPage.getRebootModalDescription()).toBeVisible();
      await expect(rebootModal.getByRole('button', { name: /^cancel$/i })).toBeVisible();
      await expect(rebootModal.getByRole('button', { name: /^reboot$/i })).toBeVisible();

      // TC-DA-029: cancel without rebooting
      await context.deviceDetailPage.cancelRebootIfVisible();
      await expect(context.deviceDetailPage.getRebootModal()).toBeHidden();
      await expect(context.deviceDetailPage.rebootSuccessToast).toBeHidden();

      setActualResult(
        testInfo,
        'Reboot button was ready, confirmation modal displayed correct content, and Cancel closed modal without sending reboot command'
      );
    });
  });
});

test.describe('Section 2 — Confirm Reboot and Activity Log', () => {
  test('TC-DA-030: Confirm reboot and verify Activity Log transitions from In Progress to Success', async ({ page }, testInfo) => {
    test.setTimeout(6 * 60 * 1000);

    await test.step('Confirm reboot and wait for In Progress → Success in Activity Log', async () => {
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
});

test.describe('Section 3 — Terminal Verification after Reboot', () => {
  test('TC-DA-031: Reboot the device and verify Terminal reconnects on Android', async ({ page }, testInfo) => {
    test.setTimeout(8 * 60 * 1000);

    await test.step('Reboot device then run Terminal smoke command after recovery', async () => {
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

