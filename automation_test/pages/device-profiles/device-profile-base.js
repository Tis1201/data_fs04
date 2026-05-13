const BasePage = require('../base-page');
const config = require('../../config/config-loader');

// Validate config on load
if (!config.pageURL?.deviceProfiles) {
    throw new Error('Missing deviceProfiles config in config-loader.js');
}

class DeviceProfileBase extends BasePage {
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

        // ── Listing Page Banner ────────────────────────────────────────
        this.bannerHeading = this.page.locator('h1, h2, h3').filter({ hasText: 'Profiles' }).first();
        this.bannerSubtitle = this.page.locator('text=Manage device profiles and assignments').first();
        this.searchInput = this.page.locator('input[placeholder*="Search"]').first();
        this.addProfileButton = this.page.getByRole('button', { name: /Add Profile/i }).first();
        this.filterButton = this.page.locator('button').filter({ has: this.page.locator('svg.lucide-filter') }).first();

        // ── Listing Table ──────────────────────────────────────────────
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

        // ── Listing Pagination ─────────────────────────────────────────
        this.paginationDetails = this.page.locator('[class*="pagination-details"], [class*="pagination"]').filter({ hasText: /\d+\s*-\s*\d+\s+of\s+\d+/i }).first();
        this.paginationFirstBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /««|⟪|first/i }).first();
        this.paginationPrevBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /«|‹|prev/i }).first();
        this.paginationNextBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /»|›|next/i }).first();
        this.paginationLastBtn = this.page.locator('[class*="pagination"] button').filter({ hasText: /»»|⟫|last/i }).first();
        this.pageNumberBtn = (num) => this.page.locator('[class*="pagination"] button').filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) }).first();

        // ── Modals: base locators ──────────────────────────────────────
        // Add/Edit Profile modal
        this.addEditModalBase = this.page.locator('[class*="modal-container"]').filter({
            has: this.page.locator('input, textarea, select')
        }).first();
        // Delete Profile modal
        this.deleteModalBase = this.page.locator('[class*="modal-container"]').filter({ hasText: /Delete Profile/i }).first();
        // Filter modal
        this.filterModalBase = this.page.locator('[class*="modal-container"]').filter({ hasText: /Filter/i }).first();

        // Getter: returns the appropriate modal based on type
        this.getModal = (modalType = 'add') => {
            if (modalType === 'delete') return this.deleteModalBase;
            if (modalType === 'filter') return this.filterModalBase;
            return this.addEditModalBase;
        };

        // Default modal alias (Add/Edit)
        this.modal = this.addEditModalBase;
        this.modalTitle = this.addEditModalBase.locator('h2, [class*="modal-title"]').first();
        this.modalCloseButton = this.addEditModalBase.locator('button[aria-label="Close modal"], button[aria-label="Close"]').first();

        // ── Add/Edit Profile Modal — Form fields ───────────────────────
        this.profileNameInput = this.addEditModalBase.locator('input[type="text"], input:not([type])').first();
        this.activeToggle = this.addEditModalBase.locator('button[role="switch"], input[type="checkbox"]').first();
        this.descriptionTextarea = this.addEditModalBase.locator('textarea').first();
        this.nameCharCount = this.addEditModalBase.locator('text=/\\d+\\/50/').first();
        this.descriptionCharCount = this.addEditModalBase.locator('text=/\\d+\\/200/').first();

        // ── Add/Edit Profile Modal — Configuration fields ──────────────
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
        // Use a more specific locator for the Dropdown component trigger
        this.filterStatusDropdown = this.filterModalBase.locator('text=Status').locator('..').locator('[role="combobox"], button[class*="dropdown-trigger"], [class*="select"]').first();
        this.filterClearAllButton = this.filterModalBase.getByRole('button', { name: /Clear All/i }).first();
        this.filterApplyButton = this.filterModalBase.getByRole('button', { name: /Apply/i }).first();

        // ── Assign-by-Tag Modal ────────────────────────────────────────
        this.assignModalBase = this.page.locator('[class*="modal-container"], [role="dialog"]').filter({ hasText: /Assign/i }).first();
        this.assignModalSearchInput = this.assignModalBase.locator('input').first();
        this.assignModalCancelButton = this.assignModalBase.getByRole('button', { name: /Cancel/i }).first();
        this.assignModalSubmitButton = this.assignModalBase.getByRole('button', { name: /^Assign$/i }).or(this.assignModalBase.locator('button:has-text("Assign")')).first();

        // Luôn nhắm chuẩn xác element chứa text empty hoặc danh sách tags
        this.assignModalNoDataMessage = this.assignModalBase.locator('text=/No data|No tags|Not found|no items|no results/i').first();
        this.assignModalTagListItems = this.assignModalBase.locator('li, [role="row"], [class*="list-item"]');

        // ── Add Device Modal (Device Selector) ─────────────────────────
        this.addDeviceModal = this.page.locator('[role="dialog"], [class*="modal"]').filter({ hasText: /Add Device|Select Devices/i }).first();
        this.addDeviceModalTitle = this.addDeviceModal.locator('h2, h3, [class*="title"]').first();
        this.addDeviceSearchInput = this.addDeviceModal.locator('input[placeholder*="earch" i], input').first();
        this.addDeviceSubmitBtn = this.addDeviceModal.getByRole('button', { name: /^Add$/i }).first();
        this.deviceSelectorPortal = this.page.locator('.device-selector-dropdown-portal');
        this.availableDeviceOptions = this.deviceSelectorPortal.locator('.device-selector-option:not(.device-selector-select-all):not(.opacity-50)');
        this.disabledDeviceOptions = this.deviceSelectorPortal.locator('.device-selector-option.opacity-50');
        this.alreadyAssignedBadge = this.deviceSelectorPortal.locator('text=Already assigned');
        this.selectedDeviceItems = this.page.locator('.device-selector-selected-item');

        // ── Reassign Confirmation Modal ────────────────────────────────
        this.reassignConfirmModal = this.page.locator('[role="dialog"], [class*="modal"]').filter({ hasText: /reassign|already assigned to another/i }).first();
        this.reassignCancelButton = this.reassignConfirmModal.getByRole('button', { name: /Cancel/i }).first();

        // ── Detail Page Banner ─────────────────────────────────────────
        this.detailBannerHeading = this.page.locator('h1, h2, h3').filter({ hasText: 'Profile Details' }).first();
        this.editSetButton = this.page.getByRole('button', { name: /Edit Set/i }).first();

        // Error handling for invalid IDs - use a stable fallback if no explicit error container class
        this.errorMessageContainer = this.page.locator('.error-container, [data-testid="error-message"], [class*="error-text"]').first();

        // ── Detail: Profile Overview Card ──────────────────────────────
        this.overviewCard = this.page.locator('[class*="card"]').filter({ hasText: 'Profile Overview' }).first();
        this.overviewProfileName = this.overviewCard.locator('text=Profile Name').locator('..').locator('[class*="value"], [class*="text"], span, p').last();
        this.overviewStatus = this.overviewCard.locator('[class*="badge"]').first();
        this.overviewDescription = this.overviewCard.locator('text=Description').locator('..').locator('[class*="value"], [class*="text"], span, p').last();
        this.overviewCreatedAt = this.overviewCard.locator('text=Created at').locator('..').locator('[class*="value"], span, p').last();
        this.overviewUpdatedAt = this.overviewCard.locator('text=Last updated at').locator('..').locator('[class*="value"], span, p').last();
        this.overviewCardTitle = this.overviewCard.locator('h3, [class*="title"], [class*="name"]').first();

        // Overview field (label-based)
        this.overviewFieldRow = (label) => this.page.locator('[class*="info-row"], [class*="field-row"], [class*="row"]').filter({ hasText: new RegExp(label, 'i') }).first();
        this.overviewFieldValue = (label) => this.overviewFieldRow(label).locator('[class*="value"], span, p').last();

        // ── Detail: Tabs ───────────────────────────────────────────────
        this.tabConfiguration = this.page.getByRole('button', { name: /Configuration/i }).first();
        this.tabAssignedDevices = this.page.getByRole('button', { name: /Assigned Devices/i }).first();

        // ── Detail: Configuration Tab ──────────────────────────────────
        this.configCard = this.page.locator('[class*="card"]').filter({ hasText: 'Device Configuration' }).first();
        this.configRow = (label) => this.page.locator('[class*="info-row"], [class*="setting-row"], [class*="field-row"]').filter({ hasText: new RegExp(label, 'i') }).first();
        this.configRowValue = (label) => this.configRow(label).locator('[class*="value"], [class*="text-right"], td:last-child, span:last-child').last();

        // ── Detail: Assigned Devices Tab ───────────────────────────────
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

        // ── Toast (cross-page) ─────────────────────────────────────────
        this.toast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').first();
        this.successToast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').filter({ hasText: /successfully/i }).first();
        this.errorToast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]').filter({ hasText: /error|fail|exist|required/i }).first();

        // ── Row-scoped locators (parameterized by row) ─────────────────
        this.rowNameLink = (row) => row.locator('a, [class*="link"]').first();
        this.rowCells = (row) => row.locator('td');
        this.rowBadge = (row) => row.locator('[class*="badge"]');

        // ── Filter dropdown option ─────────────────────────────────────
        this.filterDropdownOption = (text) => this.page.locator('[class*="option"], [role="option"], option').filter({ hasText: new RegExp(text, 'i') }).first();

        // ── Modal sliders (all range inputs) ───────────────────────────
        this.modalSliders = this.addEditModalBase.locator('input[type="range"]');

        // ── Empty state ────────────────────────────────────────────────
        this.noProfilesMessage = this.page.locator('text=No profiles found').first();
    }

    // ── Toast helpers ────────────────────────────────────────────────────
    // Navigation, tab switching, and modal-close actions live in
    // ./actions/navigation-actions.js and are spread into the prototype
    // by ./device-profile-page.js (the entry inside this folder).

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
}

module.exports = DeviceProfileBase;
