const { test, expect } = require('@playwright/test');
const DevicePage = require('../pages/iot/device-page');
const config = require('../config/config-loader');
const path = require('path');

const authFile = path.join(__dirname, '..', 'user.json');
test.use({ storageState: authFile });


const { onlineDeviceId: ONLINE_DEVICE_ID, offlineDeviceId: OFFLINE_DEVICE_ID } = config.pageURL.devices;

test.describe('IoT Device - Snapshot Feature Validation', () => {
    let devicePage;

    test.beforeEach(async ({ page }) => {
        devicePage = new DevicePage(page, ONLINE_DEVICE_ID);
        
        await page.goto(devicePage.deviceUrl);
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    });

    test('TC-001: Validate Snapshot completes successfully when device is ONLINE', async ({ page }) => {
        await test.step('Pre-condition: Ensure device is ONLINE', async () => {
            const connectionStatus = await devicePage.getDeviceConnectionStatus();
            expect(connectionStatus, 'Device must be ONLINE to run this test').toContain('online');
        });

        await test.step('Navigate to Activity Tab', async () => {
            await devicePage.switchToActivityTab();
            await devicePage.waitForActivityLogLoaded();
        });

        let actionStartTime;

        await test.step('Trigger Snapshot and verify "In-Progress" state in Log', async () => {
            actionStartTime = Date.now();
            
            await devicePage.triggerSnapshot();

            await expect(
                devicePage.sendingLogMessage,
                'Toast must show "Sending screenshot command" while snapshot is in progress'
            ).toBeVisible({ timeout: 10000 });

            await expect(
                devicePage.inProgressBadge.first(),
                'Activity Log must show a new entry with In-Progress status'
            ).toBeVisible({ timeout: 5000 });
        });

        await test.step('Wait for Snapshot to complete successfully', async () => {
            await expect(
                devicePage.successLogMessage,
                'Toast must show "Captured successfully" on completion'
            ).toBeVisible({ timeout: 30000 });

            await expect(devicePage.snapshotImage, 'Screenshot image must be visible in modal').toBeVisible({ timeout: 5000 });
            
            const imageSrc = await devicePage.getSnapshotImageSrc();
            expect(imageSrc, 'Image src must contain Base64 JPEG data').toMatch(/^data:image\/jpeg;base64,/);
        });

        await test.step('Verify Activity Log updates from In-Progress to Success', async () => {
            await devicePage.closeSnapshotModal();

            await expect(
                devicePage.latestSuccessBadge.first(),
                'The Activity Log entry must update to Status = Success'
            ).toBeVisible({ timeout: 5000 });

            const logTimestamp = await devicePage.getLatestLogTimestamp();
            
            expect(
                logTimestamp, 
                'The Success log timestamp must occur AFTER the Snapshot button was clicked'
            ).toBeGreaterThanOrEqual(actionStartTime);
        });
    });

    test('TC-002: Validate Snapshot fails gracefully when device is OFFLINE', async ({ page }) => {
        await test.step('Navigate to explicitly OFFLINE device', async () => {
             devicePage = new DevicePage(page, OFFLINE_DEVICE_ID);
             
             await page.goto(devicePage.deviceUrl);
             await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        });

        await test.step('Verify device status is actually OFFLINE', async () => {
             const connectionStatus = await devicePage.getDeviceConnectionStatus();
             expect(connectionStatus, 'Device must be OFFLINE to run this test').toContain('offline');
        });

        await test.step('Trigger Snapshot and verify failure in Activity Log', async () => {
             await devicePage.triggerSnapshot();
             await devicePage.switchToActivityTab();
             
             await expect(
                 devicePage.latestFailedBadge,
                 'Activity Log must show a Failed status for offline snapshot request'
             ).toBeVisible({ timeout: 15000 });
        });
    });
});