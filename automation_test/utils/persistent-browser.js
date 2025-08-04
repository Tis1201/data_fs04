const { test: baseTest, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Create and export a persistent context test fixture
const test = baseTest.extend({
  page: async ({}, use) => {
    // Create a user-data directory path
    const userDataDir = path.join(__dirname, '..', 'user-data-dir');
    
    // Ensure the directory exists
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // Launch persistent context
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      slowMo: 300
    });
    
    // Create a page from the context
    const page = await browserContext.newPage();
    
    // Use the page in the test
    await use(page);
    
    // Clean up
    await browserContext.close();
  }
});

module.exports = { test }; 
