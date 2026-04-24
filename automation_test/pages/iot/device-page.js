const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const config = require('../../config/config-loader');

class DevicePage extends BasePage {
    constructor(page, deviceId) {
        super(page);
        this.url = config.pageURL.devices.url;
        this.deviceId = deviceId || null;
        this.deviceUrl = this.deviceId ? `${this.url}/${this.deviceId}` : null;

        // ----- Device list -----
        this.tableRows = this.page.locator('table tbody tr');
        this.allBadges = this.page.locator('.badge');
        this.resourceDots = this.page.locator('.badge-dot');
        this.rowDots = (rowIndex) => this.tableRows.nth(rowIndex).locator('.badge-dot');
        this.paginationDetails = this.page.locator('.ds-pagination-details');
        this.pageNumberButtons = this.page.locator('.ds-pagination button').filter({ hasText: /^\d+$/ });

        // ----- Device detail / snapshot -----
        this.snapshotButton = this.page.getByRole('button', { name: 'Snapshot', exact: true });
        this.connectionStatusRow = this.page.locator('.info-row').filter({ hasText: 'Connection Status' });
        this.snapshotImage = this.page.getByAltText('Screenshot');

        // Toast alerts rendered by addAlert() — scoped to avoid matching activity log text
        this.pageAlerts = this.page.locator('.page-alerts');
        this.sendingLogMessage = this.pageAlerts.getByText(/Sending screenshot command to device/i);
        this.successLogMessage = this.pageAlerts.getByText(/captured successfully/i);
        
        // ----- Activity log -----
        this.activityTab = this.page.getByRole('button', { name: 'Activity Logs', exact: true });
        this.latestActivityRow = this.page.locator('.activity-row').first();
        this.noActivityLogsText = this.page.getByText(/No activity logs found/i);

        // Filters screenshot rows by status badge ('Success' | 'Failed' | 'In Progress').
        // Count-based usage is safer than .first() when multiple users act concurrently.
        this.screenShotActivityRow = (status) =>
            this.page.locator('.activity-row')
                .filter({ has: this.page.locator('.description-text', { hasText: /screenshot/i }) })
                .filter({ has: this.page.getByRole('button', { name: status }) });

        // Convenience badge locators (used when only one match is expected)
        this.latestSuccessBadge = this.page.getByRole('button', { name: 'Success' }).first();
        this.inProgressBadge = this.page.getByRole('button', { name: 'In Progress' });
        this.latestFailedBadge = this.page.getByRole('button', { name: 'Failed' }).first();

        // ----- Activity log table (used by getLatestLogTimestamp) -----
        this.activityTableFirstRow = this.page.locator('table tbody tr').first();
    }

    /** @param {string} status - 'In Progress' | 'Success' | 'Failed' */
    getScreenshotActivityRow(status) {
        return this.screenShotActivityRow(status);
    }

    async getLatestLogTimestamp() {
        const timeText = await this.activityTableFirstRow.locator('td').first().innerText().catch(() => '');
        const ts = new Date(timeText).getTime();
        if (!isNaN(ts) && ts > 1000000000000) return ts;

        const cells = await this.activityTableFirstRow.locator('td').allTextContents().catch(() => []);
        for (const text of cells) {
            const t = new Date(text.trim()).getTime();
            if (!isNaN(t) && t > 1000000000000) return t;
        }

        return Date.now();
    }

    /**
     * Wait until the activity log finishes loading (first row or empty-state visible).
     * Must be called before counting baseline rows to avoid a race with the initial API fetch.
     */
    async waitForActivityLogLoaded() {
        await Promise.race([
            this.latestActivityRow.waitFor({ state: 'visible', timeout: 15000 }),
            this.noActivityLogsText.waitFor({ state: 'visible', timeout: 15000 }),
        ]).catch(() => {}); // tolerate brand-new devices with no logs
    }

