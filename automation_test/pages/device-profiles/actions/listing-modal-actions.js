/**
 * Listing-page modal actions: Add Profile, Edit Profile, Delete Profile.
 * Pure modal extraction (e.g. extractEditModalValues) stays in
 * `device-profile-listing-modals.js`.
 */
const listingModalActions = {
    async openAddProfileModal() {
        await this.addProfileButton.waitFor({ state: 'visible', timeout: 10000 });
        await this.addProfileButton.click();
        await this.addEditModalBase.waitFor({ state: 'visible', timeout: 10000 });
    },

    async openEditProfileModal(profileName) {
        await this.clickActionsMenu(profileName);
        await this.clickActionItem('Edit');
        await this.addEditModalBase.waitFor({ state: 'visible', timeout: 5000 });
        // Poll until name input is pre-filled (form data may load asynchronously)
        for (let i = 0; i < 50; i++) {
            try {
                const value = await this.profileNameInput.inputValue({ timeout: 500 });
                if (value.trim().length > 0) break;
            } catch (e) {

            }
            await this.page.waitForTimeout(100);
        }
    },

    async fillProfileName(name) {
        await this.profileNameInput.clear();
        await this.profileNameInput.fill(name);
    },

    async fillDescription(desc) {
        await this.descriptionTextarea.clear();
        await this.descriptionTextarea.fill(desc);
    },

    async clickModalSubmit(mode = 'add') {
        if (mode === 'add') {
            console.log(`  clickModalSubmit: Clicking Add button`);
            await this.addSubmitButton.click();
        } else {
            console.log(`  clickModalSubmit: Clicking Save button`);
            await this.saveButton.click();
        }
        // Wait for modal to close (if it closes)
        await this.addEditModalBase.waitFor({ state: 'hidden', timeout: 10000 });
    },

    async deleteProfile(profileName) {
        console.log(`  deleteProfile: Starting for "${profileName}"`);
        await this.page.goto(this.listUrl);
        console.log(`  deleteProfile: Navigated to list`);
        await this.page.waitForLoadState('domcontentloaded');
        await this.table.or(this.bannerHeading).first().waitFor({ state: 'visible', timeout: 10000 });
        console.log(`  deleteProfile: Page ready`);

        const row = this.profileRowByName(profileName);
        const rowVisible = await row.isVisible();
        console.log(`  deleteProfile: Row visible: ${rowVisible}`);
        if (!rowVisible) {
            console.log(`  deleteProfile: Searching for profile`);
            await this.searchFor(profileName);
        }

        console.log(`  deleteProfile: Clicking actions menu`);
        await this.clickActionsMenu(profileName);
        console.log(`  deleteProfile: Clicking Delete action`);
        await this.clickActionItem('Delete');

        console.log(`  deleteProfile: Waiting for delete modal`);
        await this.deleteModalBase.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`  deleteProfile: Clicking confirm button`);
        await this.deleteConfirmButton.click();
        console.log(`  deleteProfile: Waiting for delete modal to close`);
        await this.deleteModalBase.waitFor({ state: 'hidden', timeout: 10000 });
        console.log(`  deleteProfile: Delete complete`);
    },
};

module.exports = listingModalActions;
