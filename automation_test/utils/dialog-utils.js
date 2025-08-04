const { expect } = require('@playwright/test');

class DialogUtils {
    /**
     * Handle deactivate dialog with account-specific verification
     * @param {Object} page - Playwright page object
     * @param {string} accountName - Name of the account to deactivate
     * @returns {Promise<boolean>} - True if successful
     */
    static async handleDeactivateDialog(page, accountName) {
        const dialogContent = page.locator('[role="alertdialog"]');
        const dialogTitle = page.locator('[data-melt-dialog-title]');
        const dialogDescription = page.locator('[data-melt-dialog-description]');

        // Wait for dialog to appear
        await dialogContent.waitFor({ state: 'visible' });

        // Verify dialog appears and has content
        await expect(dialogTitle).toBeVisible();
        await expect(dialogDescription).toBeVisible();
        await expect(dialogDescription).toContainText(accountName);

        // Click the Deactivate button in the dialog
        const deactivateButton = page.locator('button:has-text("Deactivate")');
        await deactivateButton.click();

        // Wait for dialog to disappear
        await expect(dialogContent).not.toBeVisible();

        return true;
    }

    /**
     * Handle delete dialog with generic verification
     * @param {Object} page - Playwright page object
     * @returns {Promise<boolean>} - True if successful
     */
    static async handleDeleteDialog(page) {
        const dialogContent = page.locator('[role="alertdialog"]');
        const dialogTitle = page.locator('[data-melt-dialog-title]');
        const dialogDescription = page.locator('[data-melt-dialog-description]');

        // Wait for dialog to appear
        await dialogContent.waitFor({ state: 'visible' });

        // Verify dialog appears and has content
        await expect(dialogTitle).toBeVisible();
        await expect(dialogDescription).toBeVisible();

        // Click the Delete button in the dialog
        const deleteButton = page.locator('button:has-text("Delete")');
        await deleteButton.click();

        // Wait for dialog to disappear
        await expect(dialogContent).not.toBeVisible();

        return true;
    }

    /**
     * Handle cancel dialog operation (works for both deactivate and delete)
     * @param {Object} page - Playwright page object
     * @returns {Promise<boolean>} - True if successful
     */
    static async handleCancelDialog(page) {
        const dialogContent = page.locator('[role="alertdialog"]');
        const dialogTitle = page.locator('[data-melt-dialog-title]');
        const dialogDescription = page.locator('[data-melt-dialog-description]');

        // Wait for dialog to appear
        await dialogContent.waitFor({ state: 'visible' });

        // Verify dialog appears
        await expect(dialogTitle).toBeVisible();
        await expect(dialogDescription).toBeVisible();

        // Click the Cancel button in the dialog
        const cancelButton = page.locator('button:has-text("Cancel")');
        await cancelButton.click();

        // Wait for dialog to disappear
        await expect(dialogContent).not.toBeVisible();

        return true;
    }

    /**
     * Generic dialog handler for any action
     * @param {Object} page - Playwright page object
     * @param {string} actionText - Text of the action button to click
     * @param {Object} options - Additional options
     * @param {boolean} options.verifyAccountName - Whether to verify account name in description
     * @param {string} options.accountName - Account name to verify (if verifyAccountName is true)
     * @returns {Promise<boolean>} - True if successful
     */
    static async handleGenericDialog(page, actionText, options = {}) {
        const dialogContent = page.locator('[role="alertdialog"]');
        const dialogTitle = page.locator('[data-melt-dialog-title]');
        const dialogDescription = page.locator('[data-melt-dialog-description]');

        // Wait for dialog to appear
        await dialogContent.waitFor({ state: 'visible' });

        // Verify dialog appears
        await expect(dialogTitle).toBeVisible();
        await expect(dialogDescription).toBeVisible();

        // Verify account name if requested
        if (options.verifyAccountName && options.accountName) {
            await expect(dialogDescription).toContainText(options.accountName);
        }

        // Click the action button in the dialog
        const actionButton = page.locator(`button:has-text("${actionText}")`);
        await actionButton.click();

        // Wait for dialog to disappear
        await expect(dialogContent).not.toBeVisible();

        return true;
    }

    /**
     * Verify dialog appears without taking any action
     * @param {Object} page - Playwright page object
     * @param {Object} options - Additional options
     * @param {boolean} options.verifyAccountName - Whether to verify account name in description
     * @param {string} options.accountName - Account name to verify (if verifyAccountName is true)
     * @returns {Promise<boolean>} - True if dialog appears correctly
     */
    static async verifyDialogAppears(page, options = {}) {
        const dialogContent = page.locator('[role="alertdialog"]');
        const dialogTitle = page.locator('[data-melt-dialog-title]');
        const dialogDescription = page.locator('[data-melt-dialog-description]');

        // Wait for dialog to appear
        await dialogContent.waitFor({ state: 'visible' });

        // Verify dialog appears
        await expect(dialogTitle).toBeVisible();
        await expect(dialogDescription).toBeVisible();

        // Verify account name if requested
        if (options.verifyAccountName && options.accountName) {
            await expect(dialogDescription).toContainText(options.accountName);
        }

        return true;
    }
}

module.exports = DialogUtils; 