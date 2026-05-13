const config = require('../config/config-loader');

function getBaseAPIUrl() {
    const deviceUrl = config.pageURL.devices.url;
    return deviceUrl.replace(/\/user\/iot\/devices$/, '');
}

async function restoreDeviceName(page, deviceId, originalName) {
    if (!deviceId || !originalName) return;
    const base = getBaseAPIUrl();
    await page.goto(`${base}/user/iot/devices/${deviceId}`, { waitUntil: 'load' });

    const editBtn = page.getByRole('button', { name: /Edit Device/i }).first();
    await editBtn.waitFor({ state: 'visible', timeout: 15000 });
    await editBtn.click();

    const modal = page.locator('[role="dialog"], .modal, [class*="modal"], [class*="dialog"]').first();
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    const nameInput = modal.locator('input').first();
    const currentValue = await nameInput.inputValue();
    if (currentValue === originalName) {
        // Already at target name — close without saving
        const cancelBtn = modal.getByRole('button', { name: /Cancel|Close/i }).first();
        await cancelBtn.click();
        await modal.waitFor({ state: 'hidden', timeout: 10000 });
        return;
    }

    await nameInput.clear();
    await nameInput.fill(originalName);

    const saveBtn = modal.getByRole('button', { name: /Save|Update|Submit/i }).first();
    await saveBtn.click({ force: true });
    await modal.waitFor({ state: 'hidden', timeout: 15000 });
}

module.exports = {
    restoreDeviceName,
};
