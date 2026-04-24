const { expect } = require('@playwright/test');
const DeviceProfilePage = require('../pages/iot/device-profile-page');
const { compare } = require('./terminal-helpers');

function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

async function cleanupProfile(dp, profileName) {
    try { await dp.gotoList(); } catch (e) { console.log(`  Cleanup gotoList failed: ${getErrorMessage(e)}`); }
    try {
        if (await dp.profileRowByName(profileName).isVisible()) {
            await dp.deleteProfile(profileName);
            console.log(`  Cleanup: "${profileName}" deleted`);
        }
    } catch (e) { console.log(`  Cleanup delete failed: ${getErrorMessage(e)}`); }
    try {
        if (await dp.addEditModalBase.isVisible()) {
            await dp.closeModal();
        }
    } catch (e) { console.log(`  Cleanup modal close failed: ${getErrorMessage(e)}`); }
}

async function createProfileViaModal(dp, profileName) {
    await dp.openAddProfileModal();
    await dp.fillProfileName(profileName);
    await dp.clickModalSubmit();
}

async function createProfileAndNavigateToDetail(dp, page, profileName, tab = 'configuration') {
    await dp.gotoList();
    await createProfileViaModal(dp, profileName);
    console.log(`  Created profile: "${profileName}"`);

    await dp.gotoList();
    const profileRow = dp.profileRowByName(profileName);
    await profileRow.waitFor({ state: 'visible', timeout: 10000 });
    await profileRow.locator('a').first().click();
    await page.waitForLoadState('domcontentloaded');
    await dp.overviewCard.waitFor({ state: 'visible', timeout: 10000 });
    if (tab) {
        await dp.switchToTab(tab);
    }
}

async function unassignAllDevices(dp, page) {
    if (await dp.unassignAllButton.isVisible({ timeout: 2000 })) {
        await dp.unassignAllButton.click();
        await page.waitForLoadState('domcontentloaded');
        const unassignModal = page.locator('[role="dialog"], [class*="modal"]').filter({ hasText: /Unassign all|unassign/i }).first();
        try {
            if (await unassignModal.isVisible({ timeout: 3000 })) {
                const confirmBtn = unassignModal.getByRole('button', { name: /Unassign|Confirm|Delete/i }).first();
                if (await confirmBtn.isVisible()) { await confirmBtn.click(); await page.waitForLoadState('domcontentloaded'); }
            }
        } catch (e) { console.log(`  Unassign modal handle failed: ${getErrorMessage(e)}`); }
        console.log('  Unassigned all devices');
    }
}

async function handleReassignConfirmation(page) {
    const reassignModal = page.locator('[role="dialog"], [class*="modal"]').filter({ hasText: /reassign|already assigned to another/i }).first();
    if (await reassignModal.isVisible({ timeout: 2000 })) {
        const okBtn = reassignModal.getByRole('button', { name: /OK|Confirm|Yes/i }).first();
        if (await okBtn.isVisible()) { await okBtn.click(); await page.waitForLoadState('domcontentloaded'); }
    }
}

async function closeAnyModal(page, modalLocator) {
    if (await modalLocator.isVisible()) {
        await page.keyboard.press('Escape');
        await modalLocator.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
}

function getScheduleToggles(dp) {
    return [
        { toggle: dp.powerScheduleToggle,  label: 'Power Management Schedule' },
        { toggle: dp.rebootScheduleToggle,  label: 'Reboot Schedule' },
        { toggle: dp.downloadScheduleToggle, label: 'Download Schedule' },
    ];
}

async function setScheduleToggles(dp, page, scheduleToggles, targetEnabled) {
    await dp.editSetButton.click();
    await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
    await expect(dp.profileNameInput).not.toHaveValue('', { timeout: 8000 });

    for (const { toggle, label } of scheduleToggles) {
        await expect(toggle, `${label} toggle should be visible in modal`).toBeVisible();
        const isEnabled = (await toggle.getAttribute('aria-checked')) === 'true';
        if (targetEnabled && !isEnabled) {
            await toggle.click();
            console.log(`  Enabled: ${label}`);
            if (label === 'Power Management Schedule') {
                const timeInputs = page.locator('input[type="time"]');
                await timeInputs.first().waitFor({ state: 'visible', timeout: 5000 });
                await timeInputs.first().fill('08:00');
                await timeInputs.nth(1).fill('20:00');
                console.log('  Filled Power-On time: 08:00, Power-Off time: 20:00');
            }
        } else if (!targetEnabled && isEnabled) {
            await toggle.click();
            console.log(`  Disabled: ${label}`);
        }
    }

    const saveResponsePromise = page.waitForResponse(
        r => r.url().includes('device-profiles') && r.request().method() === 'POST',
        { timeout: 12000 }
    );
    await dp.saveButton.scrollIntoViewIfNeeded();
    await dp.saveButton.click();
    const saveResponse = await saveResponsePromise;
    console.log(`  POST response (${saveResponse.status()})`);
    await dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 15000 });
    const toast = await dp.waitForSuccessToast();
    console.log(`  Saved — toast: "${toast}"`);
}

