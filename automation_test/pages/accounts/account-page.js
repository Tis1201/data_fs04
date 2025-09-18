const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const BasePage = require('../base-page');
const SortUtils = require('../../utils/sort-utils');
const DialogUtils = require('../../utils/dialog-utils');

class AccountPage extends BasePage {
    constructor(page) {
        super(page);
        this.page = page;

        this.table = page.locator('table tbody');
        this.tableRows = page.locator('table tbody tr');

        // Page locators
        this.accountListName = page.locator('text=Accounts List');
        this.addAccountButton = page.locator('button:has-text("Add Account")');

        // Form fields
        this.accountNameInput = page.locator('input#name[placeholder="Enter account name"]');
        this.descriptionInput = page.locator('textarea#description[placeholder="Enter account description"]');

        // Save buttons
        this.saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")');
        this.saveChangesButton = page.locator('button:has-text("Save Changes")');
        this.cancelButton = page.locator('button:has-text("Cancel")');

        // Unsaved changes indicator
        this.unsavedChangesBanner = page.locator('text=You have unsaved changes');
    }


    async goToAccountPage() {
        await this.page.goto(config.pageURL.accounts.url);
        await expect(this.accountListName).toBeVisible();
        await this.table.waitFor();
    }

    /*
    ########################################################
    ################ Create Account ########################
    ########################################################
    */
    async createAccount(accountName, description) {
        await this.goToAccountPage();

        await this.addAccountButton.click();

        await this.accountNameInput.waitFor({ state: 'visible' });
        await this.accountNameInput.fill(accountName);
        await this.descriptionInput.fill(description);

        await this.saveButton.click();

        await this.tableRows.first().waitFor({ state: 'visible' });
        const newAccountLocator = this.page.locator(`table td >> text="${accountName}"`);
        await expect(newAccountLocator).toBeVisible();
        return true;
    }

    /*
    ########################################################
    ################ Edit Account ########################
    ########################################################
    */
    async editAccountNameViaName(oldName, newName) {
        await this.openAccountViaName(oldName);

        // Wait for form to show and input to be editable
        await this.accountNameInput.waitFor({ state: 'visible' });
        await this.accountNameInput.fill(newName);

        // Expect unsaved banner to appear
        await expect(this.unsavedChangesBanner).toBeVisible();

        // Save changes
        await expect(this.saveChangesButton).toBeEnabled();
        await this.saveChangesButton.click();

        // Wait for unsaved banner to disappear (assuming save completes in-place)
        await expect(this.unsavedChangesBanner).not.toBeVisible();

        // Optionally: verify that the name input reflects the new name still
        const currentName = await this.accountNameInput.inputValue();
        if (currentName.trim() !== newName.trim()) {
            throw new Error(`Expected account name to persist as "${newName}" but found "${currentName}"`);
        }

        return true;
    }

    async verifyAllSort(){
        await this.goToAccountPage();
        await SortUtils.verifyColumnSorting(this.page, 'Name', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Slug', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Status', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Created', 'relative', false);

        await SortUtils.verifyColumnSorting(this.page, 'Name', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Slug', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Status', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Created', 'relative', true);
    }

    /*
    * Way 1: Open account by clicking its name/span (or parent button)
    */
    async openAccountViaName(accountName) {
        const row = await this.getRowByName(accountName);
        // Prefer the clickable wrapper with role=button near the name
        const nameButton = row.locator('div[role="button"]', { hasText: accountName });
        if (await nameButton.count()) {
            await nameButton.click();
        } else {
            // fallback to clicking the span itself
            await row.locator('span', { hasText: accountName }).click();
        }
    }

    /*
     * Way 2: Open action dropdown and select an action by visible label
     * actionName examples: 'Edit Account', 'Deactivate', 'Delete'
     */
    async openAccountAction(accountName, actionName) {
        const row = await this.getRowByName(accountName);

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
                throw new Error('Could not find action dropdown trigger for account row');
            }
        }

        // Wait for menu and click the desired action
        const menuItem = this.page.locator('div[role="menuitem"]', { hasText: actionName }).first();
        await menuItem.waitFor({ state: 'visible' });
        await menuItem.click();
    }

    // Convenience wrapper for editing via the dropdown
    async editAccountViaAction(accountName) {
        await this.openAccountAction(accountName, 'Edit Account');
    }

    /*
    ########################################################
    ################ Deactivate Account ####################
    ########################################################
    */
    async deactivateAccount(accountName) {
        await this.openAccountAction(accountName, 'Deactivate');

        // Handle deactivate dialog using utility
        await DialogUtils.handleDeactivateDialog(this.page, accountName);

        await this.goToAccountPage();
        // Verify the account status has changed to "Inactive" or similar
        const row = await this.getRowByName(accountName);
        const statusCell = row.locator('td').nth(2); // Status column (3rd column, 0-indexed)
        await expect(statusCell).toContainText('Inactive');

        return true;
    }

    /*
    ########################################################
    ################ Delete Account #########################
    ########################################################
    */
    async deleteAccount(accountName) {
        await this.openAccountAction(accountName, 'Delete');

        // Handle delete dialog using utility
        await DialogUtils.handleDeleteDialog(this.page);

        await this.goToAccountPage();
        // Verify the account has been removed from the table
        // Use a more direct approach to check if the row exists
        const row = this.tableRows.filter({ hasText: accountName }).first();
        await expect(row).not.toBeVisible();

        return true;
    }

    /*
    ########################################################
    ################ Cancel Dialog Operations ##############
    ########################################################
    */
    async cancelDeactivateAccount(accountName) {
        await this.openAccountAction(accountName, 'Deactivate');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the account is still in the table and status hasn't changed
        const row = await this.getRowByName(accountName);
        await expect(row).toBeVisible();

        return true;
    }

    async cancelDeleteAccount(accountName) {
        await this.openAccountAction(accountName, 'Delete');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the account is still in the table
        const row = await this.getRowByName(accountName);
        await expect(row).toBeVisible();

        return true;
    }

    async getRowByName(accountName) {
        await this.goToAccountPage();
        console.log(this.tableRows)
        const row = this.tableRows.filter({ hasText: accountName }).first();
        if (!(await row.count())) {
            throw new Error(`Account row with name "${accountName}" not found`);
        }
        return row;
    }

}

module.exports = { AccountPage };
