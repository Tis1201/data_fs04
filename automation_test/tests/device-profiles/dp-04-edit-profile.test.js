const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    cleanupProfile,
    createProfileViaModal,
    restoreProfileName,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
    PROFILE_WITH_DEVICES_NAME,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

// Rule 11.1 & 16.2: Fixture
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await dp.gotoList();
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        const dp = new DeviceProfilePage(page);
        // Rule 15.2: Catch teardown errors but MUST LOG to console
        await cleanupProfile(dp, `${PROFILE_WITH_DEVICES_NAME}-edited`)
            .catch(e => console.error(`BeforeAll cleanup edited failed: ${e.message}`));
        await cleanupProfile(dp, `${PROFILE_WITH_DEVICES_NAME}-v2`)
            .catch(e => console.error(`BeforeAll cleanup v2 failed: ${e.message}`));
    } finally {
        await context.close();
    }
});

test.describe('Section 5 — Edit Profile (Update)', () => {

    // Rule 19.2: Separate independent behaviors into distinct Test Cases
    test.describe('TC-DP-007: Edit Profile Name', () => {
        test('TC-DP-007a: Edit via Actions menu — pre-fill, save, cross-verify', async ({ page, dp }) => {
            await test.step('Open edit modal via Actions menu', async () => {
                await dp.openEditProfileModal(PROFILE_WITH_DEVICES_NAME);
                await expect(dp.modal, 'Edit modal should be visible').toBeVisible();
            });

            await test.step('Verify name is pre-filled correctly', async () => {
                // Rule 3.1 & 18 #9: Use Web-first Assertions instead of NodeJS assert
                await expect(dp.profileNameInput).not.toBeEmpty();
                await expect(dp.profileNameInput).toHaveValue(new RegExp(`^${PROFILE_WITH_DEVICES_NAME}$`, 'i'));
            });

            const editedName = `${PROFILE_WITH_DEVICES_NAME}-edited`;
            try {
                await test.step('Edit name and save', async () => {
                    await dp.profileNameInput.clear();
                    await dp.profileNameInput.fill(editedName);
                    await dp.saveButton.click();
                    await expect(dp.addEditModalBase).toBeHidden({ timeout: 10000 });
                });

                await test.step('Verify success toast', async () => {
                    await dp.waitForSuccessToast();
                });
            } finally {
                // Rule 17.6: Always restore the previous state in try/finally
                await test.step('Restore original name', async () => {
                    await restoreProfileName(page, PROFILE_WITH_DEVICES_ID, PROFILE_WITH_DEVICES_NAME);
                });
            }
        });

        test('TC-DP-007b: Edit via Detail page Edit Set button — pre-fill, save, cross-verify', async ({ page }) => {
            const dpDetail = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);
            
            await test.step('Navigate to detail page', async () => {
                await dpDetail.gotoDetail();
            });

            await test.step('Open edit modal via Edit Set button', async () => {
                await dpDetail.editSetButton.click();
                await expect(dpDetail.modal, 'Edit modal should be visible after clicking Edit Set').toBeVisible();
            });

            await test.step('Verify name is pre-filled correctly in modal', async () => {
                await expect(dpDetail.profileNameInput).not.toBeEmpty();
                await expect(dpDetail.profileNameInput).toHaveValue(new RegExp(`^${PROFILE_WITH_DEVICES_NAME}$`, 'i'));
            });

            const tempName = `${PROFILE_WITH_DEVICES_NAME}-v2`;
            try {
                await test.step('Edit name and save', async () => {
                    await dpDetail.profileNameInput.clear();
                    await dpDetail.profileNameInput.fill(tempName);
                    await dpDetail.saveButton.click();
                    await expect(dpDetail.addEditModalBase).toBeHidden({ timeout: 10000 });
                });

                await test.step('Verify success toast and updated name on page', async () => {
                    await dpDetail.waitForSuccessToast();
                    
                    // Rule 8: Targeted assertion
                    await expect(dpDetail.overviewProfileName, `Overview should show updated name "${tempName}"`).toContainText(tempName);
                });
            } finally {
                await test.step('Restore original name', async () => {
                    await restoreProfileName(page, PROFILE_WITH_DEVICES_ID, PROFILE_WITH_DEVICES_NAME);
                });
            }
        });
    });

    test.describe('TC-DP-008: Update Profile Settings', () => {
        test('TC-DP-008a: Toggle profile status', async ({ dp }) => {
            const profileName = generateTestProfileNameWithSuffix('AutoTest', 'status');
            
            try {
                await test.step('Create a temporary profile', async () => {
                    await createProfileViaModal(dp, profileName);
                });

                await test.step('Open edit modal and toggle status', async () => {
                    await dp.gotoList();
                    await dp.openEditProfileModal(profileName);
                    await expect(dp.modal).toBeVisible();
                    
                    // Rule 18 #1: Don't use if-else, expect the component to always exist
                    const toggle = dp.activeToggle;
                    await expect(toggle).toBeVisible();
                    await toggle.click();
                    
                    await dp.saveButton.click();
                    await expect(dp.addEditModalBase).toBeHidden({ timeout: 10000 });
                });
                
                await test.step('Verify success toast', async () => {
                    await dp.waitForSuccessToast();
                });
            } finally {
                await test.step('Cleanup temporary profile', async () => {
                    await cleanupProfile(dp, profileName).catch(e => console.error(`Cleanup error: ${e.message}`));
                });
            }
        });

        test('TC-DP-008b: Update Brightness setting', async ({ dp }) => {
            const profileName = generateTestProfileNameWithSuffix('AutoTest', 'brightness');
            
            try {
                await test.step('Create a temporary profile', async () => {
                    await createProfileViaModal(dp, profileName);
                });

                await test.step('Open edit modal and change brightness', async () => {
                    await dp.gotoList();
                    await dp.openEditProfileModal(profileName);
                    await expect(dp.modal).toBeVisible();
                    
                    const slider = dp.brightnessSlider;
                    await expect(slider).toBeVisible();
                    const testBrightness = '60';
                    await slider.fill(testBrightness);
                    
                    await dp.saveButton.click();
                    await expect(dp.addEditModalBase).toBeHidden({ timeout: 10000 });
                });
                
                await test.step('Verify success toast', async () => {
                    await dp.waitForSuccessToast();
                });
            } finally {
                await test.step('Cleanup temporary profile', async () => {
                    await cleanupProfile(dp, profileName).catch(e => console.error(`Cleanup error: ${e.message}`));
                });
            }
        });
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        const dp = new DeviceProfilePage(page);
        // Similarly, replace all empty catches with catches that have logging
        await cleanupProfile(dp, `${PROFILE_WITH_DEVICES_NAME}-edited`)
            .catch(e => console.error(`AfterAll cleanup edited failed: ${e.message}`));
        await cleanupProfile(dp, `${PROFILE_WITH_DEVICES_NAME}-v2`)
            .catch(e => console.error(`AfterAll cleanup v2 failed: ${e.message}`));

        await cleanupAutoTestProfiles(page)
            .catch(e => console.error(`AfterAll cleanup AutoTest failed: ${e.message}`));
            
        await restoreProfileName(page, PROFILE_WITH_DEVICES_ID, PROFILE_WITH_DEVICES_NAME)
            .catch(e => console.error(`AfterAll restore original name failed: ${e.message}`));
    } finally { 
        await context.close(); 
    }
});
