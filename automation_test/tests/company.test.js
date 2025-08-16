const { expect } = require('@playwright/test');
const { test } = require('../utils/persistent-browser');
const config = require('../config/config-loader');
const AssetLoader = require('../utils/asset-loader');
const { CompanyPage } = require('../pages/companies/company-page');

const companyName = config.pageURL.companies?.name || `Test Company ${Date.now()}`;
const editCompanyName = companyName + "1"
const accountName = config.pageURL.companies?.accountName || 'Test Account';
const contactEmail = config.pageURL.companies?.contactEmail || `test@company${Date.now()}.com`;

test.describe('Company Management', () => {
    let companyPage;

    test.beforeEach(async ({ page }) => {
        companyPage = new CompanyPage(page);
    });

    test('Given company details, when creating a new company, then it should be created successfully', async () => {
        await companyPage.createCompany(companyName, accountName, contactEmail, {
            address: '123 Test Street, Test City, TC 12345',
            contactPhone: '+84395819202',
            description: 'Test company for automation testing'
        });
    });

    test('Given a company name, when editing the company name, then it should be updated successfully', async () => {
        await companyPage.editCompanyNameViaName(companyName, companyName + "1");
    });

    test('Given a company name, when canceling deactivate dialog, then the company should remain active', async () => {
        await companyPage.cancelDeactivateCompany(editCompanyName);
    });

    test('Given a company name, when deactivating the company via dialog, then it should be deactivated successfully', async () => {
        await companyPage.deactivateCompany(editCompanyName);
    });

    test('Given a company name, when canceling delete dialog, then the company should remain in the list', async () => {
        await companyPage.cancelDeleteCompany(editCompanyName);
    });

    test('Given a company name, when deleting the company via dialog, then it should be deleted successfully', async () => {
        await companyPage.deleteCompany(editCompanyName);
    });

    test('Given companies list, when sorting by different columns, then sorting should work correctly', async () => {
        await companyPage.verifyAllSort();
    });
}); 
