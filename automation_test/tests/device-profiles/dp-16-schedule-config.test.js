const { test, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    cleanupProfile,
    createProfileAndNavigateToDetail,
    getScheduleToggles,
    setScheduleToggles,
    verifyScheduleBadges,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

test.use({ storageState: authFile });

test.describe('Section 18 — Schedule Configuration', () => {

    /**
     * TC-DP-032: Enable / disable all 3 schedule toggles and verify config tab badges
     */
    test('TC-DP-032: Schedule toggles — enable/disable cycle with config tab verification', async ({ page }) => {
        const dp = new DeviceProfilePage(page);
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'schedule');

        await createProfileAndNavigateToDetail(dp, page, profileName, 'configuration');

        const scheduleToggles = getScheduleToggles(dp);

        try {
            await test.step('Enable all 3 schedule toggles', async () => {
                await setScheduleToggles(dp, page, scheduleToggles, true);
            });

            await test.step('Verify Enabled badges in config tab', async () => {
                await dp.switchToTab('configuration');
                await verifyScheduleBadges(dp, scheduleToggles, 'enabled');
            });

            await test.step('Disable all 3 schedule toggles', async () => {
                await setScheduleToggles(dp, page, scheduleToggles, false);
            });

            await test.step('Verify Disabled badges in config tab', async () => {
                await dp.switchToTab('configuration');
                await verifyScheduleBadges(dp, scheduleToggles, 'disabled');
            });

        } finally {
            await cleanupProfile(dp, profileName);
        }
    });

    /**
     * TC-DP-033: Schedule config tab badges cross-verify with Edit modal toggle states
     */
    test('TC-DP-033: Schedule config tab badges match Edit modal toggle states — cross-verify', async ({ page }) => {
        const dp = new DeviceProfilePage(page);
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'sched_xverify');
        await createProfileAndNavigateToDetail(dp, page, profileName, 'configuration');

        const scheduleFields = getScheduleToggles(dp);

        async function extractConfigTabStates() {
            const states = {};
            const configValues = await dp.extractConfigTabValues();
            for (const { label } of scheduleFields) {
                const entry = configValues[label] || {};
                const combined = `${entry.value || ''} ${entry.badge || ''}`.trim();
                const isEnabled  = /enabled/i.test(combined);
                const isDisabled = /disabled/i.test(combined);
                states[label] = isEnabled ? 'enabled' : isDisabled ? 'disabled' : 'unknown';
            }
            return states;
        }

        async function setAllSchedulesLocal(targetEnabled) {
            for (const { label, toggle } of scheduleFields) {
                await toggle.scrollIntoViewIfNeeded();
                const ariaChecked = await toggle.getAttribute('aria-checked');
                const isOn = ariaChecked === 'true';
                if (targetEnabled && !isOn) {
                    await toggle.click();
                    if (label === 'Power Management Schedule') {
                        const timeInputs = page.locator('input[type="time"]');
                        await timeInputs.first().waitFor({ state: 'visible', timeout: 10000 });
                        await timeInputs.first().fill('08:00');
                        await timeInputs.nth(1).fill('20:00');
                    }
                } else if (!targetEnabled && isOn) {
                    await toggle.click();
                }
            }
            const saveResponsePromise = page.waitForResponse(
                r => r.url().includes('device-profiles') && r.request().method() === 'POST',
                { timeout: 12000 }
            );
            await dp.saveButton.scrollIntoViewIfNeeded();
            await dp.saveButton.click();
            await dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 15000 });
            await saveResponsePromise;
            await dp.waitForSuccessToast();
        }

        async function waitForConfigTabScheduleState(expectedState) {
            await expect.poll(async () => {
                const states = await extractConfigTabStates();
                return scheduleFields.every(({ label }) => states[label] === expectedState);
            }, `All 3 schedule badges should become "${expectedState}" in config tab`).toBe(true);
        }

        try {

        await test.step('Step 1 — Verify initial state: all 3 schedules disabled', async () => {
            const configStates = await extractConfigTabStates();
            for (const { label } of scheduleFields) {
                expect(configStates[label], `${label} should have a known state (Enabled or Disabled)`).toMatch(/^(enabled|disabled)$/);
                expect(configStates[label], `${label} config tab should be disabled initially`).toBe('disabled');
            }

            await dp.editSetButton.click();
            await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
            await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

            for (const { label, toggle } of scheduleFields) {
                await expect(toggle, `${label} toggle should be visible in Edit modal`).toBeVisible();
                await expect(toggle, `${label}: Edit modal toggle should be disabled (unchecked)`).toHaveAttribute('aria-checked', 'false');
            }

            await dp.closeModal();
        });

        await test.step('Step 2 — Enable all 3 schedules and cross-verify config tab vs modal', async () => {
            await dp.editSetButton.click();
            await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
            await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });
            await setAllSchedulesLocal(true);

            await dp.switchToTab('configuration');
            await waitForConfigTabScheduleState('enabled');

            const configStates = await extractConfigTabStates();

            await dp.editSetButton.click();
            await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
            await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

            for (const { label, toggle } of scheduleFields) {
                await expect(toggle, `${label} toggle should be visible in Edit modal`).toBeVisible();
                await expect(toggle, `${label}: Edit modal toggle should be enabled (checked)`).toHaveAttribute('aria-checked', 'true');
            }

            await dp.closeModal();
        });

        await test.step('Step 3 — Disable all 3 schedules and restore original state', async () => {
            await dp.editSetButton.click();
            await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
            await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });
            await setAllSchedulesLocal(false);

            await dp.switchToTab('configuration');
            await waitForConfigTabScheduleState('disabled');

            const configStates = await extractConfigTabStates();

            await dp.editSetButton.click();
            await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
            await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

            for (const { label, toggle } of scheduleFields) {
                await expect(toggle, `${label} toggle should be visible in Edit modal`).toBeVisible();
                await expect(toggle, `${label}: Edit modal toggle should be disabled (unchecked)`).toHaveAttribute('aria-checked', 'false');
            }

            await dp.closeModal();
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
