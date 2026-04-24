const { test, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const DeviceDetailPage = require('../../pages/iot/device-detail-page');
const DevicePage = require('../../pages/iot/device-page');
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

test.describe('Section 20 — Power Management Schedule Verification', () => {

    /**
     * TC-DP-035: Power Management Schedule — screen off returns black snapshot, on returns normal
     */
    test('TC-DP-035: Power Management — screen off→black snapshot, on→normal snapshot', async ({ page }) => {
        test.setTimeout(720000); // 12 minutes

        const SCHEDULE_DEVICE_ID = config.pageURL.devices.scheduleTestDeviceId;
        const profileName = generateTestProfileNameWithSuffix('AutoTest_power_sched');
        const dp = new DeviceProfilePage(page);
        const devicePage = new DevicePage(page, SCHEDULE_DEVICE_ID);

        // ── Helpers ──
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

        async function getImageBrightness(imgSrc) {
            return await page.evaluate((src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                        let sum = 0;
                        const pixels = data.length / 4;
                        for (let i = 0; i < data.length; i += 4) {
                            sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
                        }
                        resolve(sum / pixels);
                    };
                    img.onerror = () => resolve(-1);
                    img.src = src;
                });
            }, imgSrc);
        }

        async function takeSnapshotAndGetBrightness() {
            await devicePage.triggerSnapshot();
            await expect(devicePage.successLogMessage).toBeVisible({ timeout: 30000 });
            await expect(devicePage.snapshotImage).toBeVisible({ timeout: 5000 });
            const src = await devicePage.getSnapshotImageSrc();
            expect(src, 'Snapshot should be a valid base64 JPEG').toMatch(/^data:image\/jpeg;base64,/);
            const brightness = await getImageBrightness(src);
            await devicePage.closeSnapshotModal();
            return brightness;
        }

        const testStartTime = Date.now();
        const POWER_OFF_OFFSET = 2;
        const POWER_ON_OFFSET  = 4;
        const POWER_OFF_TIME = getDeviceTimeWithOffset(POWER_OFF_OFFSET);
        const POWER_ON_TIME  = getDeviceTimeWithOffset(POWER_ON_OFFSET);
        console.log(`  Schedule: Power Off=${POWER_OFF_TIME}, Power On=${POWER_ON_TIME}`);

        try {
            let profileUrl = '';
            await test.step('Create profile with Power Management Schedule', async () => {
                await createProfileAndNavigateToDetail(dp, page, profileName, null);
                profileUrl = page.url();
                console.log(`  Profile created: "${profileName}" — ${profileUrl}`);

                await dp.editSetButton.click();
                await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
                await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

                const powerToggle = dp.powerScheduleToggle;
                if ((await powerToggle.getAttribute('aria-checked')) !== 'true') {
                    await powerToggle.click();
                }

                const timeInputs = page.locator('input[type="time"]');
                await timeInputs.first().waitFor({ state: 'visible', timeout: 5000 });
                await timeInputs.first().fill(POWER_ON_TIME);
                await timeInputs.nth(1).fill(POWER_OFF_TIME);
                console.log(`  Set Power On: ${POWER_ON_TIME}, Power Off: ${POWER_OFF_TIME}`);

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

            let scheduleDeviceName = '';
            await test.step('Get schedule test device name', async () => {
                await page.goto(devicePage.deviceUrl);
                await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
                const deviceDetailPage = new DeviceDetailPage(page, SCHEDULE_DEVICE_ID);
                const fields = await deviceDetailPage.extractAllFieldValues();
                scheduleDeviceName = fields['Device Name'] || '';
                console.log(`  Schedule test device name: "${scheduleDeviceName}"`);
                expect(scheduleDeviceName, 'Schedule test device should have a name').toBeTruthy();
            });

            await test.step('Assign schedule test device to profile', async () => {
                await page.goto(profileUrl);
                await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
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

            await test.step('Wait for power-off → verify black snapshot', async () => {
                await page.goto(devicePage.deviceUrl);
                await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

                const waitUntil = testStartTime + POWER_OFF_OFFSET * 60000 + 90000;
                const waitMs = Math.max(0, waitUntil - Date.now());
                console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s for power-off time + buffer...`);
                if (waitMs > 0) await page.waitForTimeout(waitMs);

                let brightness = 255;
                for (let attempt = 1; attempt <= 6; attempt++) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    try {
                        brightness = await takeSnapshotAndGetBrightness();
                        console.log(`  Power-OFF snapshot attempt ${attempt}: avg brightness = ${brightness.toFixed(2)}`);
                        if (brightness < 10) break;
                    } catch (e) {
                        console.log(`  Snapshot attempt ${attempt} failed: ${getErrorMessage(e)}`);
                    }
                    if (attempt < 6) await page.waitForTimeout(30000);
                }
                expect(brightness, 'Screen OFF — avg brightness should be < 15 (black)').toBeLessThan(15);
                console.log('  ✅ Power-OFF verified: snapshot is black');
            });

            await test.step('Wait for power-on → verify normal snapshot', async () => {
                const waitUntil = testStartTime + POWER_ON_OFFSET * 60000 + 90000;
                const waitMs = Math.max(0, waitUntil - Date.now());
                console.log(`  Waiting ${Math.ceil(waitMs / 1000)}s for power-on time + buffer...`);
                if (waitMs > 0) await page.waitForTimeout(waitMs);

                let brightness = 0;
                for (let attempt = 1; attempt <= 6; attempt++) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    try {
                        brightness = await takeSnapshotAndGetBrightness();
                        console.log(`  Power-ON snapshot attempt ${attempt}: avg brightness = ${brightness.toFixed(2)}`);
                        if (brightness > 30) break;
                    } catch (e) {
                        console.log(`  Snapshot attempt ${attempt} failed: ${getErrorMessage(e)}`);
                    }
                    if (attempt < 6) await page.waitForTimeout(30000);
                }
                expect(brightness, 'Screen ON — avg brightness should be > 30 (normal)').toBeGreaterThan(30);
                console.log('  ✅ Power-ON verified: snapshot is normal');
            });

            console.log('  📋 Power Management Schedule test complete');

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
