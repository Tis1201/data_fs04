const { test, expect } = require('@playwright/test');
const DashboardPage = require('../pages/dashboards/dashboard-page');
const DevicePage = require('../pages/devices/device-listing-page');
const path = require('path');

const authFile = path.join(__dirname, '..', 'user.json');
test.use({ storageState: authFile });

test.describe('Dashboard vs IoT Devices Data Comparison', () => {
    let dashboardPage;
    let devicePage;

    test.beforeEach(async ({ page }) => {
        dashboardPage = new DashboardPage(page);
        devicePage = new DevicePage(page);
    });

    test('TC-COMPARE-001: Compare Critical Issues breakdown between Dashboard and IoT Devices', async ({ page }) => {
        await dashboardPage.goto();
        await dashboardPage.waitForDashboardLoad();

        const dashboardCritical = await dashboardPage.getCriticalIssuesBreakdown();

        const deviceCritical = await devicePage.getAllCriticalBreakdown();

        console.log('Dashboard Critical - CPU:', dashboardCritical.cpu);
        console.log('Dashboard Critical - Memory:', dashboardCritical.memory);
        console.log('Dashboard Critical - Storage:', dashboardCritical.storage);
        console.log('Dashboard Critical - Network:', dashboardCritical.network);

        console.log('Device Critical - CPU:', deviceCritical.cpu);
        console.log('Device Critical - Memory:', deviceCritical.memory);
        console.log('Device Critical - Storage:', deviceCritical.storage);
        console.log('Device Critical - Network:', deviceCritical.network);

        const dashboardTotal = dashboardCritical.cpu + dashboardCritical.memory + dashboardCritical.storage + dashboardCritical.network;
        expect(dashboardTotal, 'Total Critical Issues should match').toBe(deviceCritical.total);
        expect(dashboardCritical.cpu, 'CPU critical count should match').toBe(deviceCritical.cpu);
        expect(dashboardCritical.memory, 'Memory critical count should match').toBe(deviceCritical.memory);
        expect(dashboardCritical.storage, 'Storage critical count should match').toBe(deviceCritical.storage);
        expect(dashboardCritical.network, 'Network critical count should match').toBe(deviceCritical.network);
    });

    test('TC-COMPARE-002: Compare Warnings breakdown between Dashboard and IoT Devices', async ({ page }) => {
        await dashboardPage.goto();
        await dashboardPage.waitForDashboardLoad();

        const dashboardWarning = await dashboardPage.getWarningsBreakdown();

        const deviceWarning = await devicePage.getAllWarningBreakdown();

        console.log('Dashboard Warnings - CPU:', dashboardWarning.cpu);
        console.log('Dashboard Warnings - Memory:', dashboardWarning.memory);
        console.log('Dashboard Warnings - Storage:', dashboardWarning.storage);
        console.log('Dashboard Warnings - Network:', dashboardWarning.network);

        console.log('Device Warnings - CPU:', deviceWarning.cpu);
        console.log('Device Warnings - Memory:', deviceWarning.memory);
        console.log('Device Warnings - Storage:', deviceWarning.storage);
        console.log('Device Warnings - Network:', deviceWarning.network);

        const dashboardTotal = dashboardWarning.cpu + dashboardWarning.memory + dashboardWarning.storage + dashboardWarning.network;

        expect(dashboardTotal, 'Total Warnings should match').toBe(deviceWarning.total);
        expect(dashboardWarning.cpu, 'CPU warning count should match').toBe(deviceWarning.cpu);
        expect(dashboardWarning.memory, 'Memory warning count should match').toBe(deviceWarning.memory);
        expect(dashboardWarning.storage, 'Storage warning count should match').toBe(deviceWarning.storage);
        expect(dashboardWarning.network, 'Network warning count should match').toBe(deviceWarning.network);
    });

    test('TC-COMPARE-003: Compare Total Devices count between Dashboard and IoT Device List', async ({ page }) => {
        await dashboardPage.goto();
        await dashboardPage.waitForDashboardLoad();
        const dashboardMetrics = await dashboardPage.getMetricNumbers();

        const deviceMetrics = await devicePage.getAllMetricBreakdown();

        console.log('Dashboard - Total Devices:', dashboardMetrics.totalDevices);
        console.log('Device Page - Total Rows:', deviceMetrics.total);

        expect(dashboardMetrics.totalDevices, 'Total devices count should match').toBe(deviceMetrics.total);
    });

    test('TC-COMPARE-004: Compare Healthy (Online) count between Dashboard and IoT Device List', async ({ page }) => {
        await dashboardPage.goto();
        await dashboardPage.waitForDashboardLoad();
        const dashboardMetrics = await dashboardPage.getMetricNumbers();

        const deviceMetrics = await devicePage.getAllMetricBreakdown();

        console.log('Dashboard - Healthy:', dashboardMetrics.healthy);
        console.log('Device Page - Online:', deviceMetrics.online);

        expect(dashboardMetrics.healthy, 'Healthy count on dashboard should match Online count on device list').toBe(deviceMetrics.online);
    });

    test('TC-COMPARE-005: Compare Offline count between Dashboard and IoT Device List', async ({ page }) => {
        await dashboardPage.goto();
        await dashboardPage.waitForDashboardLoad();
        const dashboardMetrics = await dashboardPage.getMetricNumbers();

        const deviceMetrics = await devicePage.getAllMetricBreakdown();

        console.log('Dashboard - Offline:', dashboardMetrics.offline);
        console.log('Device Page - Offline:', deviceMetrics.offline);

        expect(dashboardMetrics.offline, 'Offline count should match').toBe(deviceMetrics.offline);
    });
});
