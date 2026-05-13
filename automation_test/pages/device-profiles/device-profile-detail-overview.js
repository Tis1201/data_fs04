/**
 * Detail page — Profile Overview card extraction & helpers.
 */
const deviceProfileDetailOverview = {
    async getOverviewFieldText(label) {
        return await this.overviewFieldValue(label).textContent().then(t => t.trim());
    },

    /**
     * Extracts overview card data from the detail page.
     * Returns { name, status, description, createdAt, updatedAt }.
     */
    async extractOverviewData() {
        const name = await this.overviewCardTitle
            .textContent().then(t => t.trim());
        const status = await this.overviewStatus
            .textContent().then(t => t.trim());

        const data = await this.page.evaluate(() => {
            const card = document.querySelector('[class*="card"]');
            if (!card) return {};
            const text = card.textContent || '';
            const desc = text.includes('Description') ? text.split('Description')[1]?.split(/Created|Last updated/)[0]?.trim() : '';
            const createdAt = text.match(/Created at\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APap][Mm]?)/)?.[1] || '';
            const updatedAt = text.match(/Last updated at\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APap][Mm]?)/)?.[1] || '';
            return { description: desc, createdAt, updatedAt };
        });

        return { name, status, description: data.description || '', createdAt: data.createdAt || '', updatedAt: data.updatedAt || '' };
    },
};

module.exports = deviceProfileDetailOverview;
