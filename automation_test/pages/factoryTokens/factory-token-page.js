const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const BasePage = require('../base-page');
const SortUtils = require('../../utils/sort-utils');
const DialogUtils = require('../../utils/dialog-utils');

class FactoryTokenPage extends BasePage {
    constructor(page) {
        super(page);
        this.page = page;

        this.table = page.locator('table tbody');
        this.tableRows = page.locator('table tbody tr');

        // Page locators
        this.addButton = page.locator('button:has-text("Add Token")');

        // Form fields
        this.nameInput = page.locator('input#name');
        this.hardwareModelInput = page.locator('input#hardwareModel');
        this.firmwareVersionInput = page.locator('input#firmwareVersion');
        this.singingKeySelect = page.locator('select#factory_signing_key_id');

        // Save buttons
        this.saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")');
        this.saveChangesButton = page.locator('button:has-text("Save Changes")');
        this.cancelButton = page.locator('button:has-text("Cancel")');

        // Unsaved changes indicator
        this.unsavedChangesBanner = page.locator('text=You have unsaved changes');
    }


    async goToPage() {
        await this.page.goto(config.pageURL.factoryTokens.url);
        await this.table.waitFor();
    }

    async create(name, hardwareModel, firmwareVersion) {
        await this.goToPage();

        await this.addButton.click();

        await this.nameInput.waitFor({ state: 'visible' });
        await this.nameInput.fill(name);
        await this.hardwareModelInput.fill(hardwareModel);
        await this.firmwareVersionInput.fill(firmwareVersion);
        await this.singingKeySelect.selectOption({ index: 0 });

        await this.saveButton.click();

        await this.tableRows.first().waitFor({ state: 'visible' });
        const newFactoryTokenLocator = this.page.locator(`table td >> text="${name}"`);
        await expect(newFactoryTokenLocator).toBeVisible();
        return true;
    }

    async editNameViaName(oldName, newName) {
        await this.openViaName(oldName);

        // Wait for form to show and input to be editable
        await this.nameInput.waitFor({ state: 'visible' });
        await this.nameInput.fill(newName);

        // Save changes
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
    }

    async verifyAllSort(){
        await this.goToPage();
        await SortUtils.verifyColumnSorting(this.page, 'Token ID', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Hardware Model', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Expires', 'relative', false);
        await SortUtils.verifyColumnSorting(this.page, 'Issued', 'relative', false);

        await SortUtils.verifyColumnSorting(this.page, 'Token ID', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Hardware Model', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Expires', 'relative', true);
        await SortUtils.verifyColumnSorting(this.page, 'Issued', 'relative', true);
    }

    async openViaName(name) {
        const row = await this.getRowByName(name);
        // Prefer the clickable wrapper with role=button near the name
        const nameButton = row.locator('div[role="button"]', { hasText: name });
        if (await nameButton.count()) {
            await nameButton.click();
        } else {
            // fallback to clicking the span itself
            await row.locator('span', { hasText: name }).click();
        }
    }

    async openAction(name, actionName) {
        const row = await this.getRowByName(name);

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
                throw new Error('Could not find action dropdown trigger for  row');
            }
        }

        // Wait for menu and click the desired action
        const menuItem = this.page.locator('div[role="menuitem"]', { hasText: actionName }).first();
        await menuItem.waitFor({ state: 'visible' });
        await menuItem.click();
    }

    // Convenience wrapper for editing via the dropdown
    async ediViaAction(name) {
        await this.openAction(name, 'Edit');
    }

    async delete(name) {
        await this.openAction(name, 'Delete');

        // Handle delete dialog using utility
        await DialogUtils.handleDeleteDialog(this.page);

        await this.goToPage();
        // Verify the  has been removed from the table
        // Use a more direct approach to check if the row exists
        const row = this.tableRows.filter({ hasText: name }).first();
        await expect(row).not.toBeVisible();

        return true;
    }

    async cancelDelete(name) {
        await this.openAction(name, 'Delete');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the  is still in the table
        const row = await this.getRowByName(name);
        await expect(row).toBeVisible();

        return true;
    }

    async getRowByName(name) {
        await this.goToPage();
        const row = this.tableRows.filter({ hasText: name }).first();
        if (!(await row.count())) {
            throw new Error(`Factory token row with name "${name}" not found`);
        }
        return row;
    }

}

module.exports = { FactoryTokenPage };
