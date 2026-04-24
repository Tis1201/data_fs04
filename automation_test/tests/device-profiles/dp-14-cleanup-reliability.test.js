const { test: baseTest, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    getErrorMessage,
    createProfileViaModal,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    PROFILE_WITH_DEVICES_NAME,
    PROFILE_WITHOUT_DEVICES_NAME,
    PROFILE_URL,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

const DEFAULT_PROFILE_SETTINGS = JSON.stringify([
    {"key":"kiosk_lock_mode","value":"disabled","dataType":"select","label":"Kiosk Lock Mode","category":"Security","order":0},
    {"key":"exit_lockdown_password","value":"","dataType":"password","label":"Exit Lockdown Password","category":"Security","order":1},
    {"key":"kiosk_application","value":"","dataType":"select","label":"Kiosk Application","category":"System","order":2},
    {"key":"display_resolution","value":"1920x1080","dataType":"select","label":"Display Resolution","category":"Display","order":3},
    {"key":"screen_orientation","value":"landscape","dataType":"select","label":"Screen Orientation","category":"Display","order":4},
    {"key":"brightness_level","value":"100","dataType":"number","label":"Brightness Level","category":"Display","order":5},
    {"key":"enable_audio","value":"enabled","dataType":"select","label":"Enable Audio","category":"Audio","order":6},
    {"key":"volume_level","value":"100","dataType":"number","label":"Volume Level","category":"Audio","order":7},
    {"key":"timezone","value":"Asia/Ho_Chi_Minh","dataType":"timezone","label":"Timezone","category":"System","order":8},
    {"key":"home_launcher","value":"","dataType":"text","label":"Home/Launcher","category":"System","order":9},
    {"key":"power_management_schedule","value":"disabled","dataType":"select","label":"Power Management Schedule","category":"Power","order":10},
    {"key":"power_on_time","value":"","dataType":"time","label":"Power-On Time","category":"Power","order":11},
    {"key":"power_off_time","value":"","dataType":"time","label":"Power-Off Time","category":"Power","order":12},
    {"key":"reboot_schedule_enabled","value":"disabled","dataType":"select","label":"Reboot Schedule","category":"Maintenance","order":13},
    {"key":"reboot_schedule_frequency","value":"daily","dataType":"string","label":"Reboot Frequency","category":"Maintenance","order":14},
    {"key":"reboot_schedule_day","value":"monday","dataType":"string","label":"Reboot Day","category":"Maintenance","order":15},
    {"key":"reboot_schedule_time","value":"02:00","dataType":"string","label":"Reboot Time","category":"Maintenance","order":16},
    {"key":"download_schedule_enabled","value":"disabled","dataType":"select","label":"Download Schedule","category":"Maintenance","order":17},
    {"key":"download_schedule_frequency","value":"daily","dataType":"string","label":"Download Frequency","category":"Maintenance","order":18},
    {"key":"download_schedule_day","value":"monday","dataType":"string","label":"Download Day","category":"Maintenance","order":19},
    {"key":"download_schedule_time","value":"03:00","dataType":"string","label":"Download Time","category":"Maintenance","order":20},
]);

const test = baseTest.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await use(dp);
    },
});

test.use({ storageState: authFile });

