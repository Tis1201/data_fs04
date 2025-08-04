const { expect } = require('@playwright/test');

/**
 * Utility class for validating sorting functionality across different pages
 */
class SortValidator {
  /**
   * Create a new SortValidator
   * @param {Object} page - The Playwright page object
   */
  constructor(page) {
    this.page = page;

    this.sortHeadersByName = (columnName) => this.page.locator(`th.mat-column-${columnName}[mat-sort-header]`);
    this.columnCellsByName = (columnName) => this.page.locator(`td.mat-column-${columnName}`);
    this.activeSortHeader = this.page.locator('th[aria-sort="ascending"], th[aria-sort="descending"]');
  }

  /**
   * Clicks a sort header and waits for the API response
   * @param {Object} options - Options for the sort action
   * @param {Object} options.headerLocator - Locator for the sort header element
   * @param {string} options.apiEndpoint - API endpoint to wait for (e.g., 'campaigns', 'presentations')
   * @returns {Promise<Object>} - The API response data
   */
  async clickSortHeader({ headerLocator, apiEndpoint }) {
    // Wait for API response after clicking sort header and capture the response
    const response = await Promise.all([
      // Wait for the network request that fetches sorted data
      this.page.waitForResponse(
        (response) => response.url().includes(`/${apiEndpoint}?filter`) && response.status() === 200,
      ),
      // Click the sort header
      headerLocator.click(),
    ]).then(([response]) => response);

    // Additional short wait to ensure UI has updated
    await this.page.waitForTimeout(500);

    // Return the API response data
    return await response.json();
  }

  /**
   * Gets the current sort direction from an active sort header
   * @param {Object} sortHeaderLocator - Locator for active sort headers
   * @returns {Promise<string>} - The sort direction ('ascending', 'descending', or null)
   */
  async getSortDirection(sortHeaderLocator) {
    const ariaSort = await sortHeaderLocator.getAttribute('aria-sort');
    return ariaSort;
  }

  /**
   * Extract values from column cells in the UI
   * @param {Object} cellsLocator - Locator for the column cells
   * @returns {Promise<string[]>} - Array of text values
   */
  async getColumnValues(cellsLocator) {
    return await cellsLocator.allTextContents();
  }

  /**
   * Parse date strings to Date objects
   * @param {string[]} dateStrings - Array of date strings
   * @returns {Date[]} - Array of Date objects
   */
  parseDates(dateStrings) {
    return dateStrings
      .map((str) => str.trim())
      .map((str) => {
        const date = new Date(str);
        return isNaN(date.getTime()) ? null : date;
      })
      .filter((date) => date !== null);
  }

  /**
   * Check if an array is sorted in the specified direction
   * @param {Array} array - The array to check
   * @param {string} direction - 'ascending' or 'descending'
   * @param {boolean} isDate - Whether the array contains date strings
   * @returns {boolean} - True if the array is sorted correctly
   */
  isSorted(array, direction, isDate = false) {
    // Make a copy to avoid modifying the original array
    const sortedArray = [...array].map((val) => val.trim());
    console.log('Values to check for sorting:', sortedArray);

    if (isDate) {
      // Parse date strings if working with dates
      const dates = this.parseDates(sortedArray);

      if (direction === 'ascending') {
        return dates.every((val, i, arr) => !i || val >= arr[i - 1]);
      } else {
        return dates.every((val, i, arr) => !i || val <= arr[i - 1]);
      }
    } else {
      // For non-date strings or numbers
      if (direction === 'ascending') {
        const result = sortedArray.every((val, i, arr) => {
          if (i === 0) return true;
          const comparison = String(val).localeCompare(String(arr[i - 1]), undefined, { sensitivity: 'base' });
          if (comparison < 0) {
            console.log(`Ascending sort violation: '${val}' comes before '${arr[i - 1]}'`);
          }
          return comparison >= 0;
        });
        return result;
      } else {
        const result = sortedArray.every((val, i, arr) => {
          if (i === 0) return true;
          const comparison = String(val).localeCompare(String(arr[i - 1]), undefined, { sensitivity: 'base' });
          if (comparison > 0) {
            console.log(`Descending sort violation: '${val}' comes after '${arr[i - 1]}'`);
          }
          return comparison <= 0;
        });
        return result;
      }
    }
  }

  /**
   * Extract field values from API response data
   * @param {Array} apiData - API response data
   * @param {string} field - Field name to extract
   * @returns {Array} - Array of extracted values
   */
  extractApiFieldValues(apiData, field) {
    return apiData
      .map((item) => {
        if (field === 'name' || field === 'title' || field === 'description') {
          return item[field];
        } else if (field.includes('Date')) {
          return new Date(item[field]);
        }
        return item[field];
      })
      .filter((value) => value !== undefined);
  }

