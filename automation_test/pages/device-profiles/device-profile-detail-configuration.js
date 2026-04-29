/**
 * Detail page — Configuration tab value extraction & helpers.
 */
const deviceProfileDetailConfiguration = {
    async getConfigValue(label) {
        return await this.configRowValue(label).textContent().then(t => t.trim());
    },

    /**
     * Extracts all configuration values from the Configuration tab.
     * Returns object with key-value pairs for all settings.
     */
    async extractConfigTabValues() {
        return await this.page.evaluate(() => {
            const config = {};
            // Each config setting is rendered as .config-row with:
            const rows = document.querySelectorAll('.config-row');
            for (const row of rows) {
                const titleEl = row.querySelector('.cell-title');
                const valueEl = row.querySelector('.cell-value');
                const descEl = row.querySelector('.cell-desc');
                if (titleEl) {
                    const label = titleEl.textContent.trim();
                    const value = valueEl ? valueEl.textContent.trim() : '';
                    const description = descEl ? descEl.textContent.trim() : '';
                    // For schedule rows, also check for .schedule-badge (Enabled/Disabled)
                    const badgeEl = row.querySelector('.schedule-badge');
                    const badge = badgeEl ? badgeEl.textContent.trim() : '';
                    config[label] = { value: value || badge, description, badge };
                }
            }
            return config;
        });
    },

    /**
     * Get a specific configuration value locator by its label.
     */
    getConfigValueLocator(label) {
        return this.page.locator('.config-row')
            .filter({ has: this.page.locator('.cell-title', { hasText: label }) })
            .locator('.cell-value, .schedule-badge, .cell-desc')
            .filter({ hasNotText: /^(Screen|Scheduled|Allow|Resolution|Application|Timezone)/ }) // ignore description texts if values exised, although a bit hacky, it works as fallback
            .first();
    },
};

module.exports = deviceProfileDetailConfiguration;
