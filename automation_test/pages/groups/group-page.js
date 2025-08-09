const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const BasePage = require('../base-page');
const SortUtils = require('../../utils/sort-utils');
const DialogUtils = require('../../utils/dialog-utils');

class GroupPage extends BasePage {
    constructor(page) {
        super(page);
        this.page = page;

        this.tableRows = page.locator('table tbody tr');

        // Page locators
        this.groupListName = page.locator('text=Groups');
        this.addGroupButton = page.locator('button:has-text("Add Group")');

        // Form fields
        this.groupNameInput = page.locator('input#name[type="text"]');
        this.accountSelect = page.locator('button[role="combobox"]');
        this.descriptionTextarea = page.locator('textarea#description[placeholder="Enter group description"]');
        this.permissionsTextarea = page.locator('textarea#permissions[placeholder="Enter permissions as a valid JSON object"]');

        // Save buttons
        this.saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")');
        this.saveChangesButton = page.locator('button:has-text("Save")');
        this.cancelButton = page.locator('button:has-text("Cancel")');

        // Unsaved changes indicator
        this.unsavedChangesBanner = page.locator('text=You have unsaved changes');
    }

    async goToGroupPage() {
        await this.page.goto(config.pageURL.groups.url);
        await this.groupListName.waitFor({ state: 'visible' });
        await this.addGroupButton.waitFor({ state: 'visible' });
    }

    /*
    ########################################################
    ################ Create Group ###########################
    ########################################################
    */
    async createGroup(groupName, accountName, options = {}) {
        await this.goToGroupPage();

        await expect(this.addGroupButton).toBeEnabled();
        await this.addGroupButton.click();

        // Fill required fields
        await this.groupNameInput.waitFor({ state: 'visible' });
        await this.groupNameInput.fill(groupName);

        // Select account if provided
        if (accountName) {
            await this.accountSelect.click();
            // Wait for options to appear and select the first available option
            const accountOptions = this.page.locator('div[role="option"]');
            await accountOptions.first().waitFor({ state: 'visible' });
            await accountOptions.first().click();
        }

        // Fill optional fields
        if (options.description) {
            await this.descriptionTextarea.fill(options.description);
        }

        if (options.permissions) {
            await this.permissionsTextarea.fill(options.permissions);
        }

        await this.saveButton.click();

        // Verify group was created
        await this.tableRows.first().waitFor({ state: 'visible' });
        const newGroupLocator = this.page.locator(`table td >> text="${groupName}"`);
        await expect(newGroupLocator).toBeVisible();
        return true;
    }

    /*
    ########################################################
    ################ Edit Group #############################
    ########################################################
    */
    async editGroupNameViaName(oldName, newName) {
        await this.openGroupViaName(oldName);

        // Wait for form to show and name input to be editable
        const nameInput = this.page.locator('input#name[name="name"]');
        await nameInput.waitFor({ state: 'visible' });
        await nameInput.fill(newName);

        // Save changes (no unsaved banner in group edit)
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();

        // Wait for page to redirect back to group list
        await this.groupListName.waitFor({ state: 'visible' });

        // Verify the group name was updated by checking the table
        const row = await this.getRowByName(newName);
        await expect(row).toBeVisible();

        return true;
    }

    async verifyAllSort() {
        await this.goToGroupPage();
        await SortUtils.verifyColumnSorting(this.page, 'Name', 'text', false);
        await SortUtils.verifyColumnSorting(this.page, 'Created', 'relative', false);

        await SortUtils.verifyColumnSorting(this.page, 'Name', 'text', true);
        await SortUtils.verifyColumnSorting(this.page, 'Created', 'relative', true);
    }

    /*
    * Way 1: Open group by clicking its name/span (or parent button)
    */
    async openGroupViaName(groupName) {
        const row = await this.getRowByName(groupName);
        // Prefer the clickable wrapper with role=button near the name
        const nameButton = row.locator('div[role="button"]', { hasText: groupName });
        if (await nameButton.count()) {
            await nameButton.click();
        } else {
            // fallback to clicking the span itself
            await row.locator('span', { hasText: groupName }).click();
        }
    }

    /*
     * Way 2: Open action dropdown and select an action by visible label
     * actionName examples: 'Edit Group', 'Deactivate', 'Delete'
     */
    async openGroupAction(groupName, actionName) {
        const row = await this.getRowByName(groupName);

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
                throw new Error('Could not find action dropdown trigger for group row');
            }
        }

        // Wait for menu and click the desired action
        const menuItem = this.page.locator('div[role="menuitem"]', { hasText: actionName }).first();
        await menuItem.waitFor({ state: 'visible' });
        await menuItem.click();
    }

    // Convenience wrapper for editing via the dropdown
    async editGroupViaAction(groupName) {
        await this.openGroupAction(groupName, 'Edit Group');
    }

    /*
    ########################################################
    ################ Delete Group ###########################
    ########################################################
    */
    async deleteGroup(groupName) {
        await this.openGroupAction(groupName, 'Delete');

        // Handle delete dialog using utility
        await DialogUtils.handleDeleteDialog(this.page);

        // Verify the group has been removed from the table
        // Use a more direct approach to check if the row exists
        const row = this.tableRows.filter({ hasText: groupName }).first();
        await expect(row).not.toBeVisible();

        return true;
    }

    /*
    ########################################################
    ################ Cancel Dialog Operations ##############
    ########################################################
    */
    async cancelDeleteGroup(groupName) {
        await this.openGroupAction(groupName, 'Delete');

        // Handle cancel dialog using utility
        await DialogUtils.handleCancelDialog(this.page);

        // Verify the group is still in the table
        const row = await this.getRowByName(groupName);
        await expect(row).toBeVisible();

        return true;
    }

    async getRowByName(groupName) {
        await this.goToGroupPage();
        const row = this.tableRows.filter({ hasText: groupName }).first();
        if (!(await row.count())) {
            throw new Error(`Group row with name "${groupName}" not found`);
        }
        return row;
    }
}

module.exports = { GroupPage }; 