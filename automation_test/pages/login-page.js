const path = require('path');
const config = require('../config/config-loader');
const { expect } = require('@playwright/test');

const authFile = path.join(__dirname, '..', 'user.json');
/**
 * Page object representing the login page
 */
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {string} testName - Name of the test for organizing screenshots
   */
  constructor(page, testName = 'login') {
    this.page = page;

    // Define multiple possible selectors for flexibility
    this.usernameSelectors = [
      'input[name="email"]'
    ];

    this.passwordSelectors = [
      'input[name="password"]'
    ];

    this.loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign in")'
    ];

    this.accountIcon = this.page.locator('button[aria-label="Account"]');
    this.signOutButton = this.page.locator('.signout-button');
    this.emailNotValidErrorMsg = this.page.getByText('Email is not valid.');
    this.editAccountBtn = this.page.locator('a[data-link-name="edit-username"]');
    this.wrongEmailPasswordErrorMsg = this.page.getByText('Wrong email or password');
  }

  /**
   * Navigate to the login page
   * @param {string} baseURL - The base URL to navigate to
   */
  async goto(baseURL) {
    console.log(`Navigating to ${baseURL}`);
    await this.page.goto(baseURL);
    await this.page.waitForLoadState('networkidle');
    console.log(`Current URL after navigation: ${this.page.url()}`);
  }

  /**
   * Try to find a visible element using multiple selectors
   * @param {string[]} selectors - List of selectors to try
   * @returns {Promise<import('@playwright/test').Locator>} The found element
   */
  async findVisibleElement(selectors) {
    for (const selector of selectors) {
      console.log(`Trying to find element with selector: ${selector}`);
      const element = this.page.locator(selector);
      await element.waitFor({ state: 'visible' });
      
      // Check if element exists and is visible
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`Found visible element with selector: ${selector}`);
        return element;
      }
    }
    throw new Error(`Could not find visible element with any of the selectors: ${selectors.join(', ')}`);
  }

  /**
   * Save a screenshot to the configured directory
   * @param {string} name - Name of the screenshot
   */
  async saveScreenshot(name) {
    const filePath = path.join(this.screenshotsDir, `${name}.png`);
    await this.page.screenshot({ path: filePath });
    console.log(`Screenshot saved to: ${filePath}`);
    return filePath;
  }

  /**
   * Login with the provided credentials
   * @param {string} username - Username to login with
   * @param {string} password - Password to login with
   */
  async login(username, password) {
    console.log("Starting login process...");

    try {
      const emailField = await this.findVisibleElement(this.usernameSelectors);
      const passwordField = await this.findVisibleElement(this.passwordSelectors);
      const loginButton = await this.findVisibleElement(this.loginButtonSelectors);
      
      await emailField.fill(username);
      await passwordField.fill(password);
      await loginButton.click();

      this.dashboardLocator = this.page.getByText('Dashboard').first();
      await this.dashboardLocator.waitFor({ state: 'visible' });

      await this.page.context().storageState({ path: authFile });
      console.log("Login successful");
    } catch (error) {
      console.error("Error during login:", error);
      await this.saveScreenshot('login-error');
      throw error;
    }
  }


  async isLoggedIn() {
    try {
      // Wait for the login page to be visible with a timeout
      await this.page.waitForURL('**/login/**', { timeout: 5000 });
      console.log("Not logged in");
      return false;
    } catch (error) {
      console.log("Logged in");
      return true;
    }
  }

  async expectNotLoggedIn() {
    const isLoggedIn = await this.isLoggedIn();
    expect(isLoggedIn).toBe(false);
  }

  async expectLoggedIn() {
    const isLoggedIn = await this.isLoggedIn();
    expect(isLoggedIn).toBe(true);
  }

  async logout() {
    await this.accountIcon.click();
    await this.signOutButton.click();
    console.log("Logging out...");

    const isLoggedIn = await this.isLoggedIn();
    expect(isLoggedIn).toBe(false);
  }

  async verifyLogin() {
    // Go to the base URL
    await this.page.goto(config.baseURL);
    
    // Wait for page to be fully loaded
    await this.page.waitForLoadState('networkidle');
    
    const isLoggedIn = await this.isLoggedIn();
    if (isLoggedIn) {
      await this.logout();
    }
    
    // 1. Enter incorrect email
    const usernameField = await this.findVisibleElement(this.usernameSelectors);
    await usernameField.fill('lizeth.pinto@spectrio.c');
    // Click continue button
    const continueButton = await this.findVisibleElement(this.continueButtonSelectors);
    await continueButton.click();
    await this.page.waitForLoadState('networkidle');
    // An error message is displayed: "Email is not valid" and the user cant continue
    await this.emailNotValidErrorMsg.waitFor({ state: 'visible' });
    await this.expectNotLoggedIn(); 

    // 2. Enter a valid email that it is not registered with Engage
    await usernameField.fill('Liz123@spectrio.com');
    // Click continue button
    await continueButton.click();
    await this.page.waitForLoadState('networkidle');
    // Edit button and password field is displayed
    await this.editAccountBtn.waitFor({ state: 'visible' });
    const passwordField = await this.findVisibleElement(this.passwordSelectors);
    // Enter password
    await passwordField.fill('123456');
    // Click login button
    const loginButton = await this.findVisibleElement(this.loginButtonSelectors);
    await loginButton.click();
    await this.page.waitForLoadState('networkidle');
    // Wrong email or password error message is displayed
    await this.wrongEmailPasswordErrorMsg.waitFor({ state: 'visible' });
    // Password field is empty
    expect(await passwordField.textContent()).toBe('');
    await this.expectNotLoggedIn();

    // 3. Enter a valid and registered email
    // Click Edit account button
    await this.editAccountBtn.click();
    await this.page.waitForLoadState('networkidle');
    // Password field is hidden
    await passwordField.waitFor({ state: 'detached' });
    // Enter a valid and registered email
    await usernameField.fill(config.username);
    // Click continue button
    await continueButton.click();
    await this.page.waitForLoadState('networkidle'); 
    // Password field is displayed
    await passwordField.waitFor({ state: 'visible' });
    // Enter the correct password
    await passwordField.fill(config.password);
    // Click login button
    await loginButton.click();
    await this.page.waitForLoadState('networkidle');
    // Login successful
    await this.expectLoggedIn();
  }
}

module.exports = { LoginPage }; 
