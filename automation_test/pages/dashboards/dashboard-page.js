const BasePage = require('../base-page');
const config = require('../../config/config-loader');

class DashboardPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = config.pageURL.dashboard.url;

        // Header
        this.pageTitle = this.page.locator('h1', { hasText: 'Dashboard' });
        this.pageSubtitle = this.page.getByText('Key metrics for your management');

        // Metric Cards
        this.criticalIssuesCard = this.page.locator('[class*="card"]', { hasText: 'Critical Issues' }).first();
        this.warningsCard = this.page.locator('[class*="card"]', { hasText: 'Warnings' }).first();
        this.healthyCard = this.page.locator('[class*="card"]')
            .filter({ has: this.page.locator('.metric-value') })
            .filter({ hasText: 'Healthy' })
            .first();
        this.offlineCard = this.page.locator('[class*="card"]')
            .filter({ has: this.page.locator('.metric-value') })
            .filter({ hasText: 'Offline' })
            .first();
        this.totalDevicesCard = this.page.locator('[class*="card"]', { hasText: 'Total Devices' }).first();

        // Numeric value elements inside each card
        this.criticalIssuesValue = this.criticalIssuesCard.locator('.metric-value').first();
        this.warningsValue = this.warningsCard.locator('.metric-value').first();
        this.healthyValue = this.healthyCard.locator('.metric-value').first();
        this.offlineValue = this.offlineCard.locator('.metric-value').first();
        this.totalDevicesValue = this.totalDevicesCard.locator('.stats-value').first();
    }

    async goto() {
        await this.page.goto(this.url);
        await this.page.waitForLoadState('networkidle');
    }

    async waitForDashboardLoad() {
        await this.pageTitle.waitFor({ state: 'visible', timeout: 15000 });
        await this.pageSubtitle.waitFor({ state: 'visible', timeout: 10000 });
    }

    async getCriticalIssuesBreakdown() {
        const text = await this.criticalIssuesCard.textContent();
        const cpuMatch = text.match(/CPU Load\s+(\d+)/);
        const memMatch = text.match(/Memory\s+(\d+)/);
        const stoMatch = text.match(/Storage\s+(\d+)/);
        const netMatch = text.match(/Network\s+(\d+)/);

        if (!cpuMatch) throw new Error(`CPU Load value not found in Critical Issues card.\nCard text: "${text}"`);
        if (!memMatch) throw new Error(`Memory value not found in Critical Issues card.\nCard text: "${text}"`);
        if (!stoMatch) throw new Error(`Storage value not found in Critical Issues card.\nCard text: "${text}"`);
        if (!netMatch) throw new Error(`Network value not found in Critical Issues card.\nCard text: "${text}"`);

        return {
            cpu: parseInt(cpuMatch[1]),
            memory: parseInt(memMatch[1]),
            storage: parseInt(stoMatch[1]),
            network: parseInt(netMatch[1])
        };
    }

    async getWarningsBreakdown() {
        const text = await this.warningsCard.textContent();
        const cpuMatch = text.match(/CPU\s+(\d+)/);
        const memMatch = text.match(/Memory\s+(\d+)/);
        const stoMatch = text.match(/Storage\s+(\d+)/);
        const netMatch = text.match(/Network\s+(\d+)/);

        if (!cpuMatch) throw new Error(`CPU value not found in Warnings card.\nCard text: "${text}"`);
        if (!memMatch) throw new Error(`Memory value not found in Warnings card.\nCard text: "${text}"`);
        if (!stoMatch) throw new Error(`Storage value not found in Warnings card.\nCard text: "${text}"`);
        if (!netMatch) throw new Error(`Network value not found in Warnings card.\nCard text: "${text}"`);

        return {
            cpu: parseInt(cpuMatch[1]),
            memory: parseInt(memMatch[1]),
            storage: parseInt(stoMatch[1]),
            network: parseInt(netMatch[1])
        };
    }

    async getMetricNumbers() {
        return {
            criticalIssues: await this.getNumericValue(this.criticalIssuesValue, 'Critical Issues'),
            warnings: await this.getNumericValue(this.warningsValue, 'Warnings'),
            healthy: await this.getNumericValue(this.healthyValue, 'Healthy'),
            offline: await this.getNumericValue(this.offlineValue, 'Offline'),
            totalDevices: await this.getNumericValue(this.totalDevicesValue, 'Total Devices')
        };
    }

    async getNumericValue(valueLocator, cardName) {
        if (await valueLocator.count() === 0)
            throw new Error(`Value element not found in "${cardName}" card.`);
        const val = await valueLocator.textContent();
        const m = val.match(/(\d+)/);
        if (!m) throw new Error(`No numeric value found in "${cardName}" card. Text: "${val}"`);
        return parseInt(m[0]);
    }
}
module.exports = DashboardPage;

