const { expect } = require('@playwright/test');

/**
 * Creates a new tag with the given name
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} tagName - Name of the tag to create
 * @returns {Promise<void>}
 */
async function createTag(page, tagName) {
  // Navigate to the tag page
  await page.goto(config.pageURL.tag.url);
  await page.waitForLoadState('networkidle');
  
  // Click the Create Tag button
  await page.locator('button:has-text("Create Tag")').click();
  
  // Wait for dialog to appear
  const dialog = page.locator('app-create-tag');
  await expect(dialog).toBeVisible();
  
  // Input the tag name
  await page.locator('input[formcontrolname="tagName"]').fill(tagName);
  
  // Wait for the Save button to be enabled and click it
  const saveButton = dialog.locator('mat-dialog-actions button:has-text("Save")');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  
  // Wait for the dialog to close
  await expect(dialog).not.toBeVisible();
  
  console.log(`Successfully created tag: ${tagName}`);
}

/**
 * Deletes a tag with the given name
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} tagName - Name of the tag to delete
 * @returns {Promise<void>}
 */
async function deleteTag(page, tagName) {
  // Navigate to the tag page
  await page.goto(config.pageURL.tag.url);
  await page.waitForLoadState('networkidle');
  
  // Search for the tag
  await page.locator('.search-input').fill(tagName);
  
  // Wait for search results to appear
  await page.waitForTimeout(2000);
  
  // Find and click the ellipsis button in the row containing our tag
  const tagRow = page.locator(`tr:has-text("${tagName}")`);
  await expect(tagRow).toBeVisible();
  
  // Click the ellipsis menu button
  await tagRow.locator('button.mat-mdc-menu-trigger').click();
  
  // Wait for menu to be visible
  await page.waitForSelector('.mat-mdc-menu-content button', { state: 'visible' });
  
  // Click the Delete button in the menu
  await page.locator('.mat-mdc-menu-content button:has-text("Delete")').first().click();
  
  // Wait for the delete confirmation dialog to appear
  const confirmationDialog = page.locator('app-tag-confirmation');
  await expect(confirmationDialog).toBeVisible();
  
  // Click the Delete button in the confirmation dialog
  await confirmationDialog.locator('button.mat-primary:has-text("Delete")').click();
  
  // Wait for the dialog to close
  await expect(confirmationDialog).not.toBeVisible();
  
  console.log(`Successfully deleted tag: ${tagName}`);
}

/**
 * Creates an asset with a given tag
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} assetName - Name of the asset to create
 * @param {string} tagName - Name of the tag to apply to the asset
 * @returns {Promise<void>}
 */
async function createAssetWithTag(page, assetName, tagName) {
  // Implementation for creating an asset with the tag
  // This is a placeholder - you'd need to implement the actual asset creation steps
  console.log(`Creating asset "${assetName}" with tag "${tagName}"`);
}

/**
 * Deletes an asset
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} assetName - Name of the asset to delete
 * @returns {Promise<void>}
 */
async function deleteAsset(page, assetName) {
  // Implementation for deleting an asset
  // This is a placeholder - you'd need to implement the actual asset deletion steps
  console.log(`Deleting asset "${assetName}"`);
}

module.exports = {
  createTag,
  deleteTag,
  createAssetWithTag,
  deleteAsset
}; 