  /**
   * Compare UI data with API data
   * @param {Array} uiValues - Values displayed in the UI
   * @param {Array} apiValues - Values from the API
   * @param {boolean} isDate - Whether values are dates
   * @returns {boolean} - True if UI data matches API data
   */
  compareUiWithApiData(uiValues, apiValues, isDate = false) {
    if (uiValues.length !== apiValues.length) {
      console.log(`Length mismatch: UI has ${uiValues.length} items, API has ${apiValues.length} items`);
      return false;
    }

    if (isDate) {
      const uiDates = this.parseDates(uiValues);

      return uiDates.every((uiDate, index) => {
        const apiDate = apiValues[index];
        // Allow a small time difference (5 minutes)
        const timeDifference = Math.abs(uiDate.getTime() - apiDate.getTime());
        const withinTolerance = timeDifference < 5 * 60 * 1000;

        if (!withinTolerance) {
          console.log(`Date mismatch at index ${index}: UI has ${uiDate}, API has ${apiDate}`);
        }

        return withinTolerance;
      });
    } else {
      return uiValues.every((uiValue, index) => {
        const matches = uiValue.trim() === String(apiValues[index]).trim();
        if (!matches) {
          console.log(`Value mismatch at index ${index}: UI has "${uiValue}", API has "${apiValues[index]}"`);
        }
        return matches;
      });
    }
  }

  /**
   * Verify sorting for a specific column
   * @param {Object} options - Options for verification
   * @param {string} options.apiEndpoint - API endpoint (e.g., 'campaigns')
   * @param {string} options.fieldName - Field name in the API response
   * @param {boolean} options.isDate - Whether the field is a datecator - Locator for the active sort header
   * @returns {Promise<Object>} - Verification results
   */
  async verifySorting({
    apiEndpoint,
    fieldName,
    isDate = false,
  }) {
    const sortHeaderLocator = this.sortHeadersByName(fieldName);
    const columnCellsLocator = this.columnCellsByName(fieldName);

    // First click: ascending sort
    const ascendingApiData = await this.clickSortHeader({
      headerLocator: sortHeaderLocator,
      apiEndpoint,
    });

    const ascendingSortDirection = await this.getSortDirection(this.activeSortHeader);
    const ascendingValues = await this.getColumnValues(columnCellsLocator);
    const isAscendingSorted = this.isSorted(ascendingValues, 'ascending', isDate);

    // Extract values from API response for comparison
    const ascendingApiValues = this.extractApiFieldValues(ascendingApiData, fieldName);
    const apiAscendingMatches = this.compareUiWithApiData(ascendingValues, ascendingApiValues, isDate);

    // Second click: descending sort
    const descendingApiData = await this.clickSortHeader({
      headerLocator: sortHeaderLocator,
      apiEndpoint,
    });

    const descendingSortDirection = await this.getSortDirection(this.activeSortHeader);
    const descendingValues = await this.getColumnValues(columnCellsLocator);
    const isDescendingSorted = this.isSorted(descendingValues, 'descending', isDate);

    // Extract values from API response for comparison
    const descendingApiValues = this.extractApiFieldValues(descendingApiData, fieldName);
    const apiDescendingMatches = this.compareUiWithApiData(descendingValues, descendingApiValues, isDate);

    // Verify both sorting directions and API consistency
    const apiDataMatches = apiAscendingMatches && apiDescendingMatches;

    return {
      ascendingSortDirection,
      isAscendingSorted,
      descendingSortDirection,
      isDescendingSorted,
      apiDataMatches,
      success:
        isAscendingSorted &&
        isDescendingSorted &&
        apiDataMatches &&
        ascendingSortDirection === 'ascending' &&
        descendingSortDirection === 'descending',
    };
  }

  /**
   * Verify all sorting options for a specific page
   * @param {Object} options - Options for verification
   * @param {string} options.apiEndpoint - API endpoint
   * @param {Object} options.columns - Map of column configurations
   * @returns {Promise<Object>} - Verification results for all columns
   * @throws {Error} - If any verification fails
   */
  async verifyAllSortingOptions({ apiEndpoint, columns }) {
    const results = {};

    // Verify each column
    for (const [columnName, config] of Object.entries(columns)) {
      results[columnName] = await this.verifySorting({
        apiEndpoint,
        fieldName: config.fieldName || columnName,
        isDate: config.isDate || false,
      });
    }

    // Check for failures
    const failures = [];

    for (const [column, result] of Object.entries(results)) {
      if (!result.success) {
        failures.push({
          column,
          details: {
            ascendingSortDirection: result.ascendingSortDirection,
            isAscendingSorted: result.isAscendingSorted,
            descendingSortDirection: result.descendingSortDirection,
            isDescendingSorted: result.isDescendingSorted,
            apiDataMatches: result.apiDataMatches,
          },
        });
      }
    }

    // If there are failures, throw an error with details
    if (failures.length > 0) {
      throw new Error(
        `Sorting verification failed for columns: ${failures.map((f) => f.column).join(', ')}. ` +
          `Details: ${JSON.stringify(failures)}`,
      );
    }

    console.log('All sorting verifications passed successfully');
    return results;
  }
}

module.exports = SortValidator;
