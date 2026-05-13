const listingActions = {
    async searchFor(searchTerm) {
        await this.searchInput.click();
        await this.searchInput.fill(searchTerm);
        await this.page.waitForURL(/[?&]search=/, { timeout: 4000 });
    },

    async clearSearch() {
        await this.searchInput.click();
        await this.searchInput.fill('');
    },

    async clickActionsMenu(resourceNameOrId) {
        if (!this.page.url().includes('/resources')) {
            await this.gotoList();
        }
        let row = this.resourceRowByName(resourceNameOrId);
        if (!(await row.isVisible())) {
            row = this.resourceRowById(resourceNameOrId);
        }
        if (!(await row.isVisible())) {
            await this.searchFor(resourceNameOrId);
            row = this.resourceRowByName(resourceNameOrId).or(this.resourceRowById(resourceNameOrId)).first();
        }
        await row.waitFor({ state: 'visible', timeout: 10000 });
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.actionsButton(row).evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'nearest' }));
            await this.actionsButton(row).click();
            try {
                await this.actionsMenu.waitFor({ state: 'visible', timeout: 3000 });
                return;
            } catch (e) {
                if (attempt === 3) {
                    throw new Error(`Actions menu did not appear after 3 attempts for "${resourceNameOrId}": ${e.message}`);
                }
            }
        }
    },

    async clickActionItem(actionName) {
        const menuItem = this.menuItemByName(actionName);
        await menuItem.waitFor({ state: 'visible', timeout: 10000 });
        await menuItem.click();
    },

    async clickColumnHeader(columnName) {
        await this.columnHeader(columnName).click();
    },
};

module.exports = listingActions;
