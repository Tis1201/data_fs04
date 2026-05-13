const { dpTest } = require('./di-shared');

const test = dpTest;
const expect = test.expect;

test.describe('Section 6 — Security', () => {

    test('TC-INFO-012: Security card displays masked API Key with copy functionality', async ({ dp }) => {
        let fields;

        await test.step('Verify Security heading and masked API Key', async () => {
            await expect(dp.headingSecurity).toBeVisible();
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                if (data['API Key'] && data['API Key'].trim().length > 0) {
                    fields = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for API Key field to render' }).toBeTruthy();

            const apiKey = fields['API Key'];
            expect(apiKey, `API Key should contain masked bullets, got "${apiKey}"`).toContain('\u2022\u2022');
        });

        await test.step('Verify Copy API Key button and click', async () => {
            await expect(dp.copyApiKeyButton).toBeVisible();
            await dp.clickCopyApiKey();
        });
    });

    test('TC-INFO-013: Generate New Key flow — confirm dialog and key changes', async ({ dp, page }) => {
        const fieldsBefore = await dp.extractAllFieldValues();
        const oldKey = fieldsBefore['API Key'] || '';

        await test.step('Click Generate New Key', async () => {
            await expect(dp.generateNewKeyButton).toBeVisible();
            await expect(dp.generateNewKeyButton).toBeEnabled();
            await dp.clickGenerateNewKey();
        });

        await test.step('Handle confirm dialog and confirm generation', async () => {
            const dialog = page.getByRole('alertdialog', { name: /generate new api key/i });
            await expect(dialog, 'Generate New API Key dialog should appear').toBeVisible({ timeout: 5000 });
            const generateBtn = dialog.getByRole('button', { name: /^generate$/i });
            await expect(generateBtn, 'Generate button should be visible in dialog').toBeVisible();
            await generateBtn.click();
            await dialog.waitFor({ state: 'hidden', timeout: 15000 });
        });

        await test.step('Verify new key populated and changed from old key', async () => {
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                return data['API Key'] || '';
            }, { message: 'Waiting for new API Key to render after generation', timeout: 20000 }).not.toBe(oldKey);

            const newFields = await dp.extractAllFieldValues();
            const newKey = newFields['API Key'] || '';
            expect(newKey.trim(), 'New API Key should not be empty').not.toBe('');
        });
    });
});
