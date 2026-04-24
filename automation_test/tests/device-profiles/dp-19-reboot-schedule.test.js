const { test, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');
const DevicePage = require('../../pages/devices/device-listing-page');
const {
    getErrorMessage,
    cleanupProfile,
    createProfileAndNavigateToDetail,
    unassignAllDevices,
    handleReassignConfirmation,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    config,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

test.use({ storageState: authFile });

test.describe('Section 21 — Reboot Schedule Verification', () => {

    /**
     * TC-DP-036: Reboot Schedule — device goes Offline during reboot, returns Online
     */
    test('TC-DP-036: Reboot Schedule — device goes offline until reboot completes', async ({ page }) => {
        test.setTimeout(720000); // 12 minutes

        const SCHEDULE_DEVICE_ID = config.pageURL.devices.scheduleTestDeviceId;
        const profileName = generateTestProfileNameWithSuffix('AutoTest_reboot_sched');
        const dp = new DeviceProfilePage(page);
        const devicePage = new DevicePage(page, SCHEDULE_DEVICE_ID);

        function getDeviceTimeWithOffset(offsetMinutes) {
            const future = new Date(Date.now() + offsetMinutes * 60000);
            const formatter = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            return formatter.format(future);
        }

        const testStartTime = Date.now();
        const REBOOT_OFFSET = 2;
        const REBOOT_TIME = getDeviceTimeWithOffset(REBOOT_OFFSET);
        console.log(`  Schedule: Reboot time = ${REBOOT_TIME}`);

        try {
            let scheduleDeviceName = '';
            await test.step('Pre-condition: verify device is Online', async () => {
                await page.goto(devicePage.deviceUrl);
                await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

                const status = await devicePage.getDeviceConnectionStatus();
                console.log(`  Device connection status: "${status}"`);
                expect(status, 'Device must be ONLINE to run reboot test').toContain('online');

                const deviceDetailPage = new DeviceDetailPage(page, SCHEDULE_DEVICE_ID);
                const fields = await deviceDetailPage.extractAllFieldValues();
                scheduleDeviceName = fields['Device Name'] || '';
                console.log(`  Schedule test device name: "${scheduleDeviceName}"`);
                expect(scheduleDeviceName, 'Schedule test device should have a name').toBeTruthy();
            });

            await test.step('Create profile with Reboot Schedule', async () => {
                await createProfileAndNavigateToDetail(dp, page, profileName, null);
                console.log(`  Profile created: "${profileName}" — ${page.url()}`);

                await dp.editSetButton.click();
                await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
                await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

                const rebootToggle = dp.rebootScheduleToggle;
                if ((await rebootToggle.getAttribute('aria-checked')) !== 'true') {
                    await rebootToggle.click();
                }

                const timeInputs = page.locator('input[type="time"]');
                await timeInputs.first().waitFor({ state: 'visible', timeout: 5000 });
                await timeInputs.first().fill(REBOOT_TIME);
                console.log(`  Set Reboot time: ${REBOOT_TIME}`);

                const saveResp = page.waitForResponse(
                    r => r.url().includes('device-profiles') && r.request().method() === 'POST',
                    { timeout: 12000 }
                );
                await dp.saveButton.scrollIntoViewIfNeeded();
                await dp.saveButton.click();
                await dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 15000 });
                await saveResp;
                const toast = await dp.waitForSuccessToast();
                console.log(`  Saved — toast: "${toast.trim()}"`);
            });

            await test.step('Assign schedule test device to profile', async () => {
                await dp.switchToTab('devices');
                await dp.addDeviceButton.click();
                await page.waitForLoadState('domcontentloaded');

                const addModal = page.locator('[role="dialog"], [class*="modal"]')
                    .filter({ hasText: /Add Device|Select Devices/i }).first();
                await expect(addModal, 'Add Device modal should be visible').toBeVisible();

                const allOptions = page.locator(
                    '.device-selector-dropdown-portal .device-selector-option:not(.device-selector-select-all)'
                );
                await allOptions.first().waitFor({ state: 'visible', timeout: 15000 });

                const searchInput = addModal.locator('input[placeholder*="earch" i], input[type="text"]').first();
                if (await searchInput.isVisible({ timeout: 3000 })) {
                    await searchInput.fill(scheduleDeviceName.substring(0, 30));
                    await page.waitForTimeout(1000);
                    console.log(`  Searched for: "${scheduleDeviceName.substring(0, 30)}"`);
                }

                const available = page.locator(
                    '.device-selector-dropdown-portal .device-selector-option:not(.device-selector-select-all):not(.opacity-50)'
                );
                const count = await available.count();
                console.log(`  Available devices after search: ${count}`);
                expect(count, 'Schedule test device should be available to assign').toBeGreaterThan(0);

                const name = await available.first().locator('.device-selector-option-name').textContent();
                await available.first().click();
                console.log(`  Selected: "${name.trim()}"`);

                const descText = addModal.locator('.device-selector-description').first();
                if (await descText.isVisible()) await descText.click();
                else await addModal.locator('h2, h3, [class*="title"]').first().click();

                const addBtn = addModal.getByRole('button', { name: /^Add$/i }).first();
                await expect(addBtn, 'Add button should be enabled').toBeEnabled({ timeout: 5000 });
                await addBtn.click();
                await page.waitForLoadState('domcontentloaded');
                await handleReassignConfirmation(page);

                const toastText = await dp.waitForToast(5000);
                console.log(`  Device assigned — toast: "${toastText}"`);
            });

            await test.step('Wait for reboot → detect Offline then Online', async () => {
                await page.goto(devicePage.deviceUrl);
                await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

                const pollStartTime = testStartTime + REBOOT_OFFSET * 60000 - 30000;
                const waitMs = Math.max(0, pollStartTime - Date.now());
                console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s (until 30s before reboot time)...`);
                if (waitMs > 0) await page.waitForTimeout(waitMs);

                // Phase 1: Poll for Offline
                let offlineDetected = false;
                const maxOfflinePolls = 60;
                for (let attempt = 1; attempt <= maxOfflinePolls; attempt++) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    const status = await devicePage.getDeviceConnectionStatus();
                    console.log(`  Poll ${attempt}: status = "${status.trim()}"`);
                    if (status.includes('offline')) {
                        offlineDetected = true;
                        console.log('  ✅ Device went Offline (reboot in progress)');
                        break;
                    }
                    if (attempt < maxOfflinePolls) await page.waitForTimeout(5000);
                }
                expect(offlineDetected, 'Device should go Offline after reboot schedule triggers').toBeTruthy();

                // Phase 2: Poll for Online restored
                let onlineRestored = false;
                const maxOnlinePolls = 30;
                for (let attempt = 1; attempt <= maxOnlinePolls; attempt++) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    const status = await devicePage.getDeviceConnectionStatus();
                    console.log(`  Recovery poll ${attempt}: status = "${status.trim()}"`);
                    if (status.includes('online')) {
                        onlineRestored = true;
                        console.log('  ✅ Device is back Online (reboot complete)');
                        break;
                    }
                    if (attempt < maxOnlinePolls) await page.waitForTimeout(10000);
                }
                expect(onlineRestored, 'Device should return Online after reboot completes').toBeTruthy();
            });

            console.log('  📋 Reboot Schedule test complete');

        } finally {
            console.log('\n  === Cleanup ===');
            try {
                await dp.gotoList();
                if (await dp.profileRowByName(profileName).isVisible()) {
                    await dp.profileRowByName(profileName).locator('a').first().click();
                    await page.waitForLoadState('domcontentloaded');
                    try { await dp.switchToTab('devices'); } catch (e) { console.log(`  Switch tab failed: ${getErrorMessage(e)}`); }
                    await unassignAllDevices(dp, page);
                }
            } catch (cleanupErr) {
                console.log(`  Unassign failed: ${getErrorMessage(cleanupErr)}`);
            }
            await cleanupProfile(dp, profileName);
        }
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try { await cleanupAutoTestProfiles(page); } finally { await context.close(); }
});
