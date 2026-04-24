const { test, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    cleanupProfile,
    createProfileAndNavigateToDetail,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

test.use({ storageState: authFile });

test.describe('Section 19 — Schedule Settings API Persistence', () => {

    test('TC-DP-034: Schedule settings persisted correctly via API after save', async ({ page }) => {

        const profileName = generateTestProfileNameWithSuffix('AutoTest_sched_api');
        const dp = new DeviceProfilePage(page);

        const POWER_ON_TIME  = '09:00';
        const POWER_OFF_TIME = '21:00';
        const REBOOT_TIME    = '03:15';
        const DOWNLOAD_TIME  = '04:45';

        try {
            await test.step('Create fresh AutoTest profile', async () => {
                await createProfileAndNavigateToDetail(dp, page, profileName, null);
            });

            await test.step('Set schedule settings with specific verifiable times', async () => {
                await dp.editSetButton.click();
                await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
                await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

                const timeInputs = page.locator('input[type="time"]');

                const powerToggle = dp.powerScheduleToggle;
                await expect(powerToggle).toBeVisible();
                if ((await powerToggle.getAttribute('aria-checked')) !== 'true') {
                    await powerToggle.click();
                }
                await timeInputs.first().waitFor({ state: 'visible', timeout: 5000 });
                await timeInputs.first().fill(POWER_ON_TIME);
                await timeInputs.nth(1).fill(POWER_OFF_TIME);

                const rebootToggle = dp.rebootScheduleToggle;
                await expect(rebootToggle).toBeVisible();
                if ((await rebootToggle.getAttribute('aria-checked')) !== 'true') {
                    await rebootToggle.click();
                }
                await timeInputs.nth(2).waitFor({ state: 'visible', timeout: 5000 });
                await timeInputs.nth(2).fill(REBOOT_TIME);

                const downloadToggle = dp.downloadScheduleToggle;
                await expect(downloadToggle).toBeVisible();
                if ((await downloadToggle.getAttribute('aria-checked')) !== 'true') {
                    await downloadToggle.click();
                }
                await timeInputs.nth(3).waitFor({ state: 'visible', timeout: 5000 });
                await timeInputs.nth(3).fill(DOWNLOAD_TIME);

                const saveResp = page.waitForResponse(
                    r => r.url().includes('device-profiles') && r.request().method() === 'POST',
                    { timeout: 12000 }
                );
                await dp.saveButton.scrollIntoViewIfNeeded();
                await dp.saveButton.click();
                await dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 15000 });
                await saveResp;
                await dp.waitForSuccessToast();
            });

            await test.step('Verify schedule settings persisted in API response', async () => {
                const currentUrl = page.url();
                const profileIdMatch = currentUrl.match(/device-profiles\/([^/?#]+)/);
                expect(profileIdMatch, 'Should extract profile ID from URL').toBeTruthy();
                const profileId = profileIdMatch[1];

                const baseUrl = currentUrl.match(/^(https?:\/\/[^/]+)/)[1];
                const apiResp = await page.request.get(
                    `${baseUrl}/user/iot/device-profiles/${profileId}`,
                    { headers: { 'Accept': 'application/json' } }
                );
                expect(apiResp.status(), 'API GET profile should return 200').toBe(200);
                const apiBody = await apiResp.json();
                expect(apiBody.success, 'API response should have success=true').toBe(true);

                const settings = apiBody.profile?.settings ?? [];
                const settingMap = {};
                for (const s of settings) {
                    settingMap[s.key] = s.value;
                }

                const powerSchedValue = String(settingMap['power_management_schedule'] ?? '').toLowerCase();
                expect(['enabled', 'true'], 'power_management_schedule should be enabled').toContain(powerSchedValue);

                const powerOnKey = Object.keys(settingMap).find(k => k.includes('power_on'));
                expect(powerOnKey, 'API must return power_on setting').toBeTruthy();
                expect(settingMap[powerOnKey], `${powerOnKey} should contain ${POWER_ON_TIME}`).toContain(POWER_ON_TIME);

                const powerOffKey = Object.keys(settingMap).find(k => k.includes('power_off'));
                expect(powerOffKey, 'API must return power_off setting').toBeTruthy();
                expect(settingMap[powerOffKey], `${powerOffKey} should contain ${POWER_OFF_TIME}`).toContain(POWER_OFF_TIME);

                const rebootSchedValue = String(settingMap['reboot_schedule_enabled'] ?? '').toLowerCase();
                expect(['enabled', 'true'], 'reboot_schedule_enabled should be enabled').toContain(rebootSchedValue);
                expect(settingMap['reboot_schedule_time'], 'API must return reboot_schedule_time').toContain(REBOOT_TIME);

                const downloadSchedValue = String(settingMap['download_schedule_enabled'] ?? '').toLowerCase();
                expect(['enabled', 'true'], 'download_schedule_enabled should be enabled').toContain(downloadSchedValue);
                expect(settingMap['download_schedule_time'], 'API must return download_schedule_time').toContain(DOWNLOAD_TIME);
            });

        } finally {
            await cleanupProfile(dp, profileName);
        }
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try { await cleanupAutoTestProfiles(page); } finally { await context.close(); }
});
