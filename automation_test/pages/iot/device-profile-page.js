const BasePage = require('../base-page');
const config = require('../../config/config-loader');

// Validate config on load
if (!config.pageURL?.deviceProfiles) {
    throw new Error('Missing deviceProfiles config in config-loader.js');
}

class DeviceProfilePage extends BasePage {
    constructor(page, profileId) {
        super(page);
        this.profileId = profileId || null;
        this.listUrl = config.pageURL.deviceProfiles.url;
        this.detailUrl = this.profileId ? `${this.listUrl}/${this.profileId}` : null;

        this.profileWithDevicesId = config.pageURL.deviceProfiles.profileWithDevicesId;
        this.profileWithDevicesName = config.pageURL.deviceProfiles.profileWithDevicesName;
        this.profileWithoutDevicesId = config.pageURL.deviceProfiles.profileWithoutDevicesId;
        this.profileWithoutDevicesName = config.pageURL.deviceProfiles.profileWithoutDevicesName;
        this.profileWithDescriptionId = config.pageURL.deviceProfiles.profileWithDescriptionId;
        this.profileWithDescriptionName = config.pageURL.deviceProfiles.profileWithDescriptionName;
        this.invalidProfileId = config.pageURL.deviceProfiles.invalidProfileId;

        // ── List Page ──────────────────────────────────────────────────
        this.bannerHeading = this.page.locator('h1, h2, h3').filter({ hasText: 'Profiles' }).first();
        this.bannerSubtitle = this.page.locator('text=Manage device profiles and assignments').first();
        this.searchInput = this.page.locator('input[placeholder*="Search"]').first();
        this.addProfileButton = this.page.getByRole('button', { name: /Add Profile/i }).first();
        this.filterButton = this.page.locator('button').filter({ has: this.page.locator('svg.lucide-filter') }).first();

        this.table = this.page.locator('table').first();
        this.tableRows = this.page.locator('table tbody tr');
        this.columnHeader = (name) => this.page.locator('table th').filter({ hasText: name }).first();
        this.nameColumnHeader = this.columnHeader('Name');
        this.createdOnColumnHeader = this.columnHeader('Created On');
        this.statusColumnHeader = this.columnHeader('Status');
        this.tableHeaders = this.table.locator('th');

        this.profileRowByName = (name) => this.page.locator('table tbody tr').filter({ hasText: name }).first();
        this.profileRowById = (id) => this.page.locator('table tbody tr').filter({ hasText: id }).first();
        this.profileNameLink = (name) => this.profileRowByName(name).locator('a, [class*="link"]').first();
        this.profileIdInRow = (name) => this.profileRowByName(name).locator('[class*="text-muted"], [class*="text-secondary"], [class*="text-xs"]').first();

        this.actionsButton = (row) => row.locator('button[aria-label*="Actions"], button:has-text("⋮"), button:has(svg.lucide-ellipsis-vertical)').first();
        this.actionsMenu = this.page.getByRole('menu').or(this.page.locator('[class*="dropdown-menu"]')).first();
        this.menuItemByName = (name) => this.page.locator('[role="menuitem"], button.menu-item').filter({ hasText: name }).first();

        this.paginationDetails = this.page.locator('[class*="pagination-details"], [class*="pagination"]').filter({ hasText: /\d+\s*-\s*\d+\s+of\s+\d+/i }).first();
        this.paginationFirstBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /««|⟪|first/i }).first();
        this.paginationPrevBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /«|‹|prev/i }).first();
        this.paginationNextBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /»|›|next/i }).first();
        this.paginationLastBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /»»|⟫|last/i }).first();
        this.pageNumberBtn = (num) => this.page.locator('[class*="pagination"] button').filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) }).first();

        // ── Modals (defined before modal children so they can reference each other) ──
        // Add/Edit modal - base locator for add/edit forms
        this.addEditModalBase = this.page.locator('[class*="modal-container"]').filter({
            has: this.page.locator('input, textarea, select')
        }).first();
        // Delete modal
        this.deleteModalBase = this.page.locator('[class*="modal-container"]').filter({ hasText: /Delete Profile/i }).first();
        // Filter modal
        this.filterModalBase = this.page.locator('[class*="modal-container"]').filter({ hasText: /Filter/i }).first();

        // Getter: returns the appropriate modal based on type
        this.getModal = (modalType = 'add') => {
            if (modalType === 'delete') return this.deleteModalBase;
            if (modalType === 'filter') return this.filterModalBase;
            return this.addEditModalBase;
        };

        // Default modal (add/edit) - uses getter
        this.modal = this.addEditModalBase;
        this.modalTitle = this.addEditModalBase.locator('h2, [class*="modal-title"]').first();
        this.modalCloseButton = this.addEditModalBase.locator('button[aria-label="Close modal"], button[aria-label="Close"]').first();
        this.profileNameInput = this.addEditModalBase.locator('input[type="text"], input:not([type])').first();
        this.activeToggle = this.addEditModalBase.locator('button[role="switch"], input[type="checkbox"]').first();
        this.descriptionTextarea = this.addEditModalBase.locator('textarea').first();
        this.nameCharCount = this.addEditModalBase.locator('text=/\\d+\\/50/').first();
        this.descriptionCharCount = this.addEditModalBase.locator('text=/\\d+\\/200/').first();

        this.kioskLockModeToggle = this.addEditModalBase.locator('text=Kiosk Lock Mode').locator('..').locator('button[role="switch"], input[type="checkbox"]').first();
        this.kioskAppDropdown = this.addEditModalBase.locator('text=Kiosk Application').locator('..').locator('select, [class*="select"], button[class*="select"]').first();
        this.displayResolutionDropdown = this.addEditModalBase.locator('text=Display Resolution').locator('..').locator('select, [class*="select"], button[class*="select"]').first();
        this.screenOrientationDropdown = this.addEditModalBase.locator('text=Screen Orientation').locator('..').locator('select, [class*="select"], button[class*="select"]').first();
        this.brightnessSlider = this.addEditModalBase.locator('input[type="range"]').first();
        this.audioToggle = this.addEditModalBase.locator('text=Audio').locator('..').locator('button[role="switch"], input[type="checkbox"]').first();
        this.volumeSlider = this.addEditModalBase.locator('input[type="range"]').nth(1);
        this.timezoneDropdown = this.addEditModalBase.locator('text=Timezone').locator('..').locator('select, [class*="select"], button[class*="select"]').first();
        this.homeLauncherDropdown = this.addEditModalBase.locator('text=Home/Launcher').locator('..').locator('select, [class*="select"], button[class*="select"]').first();
        // Toggle is a sibling of the label <div> inside config-row, so go up 2 levels: p → <div> → config-row
        this.powerScheduleToggle = this.addEditModalBase.locator('text=Power Management Schedule').locator('..').locator('..').locator('button[role="switch"], input[type="checkbox"]').first();
        this.rebootScheduleToggle = this.addEditModalBase.locator('text=Reboot Schedule').locator('..').locator('..').locator('button[role="switch"], input[type="checkbox"]').first();
        this.downloadScheduleToggle = this.addEditModalBase.locator('text=Download Schedule').locator('..').locator('..').locator('button[role="switch"], input[type="checkbox"]').first();

        this.cancelButton = this.addEditModalBase.getByRole('button', { name: /Cancel/i }).first();
        this.addSubmitButton = this.addEditModalBase.getByRole('button', { name: /Add/i }).first();
        this.saveButton = this.addEditModalBase.getByRole('button', { name: /Save|Update|Submit/i }).first();

        // ── Delete Confirmation Modal ──────────────────────────────────
        this.deleteModal = this.deleteModalBase;
        this.deleteConfirmButton = this.deleteModalBase.getByRole('button', { name: /Delete/i }).first();
        this.deleteCancelButton = this.deleteModalBase.getByRole('button', { name: /Cancel/i }).first();

        // ── Filter Modal ───────────────────────────────────────────────
        this.filterModal = this.filterModalBase;
        this.filterStatusDropdown = this.filterModalBase.locator('select, [class*="select"], button[class*="select"]').first();
        this.filterClearAllButton = this.filterModalBase.getByRole('button', { name: /Clear All/i }).first();
        this.filterApplyButton = this.filterModalBase.getByRole('button', { name: /Apply/i }).first();

        // ── Assign Modal ───────────────────────────────────────────────
        this.assignModalBase = this.page.locator('[class*="modal-container"], [role="dialog"]').filter({ hasText: /Assign/i }).first();
        this.assignModalSearchInput = this.assignModalBase.locator('input').first();
        this.assignModalCancelButton = this.assignModalBase.getByRole('button', { name: /Cancel/i }).first();
        this.assignModalSubmitButton = this.assignModalBase.getByRole('button', { name: /^Assign$/i }).or(this.assignModalBase.locator('button:has-text("Assign")')).first();
        
        // Luôn nhắm chuẩn xác element chứa text empty hoặc danh sách tags
        this.assignModalNoDataMessage = this.assignModalBase.locator('text=/No data|No tags|Not found|no items|no results/i').first();
        this.assignModalTagListItems = this.assignModalBase.locator('li, [role="row"], [class*="list-item"]');

        // ── Add Device Modal (Device Selector) ──────────────────────
        this.addDeviceModal = this.page.locator('[role="dialog"], [class*="modal"]').filter({ hasText: /Add Device|Select Devices/i }).first();
        this.addDeviceModalTitle = this.addDeviceModal.locator('h2, h3, [class*="title"]').first();
        this.addDeviceSearchInput = this.addDeviceModal.locator('input[placeholder*="earch" i], input').first();
        this.addDeviceSubmitBtn = this.addDeviceModal.getByRole('button', { name: /^Add$/i }).first();
        this.deviceSelectorPortal = this.page.locator('.device-selector-dropdown-portal');
        this.availableDeviceOptions = this.deviceSelectorPortal.locator('.device-selector-option:not(.device-selector-select-all):not(.opacity-50)');
        this.disabledDeviceOptions = this.deviceSelectorPortal.locator('.device-selector-option.opacity-50');
        this.alreadyAssignedBadge = this.deviceSelectorPortal.locator('text=Already assigned');
        this.selectedDeviceItems = this.page.locator('.device-selector-selected-item');

        // ── Reassign Confirmation Modal ─────────────────────────────
        this.reassignConfirmModal = this.page.locator('[role="dialog"], [class*="modal"]').filter({ hasText: /reassign|already assigned to another/i }).first();
        this.reassignCancelButton = this.reassignConfirmModal.getByRole('button', { name: /Cancel/i }).first();

        // ── Detail Page ────────────────────────────────────────────────
        this.detailBannerHeading = this.page.locator('h1, h2, h3').filter({ hasText: 'Profile Details' }).first();
        this.editSetButton = this.page.getByRole('button', { name: /Edit Set/i }).first();
        
        // Error handling for invalid IDs - use a stable fallback if no explicit error container class
        this.errorMessageContainer = this.page.locator('.error-container, [data-testid="error-message"], [class*="error-text"]').first();

        this.overviewCard = this.page.locator('[class*="card"]').filter({ hasText: 'Profile Overview' }).first();
        this.overviewProfileName = this.overviewCard.locator('text=Profile Name').locator('..').locator('[class*="value"], [class*="text"], span, p').last();
        this.overviewStatus = this.overviewCard.locator('[class*="badge"]').first();
        this.overviewDescription = this.overviewCard.locator('text=Description').locator('..').locator('[class*="value"], [class*="text"], span, p').last();
        this.overviewCreatedAt = this.overviewCard.locator('text=Created at').locator('..').locator('[class*="value"], span, p').last();
        this.overviewUpdatedAt = this.overviewCard.locator('text=Last updated at').locator('..').locator('[class*="value"], span, p').last();

        this.tabConfiguration = this.page.getByRole('button', { name: /Configuration/i }).first();
        this.tabAssignedDevices = this.page.getByRole('button', { name: /Assigned Devices/i }).first();

        // ── Configuration Tab ──────────────────────────────────────────
        this.configCard = this.page.locator('[class*="card"]').filter({ hasText: 'Device Configuration' }).first();
        this.configRow = (label) => this.page.locator('[class*="info-row"], [class*="setting-row"], [class*="field-row"]').filter({ hasText: new RegExp(label, 'i') }).first();
        this.configRowValue = (label) => this.configRow(label).locator('[class*="value"], [class*="text-right"], td:last-child, span:last-child').last();

        // ── Assigned Devices Tab ───────────────────────────────────────
        this.devicesCard = this.page.locator('[class*="card"]').filter({ hasText: /Devices/i }).first();
        this.assignByTagButton = this.page.getByRole('button', { name: /Assign by tag/i }).first();
        this.addDeviceButton = this.page.getByRole('button', { name: /Add Device/i }).first();
        this.unassignByTagButton = this.page.getByRole('button', { name: /Unassign by tag/i }).first();
        this.unassignAllButton = this.page.getByRole('button', { name: /Unassign all/i }).first();

        // More robust device table locator - look for table in devices card
        this.deviceTable = this.devicesCard.locator('table').first();
        this.deviceTableRows = this.deviceTable.locator('tbody tr');
        this.deviceRowByMac = (mac) => this.deviceTableRows.filter({ hasText: mac }).first();
        this.deviceActionsButton = (mac) => this.deviceRowByMac(mac).locator('button[aria-label*="Actions"], button:has-text("⋮"), button:has(svg.lucide-ellipsis-vertical)').first();

        // Action btn for any row locators (Rule 1.1, 4.4)
        this.getActionBtnForRow = (rowLocator) => {
            return rowLocator.locator('button[aria-label*="Actions"], button:has-text("⋮"), button:has(svg.lucide-ellipsis-vertical)').first();
        };

        this.devicePagination = this.deviceTable.locator('..').locator('[class*="pagination"]').first();
        this.noDevicesMessage = this.page.locator('text=No devices assigned to this profile').first();

        // ── Toast ──────────────────────────────────────────────────────
        // More specific toast selectors
        this.toast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').first();
        this.successToast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').filter({ hasText: /successfully/i }).first();
        this.errorToast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').filter({ hasText: /error|fail|exist|required/i }).first();

        // ── Row-scoped locators (parameterized by row) ──────────────────
        this.rowNameLink = (row) => row.locator('a, [class*="link"]').first();
        this.rowCells = (row) => row.locator('td');
        this.rowBadge = (row) => row.locator('[class*="badge"]');

        // ── Overview card title ────────────────────────────────────────
        this.overviewCardTitle = this.overviewCard.locator('h3, [class*="title"], [class*="name"]').first();

        // ── Overview field (label-based) ───────────────────────────────
        this.overviewFieldRow = (label) => this.page.locator('[class*="info-row"], [class*="field-row"], [class*="row"]').filter({ hasText: new RegExp(label, 'i') }).first();
        this.overviewFieldValue = (label) => this.overviewFieldRow(label).locator('[class*="value"], span, p').last();

        // ── Filter dropdown option ─────────────────────────────────────
        this.filterDropdownOption = (text) => this.page.locator('[class*="option"], [role="option"], option').filter({ hasText: new RegExp(text, 'i') }).first();

        // ── Modal sliders (all range inputs) ───────────────────────────
        this.modalSliders = this.addEditModalBase.locator('input[type="range"]');

        // ── Empty state ────────────────────────────────────────────────
        this.noProfilesMessage = this.page.locator('text=No profiles found').first();
    }

    async gotoList() {
        await this.page.goto(this.listUrl);
        await this.page.waitForLoadState('domcontentloaded');
        await this.table.or(this.bannerHeading).first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async ensureProfileVisible(profileName) {
        const row = this.profileRowByName(profileName);
        if (!(await row.isVisible())) {
            await this.searchFor(profileName);
            await row.waitFor({ state: 'visible', timeout: 10000 });
        }
    }

    async gotoDetail(profileId) {
        const id = profileId || this.profileId;
        await this.page.goto(`${this.listUrl}/${id}?tab=configuration`, { waitUntil: 'commit' });
        await this.overviewCard.or(this.detailBannerHeading).first().waitFor({ state: 'visible', timeout: 15000 });
    }

    async getRowCount() {
        return await this.tableRows.count();
    }

    async getProfileNameFromRow(row) {
        return await this.rowNameLink(row).textContent().then(t => t.trim());
    }

    async getAssignedDeviceCount(row) {
        const cellTexts = await this.rowCells(row).allTextContents();
        for (const text of cellTexts) {
            if (/^\d+$/.test(text.trim())) return parseInt(text.trim());
        }
        return 0;
    }

    async getRowStatus(row) {
        const badge = this.rowBadge(row);
        if (await badge.count() > 0) {
            return await badge.first().textContent().then(t => t.trim());
        }
        return '';
    }

    async getPaginationText() {
        return await this.paginationDetails.textContent().then(t => t.trim());
    }

    async clickActionsMenu(profileName) {
        const url = this.page.url();
        if (!url.includes('/device-profiles')) {
            // Only reset if we navigated away from the device-profiles section entirely
            await this.page.goto(this.listUrl);
            await this.page.waitForLoadState('domcontentloaded');
            await this.table.waitFor({ state: 'visible', timeout: 10000 });
        }
        let row = this.profileRowByName(profileName);
        if (!(await row.isVisible())) {
            await this.searchFor(profileName);
            row = this.profileRowByName(profileName);
        }
        await row.waitFor({ state: 'visible', timeout: 10000 });
        const btn = this.actionsButton(row);
        await btn.click();
        await this.actionsMenu.waitFor({ state: 'visible', timeout: 5000 });
    }

    async clickActionItem(actionName) {
        const menuItem = this.menuItemByName(actionName);
        await menuItem.waitFor({ state: 'visible', timeout: 10000 });
        await menuItem.click();
    }

    async openAddProfileModal() {
        await this.addProfileButton.waitFor({ state: 'visible', timeout: 10000 });
        await this.addProfileButton.click();
        await this.addEditModalBase.waitFor({ state: 'visible', timeout: 10000 });
    }

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
    }

    async fillProfileName(name) {
        await this.profileNameInput.clear();
        await this.profileNameInput.fill(name);
    }

    async fillDescription(desc) {
        await this.descriptionTextarea.clear();
        await this.descriptionTextarea.fill(desc);
    }

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
    }

    /**
     * Improved closeModal with verification
     * Tries multiple methods and waits for modal to actually close
     */
    async closeModal() {
        const closeBtn = this.modalCloseButton;
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.addEditModalBase.waitFor({ state: 'hidden', timeout: 5000 });
    }

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
    }

    /**
     * Improved searchFor - uses fill() directly without clear() to avoid debounce issues
     */
    async searchFor(searchTerm) {
        await this.searchInput.click();
        await this.searchInput.fill(searchTerm);
        await this.page.waitForLoadState('domcontentloaded');
    }

    async clearSearch() {
        await this.searchInput.click();
        await this.searchInput.fill('');
        await this.page.waitForLoadState('domcontentloaded');
    }

    async openFilter() {
        await this.filterButton.click();
        await this.filterModalBase.waitFor({ state: 'visible', timeout: 5000 });
    }

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
                await this.deviceTable
                    .waitFor({ state: 'visible', timeout: 30000 });
            }
        }
    }

    async getDeviceTableRowCount() {
        return await this.deviceTableRows.count();
    }

    /**
     * Improved waitForToast with better selectors and timeout handling
     */
    async waitForToast(timeout = 5000) {
        await this.toast.waitFor({ state: 'visible', timeout });
        return await this.toast.textContent();
    }

    async waitForSuccessToast(timeout = 5000) {
        await this.successToast.waitFor({ state: 'visible', timeout });
        return await this.successToast.textContent();
    }

    async waitForErrorToast(timeout = 5000) {
        await this.errorToast.waitFor({ state: 'visible', timeout });
        return await this.errorToast.textContent();
    }

    async getOverviewFieldText(label) {
        return await this.overviewFieldValue(label).textContent().then(t => t.trim());
    }

    async getConfigValue(label) {
        return await this.configRowValue(label).textContent().then(t => t.trim());
    }

    // ── Dynamic Data Extraction (replaces hardcoded assertions) ────────

    /**
     * Extracts all profile rows from the list page.
     * Returns an array of { name, id, description, assignedDevices, createdOn, status }.
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
    }

    /**
     * Extracts overview card data from the detail page.
     * Returns { name, status, description, createdAt, updatedAt }.
     */
    async extractOverviewData() {
        const name = await this.overviewCardTitle
            .textContent().then(t => t.trim());
        const status = await this.overviewStatus
            .textContent().then(t => t.trim());
        
        const data = await this.page.evaluate(() => {
            const card = document.querySelector('[class*="card"]');
            if (!card) return {};
            const text = card.textContent || '';
            const desc = text.includes('Description') ? text.split('Description')[1]?.split(/Created|Last updated/)[0]?.trim() : '';
            const createdAt = text.match(/Created at\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APap][Mm]?)/)?.[1] || '';
            const updatedAt = text.match(/Last updated at\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APap][Mm]?)/)?.[1] || '';
            return { description: desc, createdAt, updatedAt };
        });

        return { name, status, description: data.description || '', createdAt: data.createdAt || '', updatedAt: data.updatedAt || '' };
    }

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
    }

    /**
     * Get a specific configuration value locator by its label.
     */
    getConfigValueLocator(label) {
        return this.page.locator('.config-row')
            .filter({ has: this.page.locator('.cell-title', { hasText: label }) })
            .locator('.cell-value, .schedule-badge, .cell-desc')
            .filter({ hasNotText: /^(Screen|Scheduled|Allow|Resolution|Application|Timezone)/ }) // ignore description texts if values exised, although a bit hacky, it works as fallback
            .first();
    }

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
    }

    /**
     * Extracts assigned device table data.
     * Returns array of { name, mac, os, status, applyStatus }.
     */
    async extractDeviceTableData() {
        const devices = [];
        const rowCount = await this.deviceTableRows.count();
        for (let i = 0; i < rowCount; i++) {
            const row = this.deviceTableRows.nth(i);
            const rowText = await row.textContent();
            
            // Skip empty state rows
            if (/no devices assigned/i.test(rowText)) continue;

            const cellTexts = await this.rowCells(row).allTextContents();
            const trimmedCells = cellTexts.map(t => t.trim());
            
            // Extract MAC from row text
            const macMatch = rowText.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
            const mac = macMatch ? macMatch[0] : '';
            const name = trimmedCells[0] || '';
            const os = trimmedCells.find(t => /android|linux|windows|ios/i.test(t)) || '';
            const status = trimmedCells.find(t => /^(Online|Offline)$/i.test(t)) || '';
            const applyStatus = trimmedCells.find(t => /^(Applied|Applying|Failed|—|-)$/i.test(t)) || '';

            devices.push({ name, mac, os, status, applyStatus, rawText: rowText });
        }
        return devices;
    }

    /**
     * Find a device row by status.
     * Returns the row locator or null.
     */
    async findTestableDeviceRow(preferredStatus = null) {
        if (preferredStatus) {
            const preferredRow = this.deviceTableRows.filter({ hasText: new RegExp(preferredStatus, 'i') }).first();
            try {
                // Chờ tối đa 10s để API trả về và render dòng có status mong muốn
                await preferredRow.waitFor({ state: 'visible', timeout: 10000 });
                return preferredRow;
            } catch (e) {
                return null;
            }
        }

        // Nếu không có preferredStatus, poll để chờ bất kỳ dòng device nào (không phải dòng rỗng)
        for (let i = 0; i < 20; i++) {
            try {
                const rowCount = await this.deviceTableRows.count();
                for (let j = 0; j < rowCount; j++) {
                    const row = this.deviceTableRows.nth(j);
                    const rowText = await row.textContent({ timeout: 500 });
                    if (!/no devices assigned/i.test(rowText)) return row;
                }
            } catch (e) {
                // DOM đang update, sẽ thử lại ở vòng lặp sau
            }
            await this.page.waitForTimeout(250);
        }
        return null;
    }
}

module.exports = DeviceProfilePage;
