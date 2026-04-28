/**
 * Listing-page actions: search, filter open, and row-action menu interactions.
 * Pure getters / extractors stay in `device-profile-listing.js`.
 */
const listingActions = {
    /**
     * Improved searchFor — uses fill() directly without clear() to avoid debounce issues.
     */
    async searchFor(searchTerm) {
        await this.searchInput.click();
        await this.searchInput.fill(searchTerm);
        await this.page.waitForLoadState('domcontentloaded');
    },

    async clearSearch() {
        await this.searchInput.click();
        await this.searchInput.fill('');
        await this.page.waitForLoadState('domcontentloaded');
    },

    async openFilter() {
        await this.filterButton.click();
        await this.filterModalBase.waitFor({ state: 'visible', timeout: 5000 });
    },

    async clickActionsMenu(profileName) {
        const url = this.page.url();
        if (!url.includes('/device-profiles')) {
            // Only reset if we navigated away from the device-profiles section entirely
            await this.page.goto(this.listUrl);
            await this.page.waitForLoadState('domcontentloaded');
            await this.table.waitFor({ state: 'visible', timeout: 10000 });
        }
        let row = this.profileRowByName(profileName);
        if (!(await row.isVisible())) {
            await this.searchFor(profileName);
            row = this.profileRowByName(profileName);
        }
        await row.waitFor({ state: 'visible', timeout: 10000 });
        const btn = this.actionsButton(row);
        await btn.click();
        await this.actionsMenu.waitFor({ state: 'visible', timeout: 5000 });
    },

    async clickActionItem(actionName) {
        const menuItem = this.menuItemByName(actionName);
        await menuItem.waitFor({ state: 'visible', timeout: 10000 });
        await menuItem.click();
    },
};

module.exports = listingActions;
