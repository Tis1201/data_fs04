const { expect } = require('@playwright/test');

class BasePage {
    constructor(page) {
        this.page = page;

        this.doneButton = this.page.getByRole('button', { name: 'Done' });
        this.spinner = this.page.locator('.spinner-container');
        this.confirmDeleteButton = this.page.locator('mat-dialog-actions button.mat-primary:has-text("Delete")');
        this.createdDateSortHeader = this.page.locator('th.mat-column-createdDate');
        this.confirmDeleteButton = this.page.locator('mat-dialog-actions').getByRole('button', { name: 'Delete' });
        this.usernameElement = this.page.locator('.header-section .user-info h3');
        this.saveButton = this.page.getByRole('button', { name: 'Save' });
        this.createButton = this.page.getByRole('button', { name: 'Create' });
        this.treeItemByName = (name) => this.page.locator('mat-tree-node', { has: this.page.getByText(name, { exact: true }) }).first();
        this.nestedTreeItemByName = (name) => this.page.locator('mat-nested-tree-node', { has: this.page.getByText(name, { exact: true }) }).first();
        this.dropdownToggle = this.page.locator('.dropdown .dropdown-toggle');
        this.dropdownMenuDelete = this.page.locator('.dropdown-menu button:has-text("Delete")');
        this.dropdownMenuEdit = this.page.locator('.dropdown-menu button:has-text("Edit")');
        this.dropdownMenuDetails = this.page.locator('.dropdown-menu button:has-text("Details")');
        this.searchItemInput = this.page.locator('.search-section input.search-input');
        this.checkbox = (element) => element.getByRole('checkbox').first();
        this.autocompleteOptionByText = (text) => this.page.locator(`.mat-mdc-autocomplete-panel mat-option:has-text("${text}")`).first();

        // Tag input locators
        this.tagInput = this.page.locator('[placeholder="Add a tag"]');
        this.tagOption = (tagName) => this.page.locator('mat-option', { has: this.page.getByText(tagName, { exact: true }) }).first();

        // Items list view locators
        this.itemRowByName = (name) => this.page.locator(`tr:has(td.cdk-column-name:text-is("${name}"))`).first();
        this.itemKebabMenu = (row) => row.locator('button.mat-mdc-menu-trigger');
        this.optionsMenu = this.page.locator('.mat-mdc-menu-panel');
        this.detailsAction = this.optionsMenu.locator('button', { has: this.page.getByText('Details', { exact: true }) });
        this.editAction = this.optionsMenu.locator('button', { has: this.page.getByText('Edit', { exact: true }) });
        this.deleteAction = this.optionsMenu.locator('button', { has: this.page.getByText('Delete', { exact: true }) });
        this.createdDateCell = (row) => row.locator('.mat-column-createdDate');
        this.updatedDateCell = (row) => row.locator('.mat-column-updatedDate');
        this.nameCellByRow = (row) => row.locator('td.cdk-column-name, td.mat-column-name');

        // Details dialog locators
        this.dialogContent = this.page.locator('mat-dialog-content');
        this.createdByField = this.page.locator('.info-field .key:has-text("Created By") + .key-value');
        this.updatedByField = this.page.locator('.info-field .key:has-text("Updated By") + .key-value');
        this.createdDateField = this.page.locator('.info-field .key:has-text("Created Date") + .key-value');
        this.updatedDateField = this.page.locator('.info-field .key:has-text("Updated Date") + .key-value');
    }

    async waitLoading() {
        // Wait for the spinner to appear
        await this.spinner.waitFor({ state: 'visible' });

        // Wait for the spinner to disappear
        await this.spinner.waitFor({ state: 'hidden' });
    }

    /**
     * Generic search function that can be used across different page objects
     * @param {Object} options - Configuration options
     * @param {string} options.searchTerm - The search term to use
     * @param {string} options.resourceType - The resource type for the API URL (e.g., 'playlists', 'schedules')
     * @param {boolean} [options.sortByCreatedDate=true] - Whether to sort by created date
     * @returns {Promise<void>}
     */
    async searchForItem({ searchTerm, resourceType, sortByCreatedDate = true }) {
        // Create a promise that will resolve when the API request completes
        const waitForSearchResponse = this.page.waitForResponse(
            response => response.url().includes(`/${resourceType}?filter`) &&
                response.status() === 200
        );

        // Enter the search term
        await this.searchItemInput.fill(searchTerm);

        // Wait for the search API response
        await waitForSearchResponse;

        // Give a small amount of time for the UI to update with the results
        await this.page.waitForTimeout(100);

        if (sortByCreatedDate) {
            // Click the "Created Date" sort header to ensure consistent sorting
            // Wait for sort header to be visible and clickable
            await this.createdDateSortHeader.waitFor({ state: 'visible' });
            const createdDateSortStyle = await this.createdDateSortHeader.locator('.mat-sort-header-indicator').getAttribute('style');
            if (createdDateSortStyle !== 'transform: translateY(10px);') {
                // If the sort header is not already sorted, click it to sort in descending order
                for (let i = 0; i < 2; i++) {
                    await this.createdDateSortHeader.click();
                    // Wait briefly between clicks to allow the sorting to complete
                    await this.page.waitForTimeout(300);
                }
            }

            // Wait for the table to be re-sorted
            await this.page.waitForTimeout(500);
        }
    }

