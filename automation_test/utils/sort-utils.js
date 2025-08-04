const DateUtils = require('./date-utils');
const ArrayUtils = require('./array-utils');

class SortUtils {
    static createSortComparator(dataType, ascending = true, caseSensitive = false) {
        let comparator;
        if (dataType === 'date') {
            comparator = (a, b) => DateUtils.compareDates(a, b);
        } else if (dataType === 'number') {
            comparator = (a, b) => parseFloat(a) - parseFloat(b);
        } else {
            comparator = (a, b) =>
                caseSensitive
                    ? a.localeCompare(b)
                    : a.localeCompare(b, undefined, { sensitivity: 'base' });
        }
        return ascending ? comparator : (a, b) => comparator(b, a);
    }

    static async verifyColumnSorting(page, headerName, dataType = 'text', ascending = true) {
        const headerLocator = page.locator(`table th button:has-text("${headerName}")`);

        // Handle Created column default (desc)
        const isCreatedColumn = headerName.toLowerCase().includes('created');
        if (isCreatedColumn && ascending) {
            console.warn('Created column usually sorts descending by default (newest first)');
        }

        // Determine column index first (before clicking)
        const headers = (await page.locator('table th').allTextContents()).map(h => h.trim());
        const colIndex = headers.findIndex(h => h.toLowerCase().includes(headerName.toLowerCase())) + 1;
        if (colIndex === 0) throw new Error(`Header "${headerName}" not found`);

        // Click to achieve desired order
        // Reset to default: usually first click asc, second click desc
        await headerLocator.click();
        if (!ascending || isCreatedColumn) await headerLocator.click();

        // Get all cell values from that column
        const cells = page.locator(`table tbody tr td:nth-child(${colIndex})`);
        let values = (await cells.allTextContents()).map(v => v.trim());

        // Handle Created / relative times as numbers
        if (dataType === 'relative' || isCreatedColumn) {
            // Convert to minutes (smaller = newer)
            const minutesArray = values.map(v => DateUtils.relativeToMinutes(v));
            // Negate values so newest appears first when descending
            values = ascending ? minutesArray : minutesArray.map(v => -v);
            dataType = 'number';
        }

        // Postgres-like text sorting for 'text'
        const comparator = (a, b) => {
            if (dataType === 'number') return parseFloat(a) - parseFloat(b);
            if (dataType === 'text') return SortUtils.postgresLikeCompare(a, b);
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
        };

        // Generate expected sorted array
        const sorted = [...values].sort((a, b) => (ascending ? comparator(a, b) : comparator(b, a)));

        console.log(`Column "${headerName}" values:`, values);
        console.log(`Expected sorted (${ascending ? 'asc' : 'desc'}):`, sorted);

        if (!ArrayUtils.arraysAreEqual(values, sorted)) {
            throw new Error(`Column "${headerName}" is not sorted ${ascending ? 'asc' : 'desc'}`);
        }

        console.log(`Column "${headerName}" sorted ${ascending ? 'asc' : 'desc'} correctly`);
    }

    /**
     * Mimic PostgreSQL collation for strings with underscores/numbers
     */
    static postgresLikeCompare(a, b) {
        const normalize = str =>
            str.toLowerCase().replace(/[^a-z0-9]/g, c => {
                const code = c.charCodeAt(0) + 1000; // push symbols higher
                return String.fromCharCode(code);
            });
        return normalize(a).localeCompare(normalize(b));
    }

}

module.exports = SortUtils;
