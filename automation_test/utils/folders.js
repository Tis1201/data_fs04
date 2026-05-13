const fs = require('fs');
const path = require('path');

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Gets path to screenshots directory, creating it if needed
 * @param {string} testName - Optional test name for subfolder
 * @returns {string} Path to screenshots directory
 */
function getScreenshotsDir(testName = '') {
  const baseDir = path.join(__dirname, '..', 'test-results', 'screenshots');
  
  if (testName) {
    const testDir = path.join(baseDir, testName);
    ensureDirectoryExists(testDir);
    return testDir;
  }
  
  ensureDirectoryExists(baseDir);
  return baseDir;
}

/**
 * Gets path to auth states directory, creating it if needed
 * @returns {string} Path to auth states directory
 */
function getAuthStatesDir() {
  const dir = path.join(__dirname, '..', 'test-results', 'auth-states');
  ensureDirectoryExists(dir);
  return dir;
}

module.exports = {
  ensureDirectoryExists,
  getScreenshotsDir,
  getAuthStatesDir
}; 