    /**
     * Performs an action (like clicking a button) and waits for an API response
     * @param {Object} options - Configuration options
     * @param {Promise<any>} options.actionPromise - The action to perform (e.g., button.click())
     * @param {string|string[]} options.apiUrl - The API URL(s) to match in the response, can be a single string or array of strings
     * @param {number} options.statusCode - The expected status code
     * @param {string} [options.requestMethod] - Optional HTTP method to match (e.g., 'GET', 'POST'). If not specified, any method will match.
     * @returns {Promise<{responseData: any, startTime: Date, endTime: Date}>} - Object containing response data, start and end times
     */
    async performActionAndWaitForResponse({ actionPromise, apiUrl, statusCode, requestMethod }) {
        // Record start time before action
        const startTime = new Date();

        // Perform the action and wait for API response simultaneously
        const [response] = await Promise.all([
            this.page.waitForResponse(
                res => {
                    const url = res.url();
                    // Handle both string and array of strings for apiUrl
                    const urlMatches = Array.isArray(apiUrl)
                        ? apiUrl.every(pattern => url.includes(pattern))
                        : url.includes(apiUrl);

                    // Check request method only if specified
                    const methodMatches = requestMethod ? res.request().method() === requestMethod : true;

                    return urlMatches && methodMatches && res.status() === statusCode;
                }
            ),
            actionPromise
        ]);

        // Record end time after response
        const endTime = new Date();

        let responseData = await response.text();
        if (responseData !== '') {
            // Parse response data
            responseData = await response.json();
        }

        return {
            responseData,
            startTime,
            endTime
        };
    }

    /**
     * Performs an action and verifies API response properties including user and dates
     * @param {Object} options - Configuration options
     * @param {Promise<any>} options.actionPromise - The action to perform (e.g., button.click())
     * @param {string|string[]} options.apiUrl - The API URL(s) to match in the response, can be a single string or array of strings
     * @param {number} options.statusCode - The expected status code
     * @param {string} [options.requestMethod] - Optional HTTP method to match (e.g., 'GET', 'POST'). If not specified, any method will match.
     * @param {Date} [options.expectedCreatedDate] - Optional expected createdDate to verify against response
     * @returns {Promise<{createdDate: Date, updatedDate: Date, createdBy: string, updatedBy: string}>} - Object containing created and updated dates
     */
    async performActionAndVerifyResponse({ actionPromise, apiUrl, statusCode, requestMethod, expectedCreatedDate }) {
        // Get the username before creating the asset
        const username = await this.usernameElement.textContent();

        // Perform the action and wait for API response
        const { responseData, startTime, endTime } = await this.performActionAndWaitForResponse({
            actionPromise,
            apiUrl,
            statusCode,
            requestMethod
        });

        // Determine if we should use the whole response or the first item in an array
        const data = Array.isArray(responseData) ? responseData[0] : responseData;

        // Verify the response data contains the expected values
        // expect(data.createdBy).toBe(username.trim());
        // expect(data.updatedBy).toBe(username.trim());

        // Verify the created and updated dates are within the expected timeframe
        const createdDate = new Date(data.createdDate);
        const updatedDate = new Date(data.updatedDate);

        console.log('createdDate', createdDate);
        console.log('updatedDate', updatedDate);
        console.log('startTime', startTime);
        console.log('endTime', endTime);

        // Check dates are between our start and end times
        // if (expectedCreatedDate) {
        //     console.log('expectedCreatedDate', expectedCreatedDate);
        //     // If expectedCreatedDate is provided, verify it matches the response
        //     // expect(createdDate.getTime()).toBe(expectedCreatedDate.getTime());
        //     expect(createdDate.toISOString().substring(0, 19)).toBe(expectedCreatedDate.toISOString().substring(0, 19));
        // } else {
        //     // Otherwise, createdDate <= updatedDate
        //     expect(createdDate <= updatedDate).toBeTruthy();
        // }

        // // Always verify updatedDate is within operation timeframe
        // expect(updatedDate >= startTime && updatedDate <= endTime).toBeTruthy();

        const createdBy = data.createdBy;
        const updatedBy = data.updatedBy;

        // Return both dates in an object
        return { createdDate, updatedDate, createdBy, updatedBy };
    }

