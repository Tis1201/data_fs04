const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const BasePage = require('../base-page');
const SortUtils = require('../../utils/sort-utils');
const DialogUtils = require('../../utils/dialog-utils');

class CompanyPage extends BasePage {
    constructor(page) {
        super(page);
        this.page = page;

        this.tableRows = page.locator('table tbody tr');

        // Page locators
        this.companyListName = page.locator('h2', { hasText: 'Companies' });
        this.addCompanyButton = page.locator('button:has-text("Add Company")');

        // Form fields
        this.companyNameInput = page.locator('input#name[placeholder="Enter company name"]');
        this.accountSelect = page.locator('button[role="combobox"]');
        this.statusCheckbox = page.locator('button[role="checkbox"][id="status"]');
        this.addressTextarea = page.locator('textarea#address[placeholder="Enter company address"]');
        this.contactEmailInput = page.locator('input#contactEmail[type="email"]');
        this.contactPhoneInput = page.locator('input#contactPhone[type="tel"]');
        this.descriptionTextarea = page.locator('textarea#description[placeholder="Enter company description"]');

        // Save buttons
        this.saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")');
        this.saveChangesButton = page.locator('button:has-text("Save Changes")');
        this.cancelButton = page.locator('button:has-text("Cancel")');

        // Unsaved changes indicator
        this.unsavedChangesBanner = page.locator('text=You have unsaved changes');
    }

    async goToCompanyPage() {
        await this.page.goto(config.pageURL.companies.url);
        await this.companyListName;
    }

    /*
    ########################################################
    ################ Create Company #########################
    ########################################################
    */
    async createCompany(companyName, accountName, contactEmail, options = {}) {
        await this.goToCompanyPage();

        await this.addCompanyButton.click();

        // Fill required fields
        await this.companyNameInput.waitFor({ state: 'visible' });
        await this.companyNameInput.fill(companyName);

        // Select account if provided
        if (accountName) {
            await this.accountSelect.click();
            // Wait for options to appear and select the first available option
            const accountOptions = this.page.locator('div[role="option"]');
            await accountOptions.first().waitFor({ state: 'visible' });
            await accountOptions.first().click();
        }

        // Set status (default to active)
        if (options.status !== false) {
            const isActive = await this.statusCheckbox.getAttribute('aria-checked') === 'true';
            if (!isActive) {
                await this.statusCheckbox.click();
            }
        } else {
            const isActive = await this.statusCheckbox.getAttribute('aria-checked') === 'true';
            if (isActive) {
                await this.statusCheckbox.click();
            }
        }

        // Fill optional fields
        if (options.address) {
            await this.addressTextarea.fill(options.address);
        }

        await this.contactEmailInput.fill(contactEmail);

        if (options.contactPhone) {
            await this.contactPhoneInput.fill(options.contactPhone);
        }

        if (options.description) {
            await this.descriptionTextarea.fill(options.description);
        }

        await this.saveButton.click();

        // Verify company was created
        await this.tableRows.first().waitFor({ state: 'visible' });
        const newCompanyLocator = this.page.locator(`table td >> text="${companyName}"`);
        await expect(newCompanyLocator).toBeVisible();
        return true;
    }

    /*
    ########################################################
    ################ Edit Company ###########################
    ########################################################
    */
    async editCompanyNameViaName(oldName, newName) {
        await this.openCompanyViaName(oldName);

        // Wait for form to show and input to be editable
        await this.companyNameInput.waitFor({ state: 'visible' });
        await this.companyNameInput.fill(newName);

        // Save changes (no unsaved banner in company edit)
        await expect(this.saveChangesButton).toBeEnabled();
        await this.saveChangesButton.click();

        await this.goToCompanyPage();
        // Wait for page to redirect back to company list
        await this.companyListName.waitFor({ state: 'visible' });

        // Verify the company name was updated by checking the table
        const row = await this.getRowByName(newName);
        await expect(row).toBeVisible();

        return true;
    }

