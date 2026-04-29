/**
 * Detail page — Assigned Devices tab interactions & extraction.
 * Locators for the Add Device modal, Assign-by-Tag modal and the
 * Reassign confirmation modal live on the base class; this mixin
 * focuses on the action/extraction flow on the tab itself.
 */
const deviceProfileDetailDevices = {
    async getDeviceTableRowCount() {
        return await this.deviceTableRows.count();
    },

    /**
     * Extracts assigned device table data.
     * Returns array of { name, mac, os, status, applyStatus, rawText }.
     */
    async extractDeviceTableData() {
        const devices = [];
        const rowCount = await this.deviceTableRows.count();
        for (let i = 0; i < rowCount; i++) {
            const row = this.deviceTableRows.nth(i);
            const rowText = await row.textContent();

            // Skip empty state rows
            if (/no devices assigned/i.test(rowText)) continue;

            const cellTexts = await this.rowCells(row).allTextContents();
            const trimmedCells = cellTexts.map(t => t.trim());

            // Extract MAC from row text
            const macMatch = rowText.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
            const mac = macMatch ? macMatch[0] : '';
            const name = trimmedCells[0] || '';
            const os = trimmedCells.find(t => /android|linux|windows|ios/i.test(t)) || '';
            const status = trimmedCells.find(t => /^(Online|Offline)$/i.test(t)) || '';
            const applyStatus = trimmedCells.find(t => /^(Applied|Applying|Failed|—|-)$/i.test(t)) || '';

            devices.push({ name, mac, os, status, applyStatus, rawText: rowText });
        }
        return devices;
    },

    /**
     * Find a device row by status.
     * Returns the row locator or null.
     */
    async findTestableDeviceRow(preferredStatus = null) {
        if (preferredStatus) {
            const preferredRow = this.deviceTableRows.filter({ hasText: new RegExp(preferredStatus, 'i') }).first();
            try {
                // Chờ tối đa 10s để API trả về và render dòng có status mong muốn
                await preferredRow.waitFor({ state: 'visible', timeout: 10000 });
                return preferredRow;
            } catch (e) {
                return null;
            }
        }

        // Nếu không có preferredStatus, poll để chờ bất kỳ dòng device nào (không phải dòng rỗng)
        for (let i = 0; i < 20; i++) {
            try {
                const rowCount = await this.deviceTableRows.count();
                for (let j = 0; j < rowCount; j++) {
                    const row = this.deviceTableRows.nth(j);
                    const rowText = await row.textContent({ timeout: 500 });
                    if (!/no devices assigned/i.test(rowText)) return row;
                }
            } catch (e) {
                // DOM đang update, sẽ thử lại ở vòng lặp sau
            }
            await this.page.waitForTimeout(250);
        }
        return null;
    },
};

module.exports = deviceProfileDetailDevices;
