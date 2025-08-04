const { chromium } = require('@playwright/test');
const { LoginPage } = require('./pages/login-page');
const config = require('./config/config-loader');
const path = require('path');
const fs = require('fs');

/**
 * This script captures the complete authentication state including all cookies and localStorage
 */
(async () => {
  console.log('Setting up complete authentication state...');
  
  // Use persistent context to better preserve state
  const browserContext = await chromium.launchPersistentContext('user-data-dir', {
    headless: false,
    slowMo: 100
  });
  
  const page = await browserContext.newPage();
  
  try {
    console.log(`Using credentials: ${config.username}`);
    const loginPage = new LoginPage(page);
    
    // Navigate to app
    await page.goto(config.baseURL);
    
    // Perform login
    await loginPage.login(config.username, config.password);
    
  
    
    console.log('✅ Auth setup complete!');
  } catch (error) {
    console.error('❌ Error capturing auth state:', error);
  } finally {
    await browserContext.close();
  }
})(); 