    async verifyAllSort() {
        await this.goToCompanyPage();
        await SortUtils.verifyColumnSorting(this.page, 'Name', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Status', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Created', 'relative', false);

        await SortUtils.verifyColumnSorting(this.page, 'Name', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Status', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Created', 'relative', true);
    }

    /*
    * Way 1: Open company by clicking its name/span (or parent button)
    */
    async openCompanyViaName(companyName) {
        const row = await this.getRowByName(companyName);
        // Prefer the clickable wrapper with role=button near the name
        const nameButton = row.locator('div[role="button"]', { hasText: companyName });
        if (await nameButton.count()) {
            await nameButton.click();
        } else {
            // fallback to clicking the span itself
            await row.locator('span', { hasText: companyName }).click();
        }
    }

    /*
     * Way 2: Open action dropdown and select an action by visible label
     * actionName examples: 'Edit Company', 'Deactivate', 'Delete'
     */
    async openCompanyAction(companyName, actionName) {
        const row = await this.getRowByName(companyName);

        // Find the ellipsis / action dropdown trigger in that row
        const ellipsisButton = row.locator('button').filter({
            has: row.locator('svg[class*="lucide-ellipsis-vertical"], svg[aria-label="More"]'),
        }).first();

        if (await ellipsisButton.count()) {
            await ellipsisButton.click();
        } else {
            // fallback: any button in the actions cell
            const fallbackButton = row.locator('td').last().locator('button').first();
            if (await fallbackButton.count()) {
                await fallbackButton.click();
            } else {
                throw new Error('Could not find action dropdown trigger for company row');
            }
        }

        // Wait for menu and click the desired action
        const menuItem = this.page.locator('div[role="menuitem"]', { hasText: actionName }).first();
        await menuItem.waitFor({ state: 'visible' });
        await menuItem.click();
    }

    // Convenience wrapper for editing via the dropdown
    async editCompanyViaAction(companyName) {
        await this.openCompanyAction(companyName, 'Edit Company');
    }

    /*
    ########################################################
    ################ Deactivate Company ####################
    ########################################################
    */
    async deactivateCompany(companyName) {
        await this.openCompanyAction(companyName, 'Deactivate');

        // Handle deactivate dialog using utility
        await DialogUtils.handleDeactivateDialog(this.page, companyName);

        await this.goToCompanyPage();
        // Verify the company status has changed to "Inactive" or similar
        const row = await this.getRowByName(companyName);
        const statusCell = row.locator('td').nth(1); // Status column (2nd column, 0-indexed)
        await expect(statusCell).toContainText('Inactive');

        return true;
    }

    /*
    ########################################################
    ################ Delete Company #########################
    ########################################################
    */
    async deleteCompany(companyName) {
        await this.openCompanyAction(companyName, 'Delete');

        // Handle delete dialog using utility
        await DialogUtils.handleDeleteDialog(this.page);

        await this.goToCompanyPage();
        // Verify the company has been removed from the table
        // Use a more direct approach to check if the row exists
        const row = this.tableRows.filter({ hasText: companyName }).first();
        await expect(row).not.toBeVisible();

        return true;
    }

    /*
    ########################################################
    ################ Cancel Dialog Operations ##############
    ########################################################
    */
    async cancelDeactivateCompany(companyName) {
        await this.openCompanyAction(companyName, 'Deactivate');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the company is still in the table and status hasn't changed
        const row = await this.getRowByName(companyName);
        await expect(row).toBeVisible();

        return true;
    }

    async cancelDeleteCompany(companyName) {
        await this.openCompanyAction(companyName, 'Delete');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the company is still in the table
        const row = await this.getRowByName(companyName);
        await expect(row).toBeVisible();

        return true;
    }

    async getRowByName(companyName) {
        await this.goToCompanyPage();
        const row = this.tableRows.filter({ hasText: companyName }).first();
        if (!(await row.count())) {
            throw new Error(`Company row with name "${companyName}" not found`);
        }
        return row;
    }
}

module.exports = { CompanyPage };
