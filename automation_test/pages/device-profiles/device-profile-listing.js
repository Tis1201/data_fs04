/**
 * Listing-page data accessors: row metadata, pagination text, and
 * structured row extraction. User-driven actions (search, filter
 * open, row action menu) live in ./actions/listing-actions.js.
 */
const deviceProfileListing = {
    async getRowCount() {
        return await this.tableRows.count();
    },

    async getProfileNameFromRow(row) {
        return await this.rowNameLink(row).textContent().then(t => t.trim());
    },

    async getAssignedDeviceCount(row) {
        const cellTexts = await this.rowCells(row).allTextContents();
        for (const text of cellTexts) {
            if (/^\d+$/.test(text.trim())) return parseInt(text.trim());
        }
        return 0;
    },

    async getRowStatus(row) {
        const badge = this.rowBadge(row);
        if (await badge.count() > 0) {
            return await badge.first().textContent().then(t => t.trim());
        }
        return '';
    },

    async getPaginationText() {
        return await this.paginationDetails.textContent().then(t => t.trim());
    },

    /**
     * Extracts all profile rows from the list page.
     * Returns an array of { name, assignedDevices, createdOn, status, rawText }.
     */
    async extractProfileListData() {
        const rows = [];
        const count = await this.tableRows.count();
        for (let i = 0; i < count; i++) {
            const row = this.tableRows.nth(i);
            const rowText = await row.textContent();
            const name = await this.rowNameLink(row).textContent().then(t => t.trim());
            const cellTexts = await this.rowCells(row).allTextContents();
            let assignedDevices = 0;
            let createdOn = '';
            for (const cellText of cellTexts) {
                const trimmed = cellText.trim();
                if (/^\d+$/.test(trimmed)) assignedDevices = parseInt(trimmed);
                if (/\w{3}\s+\d{1,2},\s+\d{4}/.test(trimmed)) createdOn = trimmed;
            }
            let status = '';
            const badge = this.rowBadge(row);
            if (await badge.count() > 0) {
                status = await badge.first().textContent().then(t => t.trim());
            }
            rows.push({ name, assignedDevices, createdOn, status, rawText: rowText });
        }
        return rows;
    },
};

module.exports = deviceProfileListing;