    async goto() {
        await this.page.goto(this.url);
        await this.page.waitForLoadState('networkidle');
        await this.tableRows.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async gotoPage(pageNum) {
        await this.page.goto(`${this.url}?page=${pageNum}&per_page=10&sort=name&order=asc`);
        await this.page.waitForLoadState('networkidle');
        await this.tableRows.first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async getTotalPages() {
        // Page number buttons contain only digits — distinct from the arrow buttons
        // which have empty text. If no pagination exists (all rows fit on 1 page),
        // there are no such buttons and we return 1.
        const pageButtons = this.pageNumberButtons;
        const count = await pageButtons.count();
        if (count === 0) return 1;
        const texts = await pageButtons.allTextContents();
        return Math.max(...texts.map(Number));
    }

    async getAllMetricBreakdown() {
        await this.goto();
        const totalPages = await this.getTotalPages();
        let online = 0, offline = 0, total = 0;
        for (let p = 1; p <= totalPages; p++) {
            if (p > 1) await this.gotoPage(p);
            online += await this.getOnlineCount();
            offline += await this.getOfflineCount();
            total += await this.getTotalDevicesCount();
        }
        return { online, offline, total };
    }

    async getAllCriticalBreakdown() {
        await this.goto();
        const totalPages = await this.getTotalPages();
        let cpu = 0, memory = 0, storage = 0, network = 0;
        for (let p = 1; p <= totalPages; p++) {
            if (p > 1) await this.gotoPage(p);
            const d = await this.getCriticalBreakdown();
            cpu += d.cpu; memory += d.memory; storage += d.storage; network += d.network;
        }
        return { cpu, memory, storage, network, total: cpu + memory + storage + network };
    }

    async getAllWarningBreakdown() {
        await this.goto();
        const totalPages = await this.getTotalPages();
        let cpu = 0, memory = 0, storage = 0, network = 0;
        for (let p = 1; p <= totalPages; p++) {
            if (p > 1) await this.gotoPage(p);
            const d = await this.getWarningBreakdown();
            cpu += d.cpu; memory += d.memory; storage += d.storage; network += d.network;
        }
        return { cpu, memory, storage, network, total: cpu + memory + storage + network };
    }

    async getTotalDevicesCount() {
        const rowCount = await this.tableRows.count();
        return rowCount;
    }

    async getOnlineCount() {
        return await this.allBadges.filter({ hasText: 'Online' }).count();
    }

    async getOfflineCount() {
            return await this.allBadges.filter({ hasText: 'Offline' }).count();
    }

    /**
     * Count indicators by resource type based on status color
     * NOTE: Assumes dots are arranged in fixed order per row: CPU(0), MEM(1), DSK(2)
     * @param {string} status - 'critical' (#F04438) or 'warning' (#F79009)
     * @returns {Promise<Object>} Object containing counts per resource type
     */
    async getBreakdownByStatus(status) {
        let targetColor = '';
        if (status === 'critical') targetColor = '#F04438';
        else if (status === 'warning') targetColor = '#F79009';
        else throw new Error('Invalid status. Use "critical" or "warning"');

        const rowCount = await this.tableRows.count();
        let cpuCount = 0, memCount = 0, diskCount = 0, netCount = 0;

        for (let i = 0; i < rowCount; i++) {
            const dots = this.rowDots(i);
            const dotCount = await dots.count();

            for (let j = 0; j < dotCount; j++) {
                const style = await dots.nth(j).getAttribute('style');
                if (style && style.includes(targetColor)) {
                    if (j === 0) cpuCount++;
                    else if (j === 1) memCount++;
                    else if (j === 2) diskCount++;
                    else netCount++;
                }
            }
        }

        return { cpu: cpuCount, memory: memCount, storage: diskCount, network: netCount, total: cpuCount + memCount + diskCount + netCount };
    }

    async getCriticalBreakdown() {
        return this.getBreakdownByStatus('critical');
    }

    async getWarningBreakdown() {
        return this.getBreakdownByStatus('warning');
    }

    /**
     * Get a breakdown of all metrics across all devices on current page
     */
    async getMetricBreakdown() {
        return {
            online: await this.getOnlineCount(),
            offline: await this.getOfflineCount(),
            total: await this.getTotalDevicesCount()
        };
    }

    async gotoDeviceDetail(deviceId) {
        const deviceUrl = `${this.url}/${deviceId}`;
        await this.page.goto(deviceUrl);
        await this.page.waitForLoadState('domcontentloaded');
    }

    async closeSnapshotModal() {
        // Wait until the dialog is actually open before pressing Escape.
        // This makes the method safe to call immediately after triggerSnapshot().
        await this.page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 }).catch(() => {});
        await this.page.keyboard.press('Escape');
        await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
    }

    async switchToActivityTab() {
        const currentUrl = this.page.url();
        if (!currentUrl.includes('tab=activity')) {
            await this.activityTab.click();
            await this.page.waitForURL('**tab=activity**', { timeout: 5000 });
        }
    }

    async getDeviceConnectionStatus() {
        const statusText = await this.connectionStatusRow.textContent();
        return statusText.toLowerCase();
    }

    async triggerSnapshot() {
        await this.snapshotButton.click();
    }

    async waitForSendingLog() {
        await expect(this.sendingLogMessage).toBeVisible({ timeout: 5000 });
    }

    async waitForSuccessLog() {
        await expect(this.successLogMessage).toBeVisible({ timeout: 15000 });
    }

    async waitForActivityLogSuccess() {
        await expect(this.latestSuccessBadge).toBeVisible({ timeout: 15000 });
    }

    async clickLatestActivityRow() {
        await this.latestActivityRow.click();
    }

    async getSnapshotImageSrc() {
        return await this.snapshotImage.getAttribute('src');
    }

    async isSnapshotImageVisible() {
        return await this.snapshotImage.isVisible();
    }
}

module.exports = DevicePage;
