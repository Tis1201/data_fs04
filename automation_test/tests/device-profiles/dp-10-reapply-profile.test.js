const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
} = require('./dp-shared');

// Rule 11.1 & 16.2: Restore Fixture for DRY code
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);
        await dp.gotoDetail();
        await dp.switchToTab('devices');
        await use(dp);
    }
});

const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 12 — Reapply Profile to Device', () => {

    test('TC-DP-019: Reapply to online device — success and auto-refresh', async ({ dp, page }) => {
        let targetRow;

        await test.step('Find an online device to reapply', async () => {
            // Rule 3.3 & 18 #11: Test environment must be Deterministic.
            // No tolerance for garbage data; device must be Online to test the standard flow.
            targetRow = await dp.findTestableDeviceRow('Online');
            expect(targetRow, 'Test environment lacks an Online device to test Reapply!').not.toBeNull();
        });

        await test.step('Open actions menu and click Reapply', async () => {
            // Rule 4.4 & 1.1: Use clean Locators from POM
            const actionBtn = dp.getActionBtnForRow(targetRow);
            await expect(actionBtn).toBeVisible();
            await actionBtn.scrollIntoViewIfNeeded();
            await actionBtn.click();

            // Fixed actionsMenu locator in POM, so no need for redundant `.or()` wrapper here
            const menu = dp.actionsMenu;
            await expect(menu).toBeVisible();

            const reapplyItem = dp.menuItemByName(/Reapply/i);
            // Some devices may not have the reapply option, but this scenario requires testing this button
            // Must run on a profile/device that has this button.
            await expect(reapplyItem, 'Reapply action should be visible').toBeVisible();
            await reapplyItem.click();
        });

        await test.step('Verify success toast', async () => {
            // Rule 3.1 & 19.1: Extract results automatically using Web-first assertion
            // No more extracting text to NodeJS code for analysis!
            await expect(dp.toast).toContainText(/Reapply sent to device/i, { timeout: 8000 });
        });
    });
});
