/**
 * Array utility functions for Playwright tests
 */
class ArrayUtils {
    /**
     * Helper method to compare two arrays for equality
     * @param {Array} arr1 - First array to compare
     * @param {Array} arr2 - Second array to compare
     * @returns {boolean} - True if arrays are equal
     */
    static arraysAreEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        
        return true;
    }
}

module.exports = ArrayUtils; 