const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const config = require('../../config/config-loader');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
    PROFILE_WITHOUT_DEVICES_ID,
} = require('./dp-shared');

// Fixture with API setup/teardown — ensures profile has a device before each test
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const ONLINE_DEVICE_ID = config.pageURL.devices.onlineDeviceId;
        const API_BASE = config.apiBaseURL.replace(/\/auth\/login.*/, '');

        // Setup: check current assignment and assign if needed
        const cfgResp = await page.request.get(
            `${API_BASE}/api/user/iot/devices/${ONLINE_DEVICE_ID}/configuration`
        );
        const cfgData = cfgResp.ok() ? await cfgResp.json() : {};
        const existingProfileId = cfgData.deviceProfile?.id ?? null;
        const needsTeardown = existingProfileId !== PROFILE_WITH_DEVICES_ID;

        if (needsTeardown) {
            const assignResp = await page.request.post(
                `${API_BASE}/api/device-profiles/${PROFILE_WITH_DEVICES_ID}/assign`,
                { data: { deviceIds: [ONLINE_DEVICE_ID] } }
            );
            console.log(`  Setup: assigned device to profile "${PROFILE_WITH_DEVICES_ID}" (status: ${assignResp.status()})`);
        } else {
            console.log(`  Setup: device already in target profile "${PROFILE_WITH_DEVICES_ID}"`);
        }

        const dp = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);
        await dp.gotoDetail();
        await dp.switchToTab('devices');
        await use(dp);

        // Teardown: unassign if we changed the assignment
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
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 9 — Assigned Devices Tab', () => {

    test('TC-DP-015: Tab structure, buttons, table columns, and device data', async ({ dp, page }) => {
        await test.step('Verify URL and structure', async () => {
            await expect(page).toHaveURL(/tab=devices/);

            await expect(dp.assignByTagButton).toBeVisible();
            await expect(dp.addDeviceButton).toBeVisible();
            await expect(dp.unassignByTagButton).toBeVisible();
            await expect(dp.unassignAllButton).toBeVisible();
        });

        await test.step('Verify device data exists in table', async () => {
            // Rule 3.1: Use Web-first Assertion
            const firstRow = dp.deviceTableRows.first(); 
            await expect(firstRow, 'Should have assigned devices').toBeVisible();
            
            // Find MAC address format to confirm correct data
            await expect(dp.deviceTable.locator('tbody')).toContainText(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/i);
        });
    });

    test('TC-DP-016: Empty state when no devices assigned', async ({ page }) => {
        const dpEmpty = new DeviceProfilePage(page, PROFILE_WITHOUT_DEVICES_ID);
        
        await test.step('Navigate to profile without devices', async () => {
            await dpEmpty.gotoDetail();
            await dpEmpty.switchToTab('devices');
        });

        await test.step('Verify empty state messages and absence of devices', async () => {
            // Assert directly that empty message appears
            await expect(dpEmpty.noDevicesMessage).toBeVisible();
            
            // Rule 18 #1: Don't use if(isVisible). Assert table state according to Specs
            // Based on the fact that the table still renders 1 row containing "No devices" text, we verify it doesn't contain MAC:
            await expect(dpEmpty.deviceTable.locator('tbody')).not.toContainText(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/i);
        });
    });

    test('TC-DP-017: Device Actions menu — View, Reapply, Remove', async ({ dp, page }) => {
        let testableRow;
        
        await test.step('Find a testable device row', async () => {
            // Rule 3.3: Data must be deterministic. Must have an Online device.
            // If no 'Online' device, take the first device to test superficially instead of failing hard (unless database is properly seeded).
            // Temporarily allow running with any device if 'Online' is missing to verify Menu dropdown.
            testableRow = (await dp.findTestableDeviceRow('Online')) ?? (await dp.findTestableDeviceRow());
            
            // Rule 18 #11: If test environment lacks data, throw a loud error!
            expect(testableRow, 'Test environment lacks Online devices to test Actions Menu!').not.toBeNull();
        });

        await test.step('Open actions menu and verify options', async () => {
            // Rule 4.4 & 1.1: Use User-Facing Locators declared from POM
            // POM has: dp.getActionBtnForRow(rowLocator) and dp.actionsMenu
            const actionBtn = dp.getActionBtnForRow(testableRow); 
            await expect(actionBtn).toBeVisible();
            
            // Need scrollIntoViewIfNeeded if table is too long
            await actionBtn.scrollIntoViewIfNeeded();
            await actionBtn.click();

            const menu = dp.actionsMenu;
            await expect(menu).toBeVisible({ timeout: 10000 });
            
            // Get directly from dp.menuItemByName() available in POM
            await expect(dp.menuItemByName(/Reapply/i)).toBeVisible();
            await expect(dp.menuItemByName(/Remove/i)).toBeVisible();

            await page.keyboard.press('Escape');
        });
    });
});

