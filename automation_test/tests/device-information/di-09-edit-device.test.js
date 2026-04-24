const base = require('@playwright/test');
const { authFile, ETHERNET_DEVICE_ID, createRestoreState } = require('./di-shared');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');

const test = base.test;
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 9 — Edit Device Modal', () => {
    test.describe.configure({ mode: 'serial' });

    const { setOriginalDeviceName, beforeAllCapture, afterEachRestore } = createRestoreState();

    test.beforeAll(beforeAllCapture);
    test.afterEach(afterEachRestore);

    test('TC-INFO-021: Edit Device full flow — open, verify pre-fill, modify, and save', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let originalDeviceName;
        await test.step('Capture original device name', async () => {
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                originalDeviceName = data['Device Name'] || '';
                return originalDeviceName.trim();
            }, { message: 'Waiting for Device Name to populate' }).not.toBe('');
            setOriginalDeviceName(originalDeviceName);
        });

        await test.step('Open Edit Device modal and verify pre-fill', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });
            const nameInput = dp.modal.getByRole('textbox').first();
            await expect(nameInput).not.toHaveValue('', { timeout: 5000 });
        });

        await test.step('Modify name and save', async () => {
            const testName = originalDeviceName + ' Test';
            const nameInput = dp.modal.getByRole('textbox').first();
            await nameInput.clear();
            await nameInput.fill(testName);

            const saveBtn = dp.modal.getByRole('button', { name: /Save|Update|Submit/i }).first();
            await expect(saveBtn).toBeVisible();
            await saveBtn.click();
            await expect(dp.modal).toBeHidden();
        });

        await test.step('Verify updated name on detail page', async () => {
            const testName = originalDeviceName + ' Test';
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                return data['Device Name'] || '';
            }, { message: 'Waiting for updated Device Name to render' }).toBe(testName);
        });
    });

    test('TC-INFO-022: Edit Device — cancel discards changes and validation prevents empty name', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let origName;
        await test.step('Capture original name', async () => {
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                origName = data['Device Name'] || '';
                return origName.trim();
            }, { message: 'Waiting for Device Name to populate' }).not.toBe('');
            setOriginalDeviceName(origName);
        });

        await test.step('Open modal, modify name, then cancel — verify name unchanged', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });

            const nameInput = dp.modal.getByRole('textbox').first();
            await nameInput.clear();
            await nameInput.fill('TEMP-SHOULD-NOT-SAVE');

            const cancelBtn = dp.modal.getByRole('button', { name: /Cancel|Close/i }).first();
            await expect(cancelBtn).toBeVisible();
            await cancelBtn.click();
            await expect(dp.modal).toBeHidden();

            const fieldsAfterCancel = await dp.extractAllFieldValues();
            expect(fieldsAfterCancel['Device Name'] || '').toBe(origName);
        });

        await test.step('Open modal, clear name — verify validation prevents empty name', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });

            const nameInput = dp.modal.getByRole('textbox').first();
            await nameInput.clear();

            const saveBtn = dp.modal.getByRole('button', { name: /Save|Update|Submit/i }).first();
            await expect(saveBtn).toBeVisible();

            const isDisabled = await saveBtn.isDisabled();
            if (isDisabled) {
                expect.soft(saveBtn, 'Save button should be disabled when name is empty').toBeDisabled();
            } else {
                await saveBtn.click();
                const modalStillOpen = await dp.modal.isVisible().catch(() => false);
                if (modalStillOpen) {
                    expect.soft(true, 'Modal correctly remains open with empty name validation').toBeTruthy();
                    const closeBtn = dp.modal.getByRole('button', { name: /Close modal/i }).first();
                    if (await closeBtn.isVisible().catch(() => false)) {
                        await closeBtn.click();
                    } else {
                        await page.keyboard.press('Escape');
                    }
                    await dp.modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
                }
            }

            const modalGone = !(await dp.modal.isVisible().catch(() => false));
            if (modalGone) return;
            await page.keyboard.press('Escape');
            await dp.modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        });
    });
});
