const listingModalActions = {
    async openAddResourceModal() {
        await this.addResourceButton.waitFor({ state: 'visible', timeout: 10000 });
        await this.addResourceButton.click();
        await this.modalBase.waitFor({ state: 'visible', timeout: 10000 });
    },

    async uploadResourceFile(filePath) {
        await this.fileInput.setInputFiles(filePath);
        // waitFor({ state: 'hidden' }) resolves immediately if the element never appears (fast parse)
        // and waits correctly if parsing takes time. No catch needed.
        await this.parsePendingIndicator.waitFor({ state: 'hidden', timeout: 60000 });
    },

    async fillResourceName(name) {
        await this.resourceNameInput.clear();
        await this.resourceNameInput.fill(name);
    },

    async createResourceViaModal(name, filePath) {
        await this.openAddResourceModal();
        await this.uploadResourceFile(filePath);
        // Re-fill name after parse completes (parse may auto-populate name from file metadata)
        await this.fillResourceName(name);
        await this.addSubmitButton.click();
        await this.modalBase.waitFor({ state: 'hidden', timeout: 20000 });
    },

    async openEditResourceModal(resourceNameOrId) {
        await this.clickActionsMenu(resourceNameOrId);
        await this.clickActionItem('Edit');
        await this.modalBase.waitFor({ state: 'visible', timeout: 10000 });
        await this.resourceNameInput.waitFor({ state: 'visible', timeout: 10000 });
    },

    async saveResourceModal() {
        await this.saveButton.click();
        await this.modalBase.waitFor({ state: 'hidden', timeout: 15000 });
    },

    async deleteResource(resourceNameOrId) {
        await this.clickActionsMenu(resourceNameOrId);
        await this.clickActionItem('Delete');
        await this.deleteModalBase.waitFor({ state: 'visible', timeout: 5000 });
        await this.deleteConfirmButton.click();
        await this.deleteModalBase.waitFor({ state: 'hidden', timeout: 30000 });
    },
};

module.exports = listingModalActions;
