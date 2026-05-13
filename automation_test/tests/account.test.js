const { expect } = require('@playwright/test');
const { test } = require('../utils/persistent-browser');
const config = require('../config/config-loader');
const AssetLoader = require('../utils/asset-loader');
const { AccountPage } = require('../pages/accounts/account-page');

const description = config.pageURL.accounts.description || `Test Tag ${Date.now()}`;
const name = config.pageURL.accounts.name || `Test Name ${Date.now()}`;
const editName = name + "1";

test.describe('Account Management', () => {
    let accountPage;

    test.beforeEach(async ({ page }) => {
        accountPage = new AccountPage(page);
    });

    test('Given an asset name and tag, when creating a new asset, then it should be created successfully', async () => {
        await accountPage.createAccount(name, description);
    });

    test('Given an account name, when editing the account name, then it should be updated successfully', async () => {
        await accountPage.editAccountNameViaName(name, editName);
    });

    test('Given an account name, when canceling deactivate dialog, then the account should remain active', async () => {
        await accountPage.cancelDeactivateAccount(editName);
    });

    test('Given an account name, when deactivating the account via dialog, then it should be deactivated successfully', async () => {
        await accountPage.deactivateAccount(editName);
    });

    test('Given an account name, when canceling delete dialog, then the account should remain in the list', async () => {
        await accountPage.cancelDeleteAccount(editName);
    });

    test('Given an account name, when deleting the account via dialog, then it should be deleted successfully', async () => {
        await accountPage.deleteAccount(editName);
    });

    test('Given accounts list, when sorting by different columns, then sorting should work correctly', async () => {
        await accountPage.verifyAllSort();
    });
});
