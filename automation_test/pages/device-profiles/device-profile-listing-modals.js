/**
 * Listing-page modal data extraction. The user-action flows for the
 * Add / Edit / Delete profile modals live in
 * ./actions/listing-modal-actions.js.
 */
const deviceProfileListingModals = {
    /**
     * Extracts edit modal pre-filled values.
     * Must be called when the edit modal is already open.
     * Returns object with current modal field values.
     */
    async extractEditModalValues() {
        const result = {};
        // Poll until name is populated (React sets value asynchronously)
        for (let i = 0; i < 50; i++) {
            try {
                result.name = await this.profileNameInput.inputValue({ timeout: 500 });
                if (result.name.trim().length > 0) break;
            } catch (e) {
                result.name = ''; // Reset nếu lỗi để poll lại ở vòng tiếp theo
            }
            await this.page.waitForTimeout(100);
        }

        // Active toggle
        if (await this.activeToggle.isVisible()) {
            const checked = await this.activeToggle.getAttribute('aria-checked') || 'false';
            result.active = checked === 'true';
        }

        // Description
        result.description = await this.descriptionTextarea.inputValue();

        // Sliders
        const sliderCount = await this.modalSliders.count();
        if (sliderCount > 0) result.brightness = await this.modalSliders.first().inputValue();
        if (sliderCount > 1) result.volume = await this.modalSliders.nth(1).inputValue();

        return result;
    },
};

module.exports = deviceProfileListingModals;
