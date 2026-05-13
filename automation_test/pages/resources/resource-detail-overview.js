const resourceDetailOverview = {
    async extractOverviewText() {
        return await this.overviewCard.innerText();
    },

    async getOverviewFieldText(label) {
        return await this.overviewFieldRow(label).innerText();
    },
};

module.exports = resourceDetailOverview;
