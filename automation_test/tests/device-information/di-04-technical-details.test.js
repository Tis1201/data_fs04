const { dpTest, norm, isNotEmpty } = require('./di-shared');

const test = dpTest;
const expect = test.expect;

test.describe('Section 4 — Technical Details', () => {

    test('TC-INFO-008: Technical Details — UI fields + Terminal cross-verify', async ({ dp }) => {
        test.setTimeout(180000);

        let fields;

        await test.step('Navigate and wait for Technical Details to fully render', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.headingTechnicalDetails).toBeVisible();
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                if (isNotEmpty(data['OS Version'])) {
                    fields = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for Technical Details fields to load' }).toBeTruthy();
        });

        await test.step('Verify OS Version has numeric prefix', async () => {
            const osVersion = fields['OS Version'] || '';
            expect(isNotEmpty(osVersion), 'OS Version should not be empty').toBeTruthy();
            expect(osVersion).toMatch(/^\d+/);
        });

        await test.step('Verify Firmware is not empty', async () => {
            expect(isNotEmpty(fields['Firmware'] || ''), 'Firmware should not be empty').toBeTruthy();
        });

        await test.step('Verify Model is not empty', async () => {
            expect(isNotEmpty(fields['Model'] || ''), 'Model should not be empty').toBeTruthy();
        });

        await test.step('Verify Operating System is valid', async () => {
            const os = norm(fields['Operating System'] || '');
            expect(['android', 'linux', 'windows', 'ios']).toContain(os);
        });

        await test.step('Verify Manufacturer and Hardware ID (soft)', async () => {
            expect.soft(isNotEmpty(fields['Manufacturer'] || ''), 'Manufacturer should be populated').toBeTruthy();
            expect.soft(isNotEmpty(fields['Hardware ID'] || ''), 'Hardware ID should be populated').toBeTruthy();
        });

        await test.step('Verify OS Version consistency for Android', async () => {
            const os = norm(fields['Operating System'] || '');
            if (os === 'android') {
                const ver = parseInt(fields['OS Version'] || '0');
                expect(ver).toBeGreaterThanOrEqual(1);
                expect(ver).toBeLessThanOrEqual(20);
            }
        });

        const termReady = await dp.gotoTerminal();
        expect(termReady, 'Terminal should be responsive for an online device').toBeTruthy();

        const tech = await expect.poll(async () => {
            const result = await dp.getTerminalTechDetails();
            if (!result.osVersion && !result.sdkVersion && !result.model) return null;
            return result;
        }, { timeout: 15000, message: 'Terminal must return at least one technical detail' }).toMatchObject(
            expect.objectContaining({
                osVersion: expect.any(String),
            })
        );

        await test.step('Cross-verify OS Version with terminal', async () => {
            const uiVal = (fields['OS Version'] || '').toLowerCase().trim();
            const termVal = (tech.osVersion || '').toLowerCase().trim();
            expect.soft(termVal, 'Terminal must return OS Version for cross-verify').toBeTruthy();
            expect.soft(uiVal, `OS Version mismatch: UI="${uiVal}" vs Terminal="${termVal}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Firmware/SDK with terminal', async () => {
            const uiVal = (fields['Firmware'] || '').toLowerCase().trim();
            const termVal = (tech.sdkVersion || '').toLowerCase().trim();
            expect.soft(termVal, 'Terminal must return Firmware/SDK for cross-verify').toBeTruthy();
            expect.soft(uiVal, `Firmware/SDK mismatch: UI="${uiVal}" vs Terminal="${termVal}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Model with terminal (soft)', async () => {
            const uiVal = (fields['Model'] || '').toLowerCase().trim();
            const termVal = (tech.model || '').toLowerCase().trim();
            expect.soft(uiVal, `Model mismatch: UI="${uiVal}" vs Terminal="${termVal}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Manufacturer with terminal (soft)', async () => {
            const uiVal = (fields['Manufacturer'] || '').toLowerCase().trim();
            const termVal = (tech.manufacturer || '').toLowerCase().trim();
            expect.soft(uiVal, `Manufacturer mismatch: UI="${uiVal}" vs Terminal="${termVal}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Hardware ID with terminal (soft)', async () => {
            const uiVal = (fields['Hardware ID'] || '').toLowerCase().trim();
            const termVal = (tech.serialNo || '').toLowerCase().trim();
            expect.soft(uiVal, `Hardware ID mismatch: UI="${uiVal}" vs Terminal="${termVal}"`).toEqual(termVal);
        });
    });
});
