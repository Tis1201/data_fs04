const { expect } = require('@playwright/test');
const { test } = require('../utils/persistent-browser');
const config = require('../config/config-loader');
const AssetLoader = require('../utils/asset-loader');
const { FactoryTokenPage } = require('../pages/factoryTokens/factory-token-page');

const name = config.pageURL.factoryTokens.name || `Test Name ${Date.now()}`;
const hardwareModel = config.pageURL.factoryTokens.hardwareModel || `Test hardwareModel ${Date.now()}`;
const firmwareVersion = config.pageURL.factoryTokens.firmwareVersion || `Test firmwareVersion ${Date.now()}`;
const editName = name + "1";

test.describe('Factory Token Management', () => {
    let factoryTokenPage;

    test.beforeEach(async ({ page }) => {
        factoryTokenPage = new FactoryTokenPage(page);
    });

    test('Create', async () => {
        await factoryTokenPage.create(name, hardwareModel, firmwareVersion);
    });

    test('Edit', async () => {
        await factoryTokenPage.editNameViaName(name, editName);
    });

    test('Cancel delete', async () => {
        await factoryTokenPage.cancelDelete(editName);
    });

    test('Delete', async () => {
        await factoryTokenPage.delete(editName);
    });

    test('Sort', async () => {
        await factoryTokenPage.verifyAllSort();
    });
});
