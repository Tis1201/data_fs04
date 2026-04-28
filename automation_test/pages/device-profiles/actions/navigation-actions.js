/**
 * Navigation & cross-page actions for the Device Profiles area:
 * page navigation, tab switching, and modal close. These mutate
 * page state but are not specific to a single feature mixin.
 */
const navigationActions = {
    async gotoList() {
        await this.page.goto(this.listUrl);
        await this.page.waitForLoadState('domcontentloaded');
        await this.table.or(this.bannerHeading).first().waitFor({ state: 'visible', timeout: 10000 });
    },

    async gotoDetail(profileId) {
        const id = profileId || this.profileId;
        await this.page.goto(`${this.listUrl}/${id}?tab=configuration`, { waitUntil: 'commit' });
        await this.overviewCard.or(this.detailBannerHeading).first().waitFor({ state: 'visible', timeout: 15000 });
    },

    async ensureProfileVisible(profileName) {
        const row = this.profileRowByName(profileName);
        if (!(await row.isVisible())) {
            await this.searchFor(profileName);
            await row.waitFor({ state: 'visible', timeout: 10000 });
        }
    },

    async switchToTab(tabName) {
        if (tabName === 'configuration') {
            await this.tabConfiguration.click();
            await this.page.waitForTimeout(500);
        } else if (tabName === 'devices') {
            await this.tabAssignedDevices.click();
            // Wait for device table — always rendered (empty or not), retry with reload if times out
            let appeared = true;
            try {
                await this.deviceTable.waitFor({ state: 'visible', timeout: 30000 });
            } catch (e) {
                appeared = false;
                console.log(`Device table did not appear: ${e.message}. Attempting reload...`);
            }
            if (!appeared) {
                await this.page.reload();
                await this.page.waitForLoadState('domcontentloaded');
                await this.tabAssignedDevices.click();
                await this.deviceTable.waitFor({ state: 'visible', timeout: 30000 });
            }
        }
    },

    /**
     * Improved closeModal with verification.
     * Tries multiple methods and waits for modal to actually close.
     */
    async closeModal() {
        const closeBtn = this.modalCloseButton;
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.addEditModalBase.waitFor({ state: 'hidden', timeout: 5000 });
    },
};

module.exports = navigationActions;
