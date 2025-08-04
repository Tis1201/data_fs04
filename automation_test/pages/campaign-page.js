const { expect } = require('@playwright/test');
const config = require('../config/config-loader');
const BasePage = require('./base-page');
const SortValidator = require('../utils/sort-validator');

class CampaignPage extends BasePage {
    constructor(page) {
        super(page);
        this.page = page;

        this.sortValidator = new SortValidator(page);
        this.createCampaignButton = this.page.locator('button:has-text("Create Campaign")');
        this.createCampaignDialog = this.page.locator('app-create-campaign');
        this.campaignNameInput = this.page.locator('input[formcontrolname="campaignName"]');
        this.presentationsInput = this.page.locator('input[placeholder="Add a presentation"]');
        this.autocompletePanel = this.page.locator('.mat-mdc-autocomplete-panel');
        this.autocompleteOptions = this.page.locator('.mat-mdc-autocomplete-panel mat-option');
        this.tagInput = this.page.locator('input[placeholder="Add a tag"]');
        this.createButton = this.page.locator('mat-dialog-actions button:has-text("Create")');
        this.campaignSuccessPopup = this.page.locator('simple-snack-bar', { hasText: 'Campaign added' });
        this.searchInput = this.page.locator('.search-section input.search-input');
        this.campaignDeletedSuccessPopup = this.page.locator('simple-snack-bar', { hasText: 'Campaign deleted' });
        this.campaignEditButton = this.page.locator('button:has-text("Edit")');
    }

    async goToCampaignPage() {
        await this.page.goto("http://localhost:5173/admin/dashboard");
        await this.page.waitForLoadState('networkidle');
    }

    async searchForCampaign(searchTerm) {
        await this.searchForItem({
            searchTerm,
            resourceType: 'campaigns'
        });
    }

    async verifyCampaignExists(name, index) {
        // Navigate to campaign page if not already there
        if (!this.page.url().includes(config.pageURL.campaign.url)) {
            await this.goToCampaignPage();
        }

        // Search for the campaign by name
        await this.searchForCampaign(name);

        // If index is specified, check for a specific occurrence
        if (index !== undefined) {
            const campaignRows = await this.itemRowByName(name).all();
            return campaignRows.length > index ? await campaignRows[index].isVisible() : false;
        }

        // Otherwise, check if any campaign with this name exists
        return await this.itemRowByName(name).first().isVisible();
    }

    async createCampaign(name, presentation, tags = []) {
        // Navigate to playlist page if not already there
        if (!this.page.url().includes(config.pageURL.campaign.url)) {
            await this.goToCampaignPage();
        }

        // Click the Create Playlist button
        await this.createCampaignButton.click();

        // Wait for the dialog to appear
        await this.createCampaignDialog.waitFor();

        // Enter campaign name
        await this.campaignNameInput.fill(name);

        // Clear existing text in the input
        await this.presentationsInput.clear();

        // Type the presentation name
        await this.presentationsInput.fill(presentation);

        // Wait a moment for the autocomplete to populate
        await this.page.waitForTimeout(500);

        // Check if autocomplete panel appears
        const autocompleteVisible = await this.autocompletePanel.isVisible();

        if (autocompleteVisible) {
            // Wait for autocomplete options to load
            await this.autocompleteOptions.first().waitFor();

            // Find and click the matching option
            const optionLocator = this.autocompleteOptionByText(presentation);
            if (await optionLocator.count() > 0) {
                await optionLocator.first().click();
            } else {
                // If no exact match, just press Enter
                await this.presentationsInput.press('Enter');
            }
        } else {
            // No autocomplete appeared, just press Enter
            await this.presentationsInput.press('Enter');
        }

        // Wait for the chip to be created
        await this.page.waitForTimeout(300);

        // Add tags if provided
        if (tags.length > 0) {
            for (const tag of tags) {
                // Clear existing text in the input
                await this.tagInput.clear();

                // Type the tag name
                await this.tagInput.fill(tag);

                // Wait a moment for the autocomplete to populate
                await this.page.waitForTimeout(500);

                // Check if autocomplete panel appears
                const autocompleteVisible = await this.autocompletePanel.isVisible();

                if (autocompleteVisible) {
                    // Wait for autocomplete options to load
                    await this.autocompleteOptions.first().waitFor();

                    // Find and click the matching option
                    const optionLocator = this.autocompleteOptionByText(tag);
                    if (await optionLocator.count() > 0) {
                        await optionLocator.first().click();
                    } else {
                        // If no exact match, just press Enter
                        await this.tagInput.press('Enter');
                    }
                } else {
                    // No autocomplete appeared, just press Enter
                    await this.tagInput.press('Enter');
                }

                // Wait for the chip to be created
                await this.page.waitForTimeout(300);
            }
        }

        // Click the Create campaign button (note it might be disabled initially but should be enabled after required fields are filled) 
        // and verify the API response
        const { createdDate } = await this.performActionAndVerifyResponse({
            actionPromise: this.createButton.click(),
            apiUrl: `${config.apiBaseURL}/campaigns`,
            statusCode: 201
        });

        // Wait for the dialog to disappear, indicating the save was successful
        await this.createCampaignDialog.waitFor({ state: 'detached' });

        // Wait for the capain success popup to appear
        await this.campaignSuccessPopup.waitFor();

        await this.verifyCampaignExists(name);

        await this.page.waitForTimeout(500);

        return createdDate;
    }

