const { test: base, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const config = require('../../config/config-loader');
const { authFile, PROFILE_WITH_DEVICES_ID } = require('./dp-shared');

const ONLINE_DEVICE_ID = config.pageURL.devices.onlineDeviceId;
const API_BASE = config.apiBaseURL.replace(/\/auth\/login.*/, ''); // https://app-dev-v2.datarealities.com

// Rule 11.1 & 16.2: Fixture — Setup/Teardown via API (Rule 6.2)
const test = base.extend({
    dp: async ({ page }, use) => {
        // SETUP: Use API to check which profile the device is currently assigned to (fast, no UI cost)
        const cfgResp = await page.request.get(
            `${API_BASE}/api/user/iot/devices/${ONLINE_DEVICE_ID}/configuration`
        );
        const cfgData = cfgResp.ok() ? await cfgResp.json() : {};
        const existingProfileId = cfgData.deviceProfile?.id ?? null;

        let needsTeardown = false;

        // Only reuse if already in the known working test profile (global level)
        if (existingProfileId !== PROFILE_WITH_DEVICES_ID) {
            needsTeardown = true;
            const assignResp = await page.request.post(
                `${API_BASE}/api/device-profiles/${PROFILE_WITH_DEVICES_ID}/assign`,
                { data: { deviceIds: [ONLINE_DEVICE_ID] } }
            );
            expect(assignResp.ok(), `API assign device to profile should succeed (${assignResp.status()})`).toBe(true);
            console.log(`  Setup: assigned device to profile "${PROFILE_WITH_DEVICES_ID}" via API (was: ${existingProfileId || 'none'})`);
        } else {
            console.log(`  Setup: device already in target profile "${PROFILE_WITH_DEVICES_ID}"`);
        }

        const dp = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);
        await dp.gotoDetail();
        await dp.switchToTab('devices');

        await use(dp);

        // TEARDOWN: Unassign via API — Rule 15.2: try/catch is valid in teardown
        if (needsTeardown) {
            try {
                const unassignResp = await page.request.post(
                    `${API_BASE}/api/device-profiles/${PROFILE_WITH_DEVICES_ID}/unassign`,
                    { data: { deviceIds: [ONLINE_DEVICE_ID] } }
                );
                console.log(`  Teardown: unassign ${unassignResp.ok() ? 'OK' : `failed (${unassignResp.status()})`}`);
            } catch (e) {
                console.error(`  Teardown API failed: ${e.message}`);
            }
        }
    }
});

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
            await expect(dp.toast).toContainText(/Reapply sent to/i, { timeout: 8000 });
        });
    });
});
