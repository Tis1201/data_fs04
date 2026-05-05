const BasePage = require('../base-page');
const config = require('../../config/config-loader');

if (!config.pageURL?.resources) {
    throw new Error('Missing resources config in config-loader.js');
}

class ResourceBase extends BasePage {
    constructor(page, resourceId) {
        super(page);
        this.resourceId = resourceId || null;
        this.listUrl = config.pageURL.resources.url;
        this.detailUrl = this.resourceId ? `${this.listUrl}/${this.resourceId}` : null;

        this.applicationResourceId = config.pageURL.resources.applicationResourceId;
        this.applicationResourceName = config.pageURL.resources.applicationResourceName;
        this.archiveResourceId = config.pageURL.resources.archiveResourceId;
        this.archiveResourceName = config.pageURL.resources.archiveResourceName;
        this.invalidResourceId = config.pageURL.resources.invalidResourceId;
        this.accountName = config.pageURL.resources.accountName;

        this.bannerHeading = this.page.locator('h1, h2, h3').filter({ hasText: /Applications & Resources/i }).first();
        this.bannerSubtitle = this.page.getByText('Manage application packages and resources').first();
        this.searchInput = this.page.getByPlaceholder(/Search by Name, Type or Package Name|Search/i).first();
        this.addResourceButton = this.page.getByRole('button', { name: /Add Resource/i }).first();

        this.table = this.page.locator('table').first();
        this.tableRows = this.table.locator('tbody tr');
        this.tableHeaders = this.table.locator('th');
        this.columnHeader = (name) => this.table.locator('th').filter({ hasText: new RegExp(name, 'i') }).first();
        this.resourceRowByName = (name) => this.tableRows.filter({ hasText: name }).first();
        this.resourceRowById = (id) => this.tableRows.filter({ hasText: id }).first();
        this.resourceNameLink = (name) => this.resourceRowByName(name).locator('a, [role="link"], [class*="link"]').first();
        this.resourceNameLinkById = (id) => this.resourceRowById(id).locator('a, [role="link"], [class*="link"]').first();
        this.rowCells = (row) => row.locator('td');
        // aria-haspopup="menu" is set by ActionMenu's trigger button — reliable regardless of icon class name
        this.actionsButton = (row) => row.locator('button[aria-haspopup="menu"]').first();
        this.actionsMenu = this.page.locator('[role="menu"], [class*="dropdown-menu"], [data-radix-popper-content-wrapper]').first();
        this.menuItemByName = (name) => this.page.locator('[role="menuitem"], button, a').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`, 'i') }).first();

        this.paginationDetails = this.page.locator('.ds-pagination-details').first();
        // Pagination nav buttons are icon-only with no text or aria-label; use positional selectors
        this.paginationFirstBtn = this.page.locator('.ds-pagination-controls > button').nth(0);
        this.paginationPrevBtn = this.page.locator('.ds-pagination-controls > button').nth(1);
        this.paginationNextBtn = this.page.locator('.ds-pagination-controls > button').nth(2);
        this.paginationLastBtn = this.page.locator('.ds-pagination-controls > button').nth(3);
        this.pageNumberBtn = (num) => this.page.locator('button.ds-pagination-page').filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) }).first();

        this.modalBase = this.page.locator('[role="dialog"], [class*="modal-container"], [class*="modal"]').filter({ hasText: /resource/i }).first();
        this.modalTitle = this.modalBase.locator('h1, h2, h3, [class*="title"]').first();
        this.modalCloseButton = this.modalBase.locator('button[aria-label*="Close"], button:has-text("✕"), button:has-text("×")').first();
        this.fileInput = this.modalBase.locator('input[type="file"]').first();
        this.resourceNameInput = this.modalBase.getByLabel(/Resource Name/i).or(this.modalBase.locator('input[name="name"], input#name, input[type="text"]').first()).first();
        this.packageNameInput = this.modalBase.getByLabel(/Package Name/i).or(this.modalBase.locator('input').nth(1)).first();
        this.versionInput = this.modalBase.getByLabel(/^Version$/i).or(this.modalBase.locator('input').nth(2)).first();
        this.accountInput = this.modalBase.getByLabel(/Account/i).or(this.modalBase.locator('input, button').filter({ hasText: /account/i }).first()).first();
        this.releaseTypeDropdown = this.modalBase.getByLabel(/Release Type/i).or(this.modalBase.locator('button, select').filter({ hasText: /Production|Release Type/i }).first()).first();
        this.resourcePathInput = this.modalBase.getByLabel(/Resource Path/i).or(this.modalBase.locator('input').last()).first();
        this.nameCharCount = this.modalBase.getByText(/\d+\s*\/\s*50/).first();
        // Use text-content filter (not getByRole) to avoid matching the FileUpload's icon-only aria-label="Cancel" button
        this.cancelButton = this.modalBase.locator('button').filter({ hasText: 'Cancel' }).first();
        this.addSubmitButton = this.modalBase.getByRole('button', { name: /^Add$/i }).first();
        this.saveButton = this.modalBase.getByRole('button', { name: /Save|Update|Submit/i }).first();
        this.validationMessage = this.modalBase.locator('[role="alert"], [class*="error"], [class*="invalid"], .text-red-500, .text-destructive').first();
        this.uploadedFileLink = this.modalBase.locator('a, button').filter({ hasText: /\.apk|\.zip|\.cpk|\.deb|\.exe/i }).first();
        this.parsePendingIndicator = this.modalBase.locator('.resource-parse-pending').first();

        this.deleteModalBase = this.page.locator('[role="dialog"], [class*="modal-container"], [class*="modal"]').filter({ hasText: /delete/i }).first();
        this.deleteConfirmButton = this.deleteModalBase.getByRole('button', { name: /^Delete$/i }).first();
        this.deleteCancelButton = this.deleteModalBase.getByRole('button', { name: /Cancel/i }).first();

        this.detailBannerHeading = this.page.locator('h1, h2, h3').filter({ hasText: /Resource Details/i }).first();
        this.detailBannerSubtitle = this.page.getByText('Key information about this resource').first();
        this.editSetButton = this.page.getByRole('button', { name: /Edit Set/i }).first();
        this.overviewCard = this.page.locator('[class*="card"], section, article').filter({ hasText: /Resource Overview/i }).first();
        this.overviewCardTitle = this.overviewCard.locator('h1, h2, h3, [class*="title"]').first();
        this.overviewFieldRow = (label) => this.overviewCard.locator('div, li, tr, dl').filter({ hasText: new RegExp(label, 'i') }).first();
        this.overviewFieldValue = (label) => this.overviewFieldRow(label).locator('[class*="value"], dd, td, span, p').last();
        this.resourceUploadedFileLink = this.overviewCard.locator('a, button').filter({ hasText: /\.apk|\.zip|\.cpk|\.deb|\.exe/i }).first();
        this.copyResourcePathButton = this.overviewCard.getByRole('button', { name: /Copy|Copy resource path|Copy full path/i }).first();
        this.resourcePathText = this.overviewCard.getByText(/https:\/\/.*\/resources\//i).first();
        this.errorMessageContainer = this.page.getByText(/something went wrong|not found|error|404/i).first();

        this.toast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').first();
        this.successToast = this.toast.filter({ hasText: /successfully|success/i }).first();
        this.errorToast = this.toast.filter({ hasText: /error|fail|required|invalid|exceed|allowed/i }).first();
        this.noResourcesMessage = this.page.getByText(/No resources found|No data|No results/i).first();
    }

    async waitForToast(timeout = 7000) {
        await this.toast.waitFor({ state: 'visible', timeout });
        return await this.toast.textContent();
    }

    async waitForSuccessToast(timeout = 7000) {
        await this.successToast.waitFor({ state: 'visible', timeout });
        return await this.successToast.textContent();
    }

    async waitForErrorToast(timeout = 7000) {
        await this.errorToast.waitFor({ state: 'visible', timeout });
        return await this.errorToast.textContent();
    }
}

module.exports = ResourceBase;