    async deleteCampaign(name) {
        // Navigate to campaign page if not already there
        if (!this.page.url().includes(config.pageURL.campaign.url)) {
            await this.goToCampaignPage();
        }

        // Clear the search input
        await this.searchInput.clear();
        await this.page.waitForTimeout(500);

        // Search for the campaign by name
        await this.searchForCampaign(name);

        await this.clickItemKebabMenu(name);

        // Click on "Delete" or equivalent option in the menu
        await this.deleteAction.click();
        
        // Wait for the confirmation dialog to appear and click the Delete button
        await this.confirmDeleteButton.waitFor();
        await this.confirmDeleteButton.click();

        // Expect for the delete success popup to appear
        await expect(this.campaignDeletedSuccessPopup).toBeVisible();

        await this.page.waitForTimeout(500);
    }

    async editCampaignName({name, needSearch = true, createdDate}) {
        // Navigate to campaign page if not already there
        if (!this.page.url().includes(config.pageURL.campaign.url)) {
            await this.goToCampaignPage();
        }
        
        // Search for the campaign by name
        if (needSearch) {
            await this.searchForCampaign(name);
        }

        await this.clickEditAction(name);

        // Input new name
        const newName = "new_" + name;
        await this.campaignNameInput.fill(newName);

        // Click the Save button and verify the API response
        await this.performActionAndVerifyResponse({
            actionPromise: this.campaignEditButton.click(),
            apiUrl: 'campaigns?filter',
            statusCode: 200,
            expectedCreatedDate: createdDate
        });
        
        // Wait for the operation to complete
        await this.page.waitForLoadState('networkidle');

        // Use the search functionality to find the newly edited campaign
        await this.verifyCampaignExists(newName);

        await this.page.waitForTimeout(500);
    }

    async verifyAllSortingOptions() {
      // Make sure we're on the campaign page
      if (!this.page.url().includes(config.pageURL.campaign.url)) {
        await this.goToCampaignPage();
      }

      // Clear any search filter to ensure we have enough data to test sorting
      await this.searchInput.clear();
      await this.page.waitForTimeout(500);

      // Define column configurations for sorting validation
      const columns = {
        name: {
          fieldName: 'name',
        },
        createdDate: {
          fieldName: 'createdDate',
          isDate: true,
        },
        updatedDate: {
          fieldName: 'updatedDate',
          isDate: true,
        },
      };

      // Use the generic sort validator
      return await this.sortValidator.verifyAllSortingOptions({
        apiEndpoint: 'campaigns',
        columns,
      });
    }

    async verifyCampaignMetadata() {
        // This calls the parent class method with campaign-specific parameters
        return await this.verifyListItemMetadata(
            config.pageURL.campaign.url,
            'campaigns?filter'
        );
    }
}

module.exports = CampaignPage;
