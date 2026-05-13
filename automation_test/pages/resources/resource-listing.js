const resourceListing = {
    async getRowCount() {
        return await this.tableRows.count();
    },

    async getPaginationText() {
        return await this.paginationDetails.textContent().then(t => t.trim());
    },

    async extractResourceListData() {
        const rows = [];
        const rowTexts = await this.tableRows.allTextContents();
        for (const rowText of rowTexts) {
            const parts = rowText.split('\n').map(text => text.trim()).filter(Boolean);
            rows.push({ rawText: rowText, parts });
        }
        return rows;
    },

    async getFirstRowText() {
        return await this.tableRows.first().textContent();
    },
};

module.exports = resourceListing;