test.describe('Section 16 — Cleanup Reliability Tests', () => {

    test('TC-DP-025: Create 1 profile and cleanup — verify profile removed', async ({ dp, page }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'cleanup_single');

        try {
            await test.step('Create test profile', async () => {
                await dp.gotoList();
                await createProfileViaModal(dp, profileName);
                await dp.gotoList();
                await dp.ensureProfileVisible(profileName);
                await expect(dp.profileRowByName(profileName)).toBeVisible();
            });

            await test.step('Delete and verify profile removed', async () => {
                await dp.deleteProfile(profileName);
                await dp.gotoList();
                await expect(dp.profileRowByName(profileName)).toBeHidden();
            });
        } finally {
            await cleanupAutoTestProfiles(page);
        }
    });

    test('TC-DP-026: Create profile that "fails" mid-test — verify cleanup catches it', async ({ dp, page }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'fail_sim');

        try {
            await test.step('Create test profile', async () => {
                await dp.gotoList();
                await createProfileViaModal(dp, profileName);
                await dp.gotoList();
                await dp.ensureProfileVisible(profileName);
                await expect(dp.profileRowByName(profileName)).toBeVisible();
            });

            await test.step('Simulate duplicate name failure', async () => {
                await dp.openEditProfileModal(profileName);
                await dp.profileNameInput.clear();
                await dp.profileNameInput.fill(PROFILE_WITH_DEVICES_NAME);
                await dp.saveButton.click();
                await expect(dp.errorToast).toBeVisible({ timeout: 5000 });
                await expect(dp.modal).toBeVisible();
            });

            await test.step('Close modal, cleanup and verify removal', async () => {
                await dp.closeModal();
                await dp.deleteProfile(profileName);
                await dp.gotoList();
                await expect(dp.profileRowByName(profileName)).toBeHidden();
            });
        } finally {
            await cleanupAutoTestProfiles(page);
        }
    });

    test('TC-DP-027: Bulk create 10 profiles (7 success, 3 duplicate fail) — verify cleanup', async ({ dp, page }) => {
        test.setTimeout(180000);

        const createdNames = [];
        const failedNames = [];
        const TOTAL = 10;
        const FAIL_AT = [3, 6, 9];

        try {
            await test.step('Create 7 profiles via API + 3 duplicate rejections via UI', async () => {
                await dp.gotoList();

                for (let i = 0; i < TOTAL; i++) {
                    const isDuplicate = FAIL_AT.includes(i);

                    if (isDuplicate) {
                        await dp.openAddProfileModal();
                        await dp.fillProfileName(PROFILE_WITH_DEVICES_NAME);
                        await dp.addSubmitButton.click();
                        await expect(dp.errorToast).toBeVisible({ timeout: 5000 });
                        await expect(dp.modal).toBeVisible();
                        failedNames.push(PROFILE_WITH_DEVICES_NAME);
                        await dp.closeModal();
                        await dp.gotoList();
                    } else {
                        const name = generateTestProfileNameWithSuffix('AutoTest', `bulk_${i}`);
                        const response = await page.request.post(`${PROFILE_URL}?/create`, {
                            multipart: {
                                name,
                                description: '',
                                isActive: 'true',
                                settings: DEFAULT_PROFILE_SETTINGS,
                            },
                        });
                        expect(response.ok(), `API create "${name}" should succeed`).toBe(true);
                        createdNames.push(name);
                    }
                }

                expect(createdNames.length, 'Should have 7 successful creates').toBe(7);
                expect(failedNames.length, 'Should have 3 failed creates').toBe(3);
            });

            await test.step('Verify all 7 created profiles exist in list', async () => {
                await dp.gotoList();
                await dp.searchFor('AutoTest');
                for (const name of createdNames) {
                    await expect(dp.profileRowByName(name)).toBeVisible();
                }
                await dp.clearSearch();
            });

            await test.step('Cleanup all created profiles and verify removal', async () => {
                for (const name of createdNames) {
                    try {
                        await dp.deleteProfile(name);
                    } catch (e) {
                        expect.soft(false, `Failed to delete "${name}": ${getErrorMessage(e)}`).toBeTruthy();
                    }
                }

                await dp.gotoList();
                await dp.searchFor('AutoTest');
                for (const name of createdNames) {
                    await expect.soft(
                        dp.profileRowByName(name),
                        `"${name}" should be removed after cleanup`
                    ).toBeHidden();
                }
                await dp.clearSearch();
            });
        } finally {
            await cleanupAutoTestProfiles(page);
        }
    });

    test('TC-DP-028: Verify cleanup does not affect system profiles', async ({ dp, page }) => {
        await test.step('Run cleanup and verify system profiles survive', async () => {
            await cleanupAutoTestProfiles(page);
            await dp.gotoList();

            await expect(
                dp.profileRowByName(PROFILE_WITH_DEVICES_NAME),
                `"${PROFILE_WITH_DEVICES_NAME}" should survive cleanup`
            ).toBeVisible();

            await expect(
                dp.profileRowByName(PROFILE_WITHOUT_DEVICES_NAME),
                `"${PROFILE_WITHOUT_DEVICES_NAME}" should survive cleanup`
            ).toBeVisible();
        });
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        await cleanupAutoTestProfiles(page);
    } catch (e) {
        console.error(`afterAll cleanup failed: ${e.message}`);
    } finally {
        await context.close();
    }
});
