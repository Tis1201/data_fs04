const { dpTest, isNotEmpty } = require('./di-shared');

const test = dpTest;
const expect = test.expect;

test.describe('Section 3 — Device Information', () => {

    test('TC-INFO-006: Device Information card displays all fields and buttons for active device', async ({ dp }) => {
        await test.step('Verify Device Information heading is visible', async () => {
            await expect(dp.headingDeviceInfo).toBeVisible();
        });

        await test.step('Verify Device State is active', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return (fields['Device State'] || '').toLowerCase();
            }, { message: 'Device State should contain "active"' }).toContain('active');
        });

        await test.step('Verify Device Name is not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return isNotEmpty(fields['Device Name'] || '');
            }, { message: 'Device Name should not be empty' }).toBeTruthy();
        });

        await test.step('Verify Assigned Profile is not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return isNotEmpty(fields['Assigned Profile'] || '');
            }, { message: 'Assigned Profile should not be empty' }).toBeTruthy();
        });

        await test.step('Verify Description is not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return isNotEmpty(fields['Description'] || '');
            }, { message: 'Description should not be empty' }).toBeTruthy();
        });

        await test.step('Verify Refresh button is visible', async () => {
            await expect(dp.refreshButton).toBeVisible();
        });
    });

    test('TC-INFO-007: Assigned Profile link navigates to profile page and Refresh reloads data', async ({ dp, page }) => {
        await expect(dp.profileLink).toBeVisible();

        await test.step('Click Profile link and verify navigation to profile page', async () => {
            await dp.profileLink.click();
            await expect(page).toHaveURL(/\/device-profiles\//);

            await page.goBack();
            await expect(dp.headingDeviceInfo).toBeVisible();
        });

        await test.step('Click Refresh button and verify no error', async () => {
            await expect(dp.refreshButton).toBeVisible();
            await dp.refreshButton.click();
            await expect(dp.headingDeviceInfo).toBeVisible();
        });
    });
});
