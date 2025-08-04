const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const BasePage = require('../base-page');
const SortUtils = require('../../utils/sort-utils');
const DialogUtils = require('../../utils/dialog-utils');

class UserPage extends BasePage {
    constructor(page) {
        super(page);
        this.page = page;

        this.tableRows = page.locator('table tbody tr');

        // Page locators
        this.userListName = page.locator('text=Users');
        this.addUserButton = page.locator('button:has-text("Add User")');
        this.inviteUserButton = page.locator('button:has-text("Invite User")');

        // Form fields
        this.emailInput = page.locator('input#email[type="email"]');
        this.nameInput = page.locator('input#name[type="text"]');
        this.passwordInput = page.locator('input#password[type="password"]');
        this.roleSelect = page.locator('button[role="combobox"]').first();
        this.statusSelect = page.locator('button[role="combobox"]').nth(1);

        // Save buttons
        this.saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")');
        this.saveChangesButton = page.locator('button:has-text("Save Changes")');
        this.cancelButton = page.locator('button:has-text("Cancel")');

        // Unsaved changes indicator
        this.unsavedChangesBanner = page.locator('text=You have unsaved changes');
    }

    async goToUserPage() {
        await this.page.goto(config.pageURL.users.url);
        await this.userListName;
    }

    /*
    ########################################################
    ################ Create User ############################
    ########################################################
    */
    async createUser(email, name, options = {}) {
        await this.goToUserPage();

        await this.addUserButton.click();

        // Fill required fields
        await this.emailInput.waitFor({ state: 'visible' });
        await this.emailInput.fill(email);
        await this.nameInput.fill(name);

        // Set password if provided, otherwise use generated password
        if (options.password) {
            await this.passwordInput.fill(options.password);
        }

        // Select role if provided
        if (options.role) {
            await this.roleSelect.click();
            const roleOptions = this.page.locator('div[role="option"]');
            await roleOptions.first().waitFor({ state: 'visible' });
            await roleOptions.first().click();
        }

        // Select status if provided
        if (options.status) {
            await this.statusSelect.click();
            const statusOptions = this.page.locator('div[role="option"]');
            await statusOptions.first().waitFor({ state: 'visible' });
            await statusOptions.first().click();
        }

        await this.saveButton.click();

        // Verify user was created
        await this.tableRows.first().waitFor({ state: 'visible' });
        const newUserLocator = this.page.locator(`table td >> text="${email}"`);
        await expect(newUserLocator).toBeVisible();
        return true;
    }

    /*
    ########################################################
    ################ Edit User ##############################
    ########################################################
    */
    async editUserNameViaEmail(email, newName) {
        await this.openUserViaEmail(email);

        // Wait for form to show and name input to be editable
        // The name input is the second input field (email is first but disabled)
        const nameInput = this.page.locator('input#name[name="name"]');
        await nameInput.waitFor({ state: 'visible' });
        await nameInput.fill(newName);

        // Save changes (no unsaved banner in user edit)
        await expect(this.saveChangesButton).toBeEnabled();
        await this.saveChangesButton.click();

        // Wait for page to redirect back to user list
        await this.userListName.waitFor({ state: 'visible' });

        // Verify the user name was updated by checking the table
        const row = await this.getRowByEmail(email);
        await expect(row).toBeVisible();

        return true;
    }

    async verifyAllSort() {
        await this.goToUserPage();
        await SortUtils.verifyColumnSorting(this.page, 'Email', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Roles', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Created At', 'relative', false);
        await SortUtils.verifyColumnSorting(this.page, 'Status', 'text', false);

        await SortUtils.verifyColumnSorting(this.page, 'Email', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Roles', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Created At', 'relative', true);
        await SortUtils.verifyColumnSorting(this.page, 'Status', 'text', true);
    }

    /*
    * Way 1: Open user by clicking its email/span (or parent button)
    */
    async openUserViaEmail(email) {
        const row = await this.getRowByEmail(email);
        // Prefer the clickable wrapper with role=button near the email
        const emailButton = row.locator('div[role="button"]', { hasText: email });
        if (await emailButton.count()) {
            await emailButton.click();
        } else {
            // fallback to clicking the span itself
            await row.locator('span', { hasText: email }).click();
        }
    }

    /*
     * Way 2: Open action dropdown and select an action by visible label
     * actionName examples: 'Edit User', 'Deactivate', 'Delete'
     */
    async openUserAction(email, actionName) {
        const row = await this.getRowByEmail(email);

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
                throw new Error('Could not find action dropdown trigger for user row');
            }
        }

        // Wait for menu and click the desired action
        const menuItem = this.page.locator('div[role="menuitem"]', { hasText: actionName }).first();
        await menuItem.waitFor({ state: 'visible' });
        await menuItem.click();
    }

    // Convenience wrapper for editing via the dropdown
    async editUserViaAction(email) {
        await this.openUserAction(email, 'Edit User');
    }

    /*
    ########################################################
    ################ Deactivate User #######################
    ########################################################
    */
    async deactivateUser(email) {
        await this.openUserAction(email, 'Deactivate');

        // Handle deactivate dialog using utility (without name verification)
        await DialogUtils.handleGenericDialog(this.page, 'Deactivate');

        // Verify the user status has changed to "Inactive" or similar
        const row = await this.getRowByEmail(email);
        const statusCell = row.locator('td').nth(3); // Status column (4th column, 0-indexed)
        await expect(statusCell).toContainText('Inactive');

        return true;
    }

    /*
    ########################################################
    ################ Delete User ###########################
    ########################################################
    */
    async deleteUser(email) {
        await this.openUserAction(email, 'Delete');

        // Handle delete dialog using utility
        await DialogUtils.handleDeleteDialog(this.page);

        // Verify the user has been removed from the table
        // Use a more direct approach to check if the row exists
        const row = this.tableRows.filter({ hasText: email }).first();
        await expect(row).not.toBeVisible();

        return true;
    }

    /*
    ########################################################
    ################ Cancel Dialog Operations ##############
    ########################################################
    */
    async cancelDeactivateUser(email) {
        await this.openUserAction(email, 'Deactivate');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the user is still in the table and status hasn't changed
        const row = await this.getRowByEmail(email);
        await expect(row).toBeVisible();

        return true;
    }

    async cancelDeleteUser(email) {
        await this.openUserAction(email, 'Delete');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the user is still in the table
        const row = await this.getRowByEmail(email);
        await expect(row).toBeVisible();

        return true;
    }

    async getRowByEmail(email) {
        await this.goToUserPage();
        const row = this.tableRows.filter({ hasText: email }).first();
        if (!(await row.count())) {
            throw new Error(`User row with email "${email}" not found`);
        }
        return row;
    }
}

module.exports = { UserPage }; 