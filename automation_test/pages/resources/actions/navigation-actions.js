const navigationActions = {
    async gotoList(query = '') {
        const suffix = query ? (query.startsWith('?') ? query : `?${query}`) : '';
        await this.page.goto(`${this.listUrl}${suffix}`);
        await this.table.or(this.bannerHeading).first().waitFor({ state: 'visible', timeout: 15000 });
    },

    async gotoDetail(resourceId) {
        const id = resourceId || this.resourceId;
        await this.page.goto(`${this.listUrl}/${id}`, { waitUntil: 'commit' });
        await this.overviewCard.or(this.detailBannerHeading).or(this.errorMessageContainer).first().waitFor({ state: 'visible', timeout: 15000 });
    },

    async ensureResourceVisible(resourceName) {
        const row = this.resourceRowByName(resourceName);
        if (!(await row.isVisible())) {
            await this.searchFor(resourceName);
            await row.waitFor({ state: 'visible', timeout: 10000 });
        }
    },

    async closeModal() {
        await this.page.keyboard.press('Escape');
        await this.modalBase.waitFor({ state: 'hidden', timeout: 5000 });
    },
};

module.exports = navigationActions;