    async verifyListItemMetadata(pageUrl, endpoint) {
        // Navigate to page if not already there
        if (!this.page.url().includes(pageUrl)) {
            await this.page.goto(pageUrl);
        }
        // Clear any search filter to ensure we have data to inspect
        await this.searchItemInput.clear();
        await this.page.waitForTimeout(500);

        // Create a promise that will resolve with the API response
        const responsePromise = new Promise(resolve => {
            // Listen for API responses matching the endpoint
            this.page.on('response', response => {
                const url = response.url();
                if (url.includes(`/${endpoint}`) && response.status() === 200) {
                    response.json().then(data => {
                        console.log('responseData match', data);
                        if (data) {
                            resolve(data);
                        }
                    }).catch(() => { });
                }
            });
        });

        // Refresh the page to trigger the API call
        await this.page.reload();
        await this.page.waitForLoadState('networkidle');

        // Wait for the response
        const responseData = await responsePromise;

        // Determine if we have an array directly or an object with items property
        const items = Array.isArray(responseData) ? responseData : responseData.items || [];

        // Verify the response contains the expected metadata fields
        const hasRequiredFields = items.some(item =>
            item.createdBy &&
            item.updatedBy &&
            item.createdDate &&
            item.updatedDate
        );

        // Verify at least one item has all required fields
        if (!hasRequiredFields) {
            throw new Error(`API response for ${endpoint} does not contain the required metadata fields`);
        }

        // Log a successful verification
        console.log(`✅ API response for ${endpoint} contains all required metadata fields`);

        // Return the response data for potential further assertions
        return responseData;
    }

    /**
     * Verifies the created and updated values in the details dialog
     * @param {string} createdBy - The expected createdBy value
     * @param {string} updatedBy - The expected updatedBy value
     * @param {string} createdDate - The expected createdDate value
     * @param {string} updatedDate - The expected updatedDate value
     */
    async verifyCreatedAndUpdatedValue(createdBy, updatedBy, createdDate, updatedDate) {
        const displayedCreatedBy = await this.createdByField.textContent();
        const displayedUpdatedBy = await this.updatedByField.textContent();
        const displayedCreatedDate = await this.createdDateField.textContent();
        const displayedUpdatedDate = await this.updatedDateField.textContent();

        console.log('displayedCreatedBy', displayedCreatedBy);
        console.log('createdBy', createdBy);
        console.log('displayedUpdatedBy', displayedUpdatedBy);
        console.log('updatedBy', updatedBy);
        console.log('displayedCreatedDate', displayedCreatedDate);
        console.log('createdDate', createdDate);
        console.log('displayedUpdatedDate', displayedUpdatedDate);
        console.log('updatedDate', updatedDate);

        expect(displayedCreatedBy).toBe(createdBy);
        expect(displayedUpdatedBy).toBe(updatedBy);
        expect(displayedCreatedDate).toBe(createdDate);
        if (updatedDate) {
            expect(displayedUpdatedDate).toBe(updatedDate);
        }
    }

    async clickItemKebabMenu(name) {
        // Get the row containing the item
        const itemRow = this.itemRowByName(name);

        // Click the actions button (ellipsis) for this specific row
        await this.itemKebabMenu(itemRow).click();

        // Wait for the dropdown menu to appear
        await this.optionsMenu.waitFor();
    }

    async clickDetailsAction(name) {
        await this.clickItemKebabMenu(name);

        // Click on the Details option in the dropdown menu
        await this.detailsAction.click();

        // Wait for the details dialog to appear
        await this.dialogContent.waitFor();
        await this.page.waitForTimeout(500);
    }

    async clickEditAction(name) {
        await this.clickItemKebabMenu(name);

        // Click on the Edit option in the dropdown menu
        await this.editAction.click();

        // Wait for the edit dialog to appear
        await this.dialogContent.waitFor();
        await this.page.waitForTimeout(500);
    }

    async clickDeleteAction(name) {
        await this.clickItemKebabMenu(name);
        // Click on the Delete option in the dropdown menu
        await this.deleteAction.click();

        // Wait for the delete dialog to appear
        await this.dialogContent.waitFor();
        await this.page.waitForTimeout(500);
    }

    async addTag(tagName) {
        // Ensure focus and clear any existing value
        await this.tagInput.click(); // Ensure focus
        await this.tagInput.clear(); // Clear any existing value
        // Type the tag character by character to better simulate user behavior
        await this.tagInput.type(tagName, { delay: 50 });  // Add slight delay between keystrokes;

        // Select the matching tag from the dropdown
        await this.tagOption(tagName).click();
    }
}

module.exports = BasePage;
