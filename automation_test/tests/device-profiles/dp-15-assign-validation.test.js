const { test: baseTest, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const {
    getErrorMessage,
    createProfileAndNavigateToDetail,
    unassignAllDevices,
    handleReassignConfirmation,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
    PROFILE_WITH_DEVICES_NAME,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

const test = baseTest.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await use(dp);
    },
});

test.use({ storageState: authFile });

test.describe('Section 17 — Assign Device Validation', () => {

    test('TC-DP-029: Assign device already on same profile — shows Already assigned badge', async ({ dp, page }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest_assign_same');
        await createProfileAndNavigateToDetail(dp, page, profileName, 'devices');

        try {
            await test.step('Assign 1 device to profile', async () => {
                await dp.addDeviceButton.click();
                await expect(dp.addDeviceModal, 'Add Device modal should open').toBeVisible();

                await expect(dp.availableDeviceOptions.first(), 'Device list must load before interacting').toBeVisible();
                const availCount = await dp.availableDeviceOptions.count();
                expect(availCount, 'Must have at least one available device to test assignment validation').toBeGreaterThan(0);

                await dp.availableDeviceOptions.nth(0).click();
                await dp.addDeviceModalTitle.click();

                await expect(dp.addDeviceSubmitBtn, 'Add button should be enabled').toBeEnabled();
                await dp.addDeviceSubmitBtn.click();
                await handleReassignConfirmation(page);
                await dp.waitForToast(5000);

                await expect.poll(async () => (await dp.extractDeviceTableData()).length, 'Should have ≥1 device after assign').toBeGreaterThanOrEqual(1);
            });

            await test.step('Verify "Already assigned" badge and disabled state on reopen', async () => {
                await dp.addDeviceButton.click();
                await expect(dp.addDeviceModal, 'Add Device modal should reopen').toBeVisible();

                await expect(dp.alreadyAssignedBadge.first(), '"Already assigned" badge should appear for previously assigned device').toBeVisible({ timeout: 5000 });

                const disabledCount = await dp.disabledDeviceOptions.count();
                expect(disabledCount, 'Previously assigned device should appear disabled').toBeGreaterThan(0);

                await dp.disabledDeviceOptions.first().click();
                const selectedCount = await dp.selectedDeviceItems.count();
                expect(selectedCount, 'Clicking disabled row should NOT add to selection').toBe(0);

                await page.keyboard.press('Escape');
            });
        } finally {
            if (await dp.addDeviceModal.isVisible()) {
                await page.keyboard.press('Escape');
                try {
                    await dp.addDeviceModal.waitFor({ state: 'hidden', timeout: 3000 });
                } catch (e) {
                    console.warn('Could not close Add Device modal via Escape');
                }
            }
            try {
                await unassignAllDevices(dp, page);
            } catch (e) {
                console.error(`Cleanup unassign failed: ${getErrorMessage(e)}`);
            }
            await cleanupAutoTestProfiles(page);
        }
    });

    test('TC-DP-030: Assign 2 devices at once — independent with full setup and cleanup', async ({ dp, page }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest_assign_multi');
        await createProfileAndNavigateToDetail(dp, page, profileName, 'devices');

        try {
            await test.step('Select 2 devices and assign', async () => {
                await dp.addDeviceButton.click();
                await expect(dp.addDeviceModal, 'Add Device modal should be visible').toBeVisible();

                await expect(dp.availableDeviceOptions.first(), 'Device list must load before interacting').toBeVisible();
                const availCount = await dp.availableDeviceOptions.count();
                expect(availCount, 'Need at least 2 available devices for multi-assign test').toBeGreaterThanOrEqual(2);

                for (let i = 0; i < 2; i++) {
                    await dp.availableDeviceOptions.nth(i).click();
                }

                expect(await dp.selectedDeviceItems.count(), '2 devices should be in selected list').toBe(2);

                await dp.addDeviceModalTitle.click();

                await expect(dp.addDeviceSubmitBtn, 'Add button should be enabled with 2 devices selected').toBeEnabled();
                await dp.addDeviceSubmitBtn.click();

                await handleReassignConfirmation(page);
                await dp.waitForToast(5000);

                await expect(dp.deviceTableRows, 'Should have ≥2 device rows after assigning 2').toHaveCount(2, { timeout: 10000 });
                expect((await dp.extractDeviceTableData()).length, 'Should have ≥2 devices after assigning 2').toBeGreaterThanOrEqual(2);
            });
        } finally {
            try {
                await unassignAllDevices(dp, page);
            } catch (e) {
                console.error(`Cleanup unassign failed: ${getErrorMessage(e)}`);
            }
            await cleanupAutoTestProfiles(page);
        }
    });

    test('TC-DP-031: Assign device from another profile — shows reassign confirmation', async ({ dp, page }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest_assign_other');

        let targetSearchTerm;
        await test.step('Verify source profile has devices and identify target', async () => {
            const dpSource = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);
            await dpSource.gotoDetail();
            await dpSource.switchToTab('devices');
            const sourceDevices = await dpSource.extractDeviceTableData();
            expect(sourceDevices.length, `Source profile "${PROFILE_WITH_DEVICES_NAME}" must have at least one device to test reassign`).toBeGreaterThan(0);
            const targetDevice = sourceDevices[0];
            targetSearchTerm = targetDevice.name || targetDevice.mac;
            expect(targetSearchTerm, 'Target device should have a name or MAC').toBeTruthy();
        });

        await createProfileAndNavigateToDetail(dp, page, profileName, 'devices');

        try {
            await test.step('Search for target device and attempt assign', async () => {
                await dp.addDeviceButton.click();
                await expect(dp.addDeviceModal, 'Add Device modal should be visible').toBeVisible();

                await expect(dp.addDeviceSearchInput, 'Search input should be visible in add modal').toBeVisible({ timeout: 3000 });
                await dp.addDeviceSearchInput.fill(targetSearchTerm);

                await expect(dp.availableDeviceOptions.first(), `Device "${targetSearchTerm}" should appear in dropdown`).toBeVisible({ timeout: 5000 });

                await dp.availableDeviceOptions.first().click();
                await dp.addDeviceModalTitle.click();

                await expect(dp.addDeviceSubmitBtn, 'Add button should be enabled').toBeEnabled();
                await dp.addDeviceSubmitBtn.click();
            });

            await test.step('Verify reassign confirmation modal appears and cancel', async () => {
                await expect(dp.reassignConfirmModal, 'Reassign confirmation modal should appear').toBeVisible({ timeout: 5000 });
                await expect(dp.reassignCancelButton, 'Cancel button should be visible in reassign modal').toBeVisible();
                await dp.reassignCancelButton.click();
            });
        } finally {
            try {
                await dp.deleteProfile(profileName);
            } catch (e) {
                console.error(`Cleanup delete failed: ${getErrorMessage(e)}`);
            }
            await cleanupAutoTestProfiles(page);
        }
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