async function verifyScheduleBadges(dp, scheduleToggles, expectedState) {
    const configValues = await dp.extractConfigTabValues();
    for (const { label } of scheduleToggles) {
        const entry = configValues[label] || {};
        const combined = `${entry.value || ''} ${entry.badge || ''}`.trim();
        const stateRegex = expectedState === 'enabled' ? /enabled/i : /disabled/i;
        console.log(`  ${label}: "${combined}"`);
        expect(stateRegex.test(combined), `${label} should show ${expectedState} badge`).toBeTruthy();
    }
}

function crossVerifyBrightnessVolume(configValues, modalValues) {
    if (configValues['Brightness Level'] && modalValues.brightness) {
        const configBrightness = (configValues['Brightness Level'].value || '').replace('%', '').trim();
        compare('Brightness', configBrightness, modalValues.brightness);
    }
    if (configValues['Volume Level'] && modalValues.volume) {
        const configVolume = (configValues['Volume Level'].value || '').replace('%', '').trim();
        compare('Volume', configVolume, modalValues.volume);
    }
}

async function restoreProfileName(page, profileId, profileName) {
    try {
        const dp = new DeviceProfilePage(page, profileId);
        await dp.gotoDetail();
        const editBtn = dp.editSetButton;

        if (await editBtn.isVisible({ timeout: 8000 })) {
            await editBtn.click();
            await dp.addEditModalBase.waitFor({ state: 'visible', timeout: 8000 });
            const currentVals = await dp.extractEditModalValues();
            const currentVal = currentVals.name;

            if (currentVal !== profileName) {
                await dp.profileNameInput.clear();
                await dp.profileNameInput.fill(profileName);
                await dp.saveButton.click();
                try {
                    await Promise.race([
                        dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 12000 }),
                        dp.waitForSuccessToast().catch(e => console.log(`  Restore toast skipped: ${getErrorMessage(e)}`)),
                    ]);
                    if (await dp.addEditModalBase.isVisible()) {
                        await page.keyboard.press('Escape');
                        await dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 3000 }).catch(e => console.log(`  Modal close skipped: ${getErrorMessage(e)}`));
                    }
                    console.log(`  Restored profile name to "${profileName}"`);
                } catch (e) {
                    console.log('  Restore save failed, closing modal');
                    try {
                        await page.keyboard.press('Escape');
                        await dp.addEditModalBase.waitFor({ state: 'hidden', timeout: 1500 });
                    } catch (closeError) {
                        console.log(`  Modal close skipped: ${getErrorMessage(closeError)}`);
                    }
                }
            } else {
                await page.keyboard.press('Escape');
                console.log(`  Profile name already "${profileName}" — no restore needed`);
            }
        }
    } catch (e) {
        console.log(`  Restore failed: ${getErrorMessage(e)}`);
    }
}

async function cleanupAutoTestProfiles(page) {
    const dp = new DeviceProfilePage(page);
    let cleaned = 0;
    let attempts = 0;
    const maxAttempts = 15;
    console.log('\n  === Global Cleanup: Removing AutoTest profiles ===');

    while (attempts < maxAttempts) {
        attempts++;
        try {
            await dp.gotoList();
            await dp.searchFor('AutoTest');

            const profiles = await dp.extractProfileListData();
            const autoTestProfiles = profiles.filter(p => /^AutoTest/i.test(p.name));
            if (autoTestProfiles.length === 0) break;

            for (const profile of autoTestProfiles) {
                try {
                    await dp.deleteProfile(profile.name);
                    cleaned++;
                    console.log(`  Cleanup: deleted "${profile.name}"`);
                } catch (e) {
                    console.log(`  Cleanup: failed to delete "${profile.name}": ${getErrorMessage(e)}`);
                }
            }
        } catch (e) {
            console.log(`  Cleanup attempt ${attempts} failed: ${getErrorMessage(e)}`);
            break;
        }
    }

    try {
        await dp.gotoList();
        await dp.searchFor('AAAA');
        const profiles = await dp.extractProfileListData();
        const aaaProfile = profiles.find(p => /^A{10,}$/.test(p.name));
        if (aaaProfile) {
            await dp.deleteProfile(aaaProfile.name);
            cleaned++;
            console.log('  Cleanup: deleted long-name (50-A) profile');
        }
    } catch (e) {
        console.log(`  Cleanup: long-name profile cleanup failed: ${getErrorMessage(e)}`);
    }

    console.log(`  Global Cleanup complete: ${cleaned} test profiles removed`);
}

module.exports = {
    getErrorMessage,
    cleanupProfile,
    createProfileViaModal,
    createProfileAndNavigateToDetail,
    unassignAllDevices,
    handleReassignConfirmation,
    closeAnyModal,
    getScheduleToggles,
    setScheduleToggles,
    verifyScheduleBadges,
    crossVerifyBrightnessVolume,
    restoreProfileName,
    cleanupAutoTestProfiles,
};
