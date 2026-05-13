const { dpTest, isNotEmpty, OFFLINE_DEVICE_ID } = require('./di-shared');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');

const test = dpTest;
const expect = test.expect;

test.describe('Section 7 — Device Health Panel', () => {

    test('TC-INFO-014: Device Health — metrics, buttons, and Terminal cross-verify', async ({ dp }) => {
        test.setTimeout(180000);

        let metrics;
        await test.step('Wait for Health metrics to fully render', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.headingDeviceHealth).toBeVisible();
            await expect.poll(async () => {
                const data = await dp.getHealthMetrics();
                if (isNotEmpty(data.uptime) && isNotEmpty(data.cpu)) {
                    metrics = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for Health Metrics (Uptime, CPU) to populate' }).toBeTruthy();
        });

        await test.step('Verify Device Uptime format', async () => {
            expect(metrics.uptime, `Uptime should match time format, got "${metrics.uptime}"`).toMatch(/\d{1,2}:\d{2}(:\d{2})?/);
        });

        await test.step('Verify CPU is within 0-100 range', async () => {
            const cpuNum = parseInt(metrics.cpu);
            expect(cpuNum, `CPU should be >= 0, got ${cpuNum}`).toBeGreaterThanOrEqual(0);
            expect(cpuNum, `CPU should be <= 100, got ${cpuNum}`).toBeLessThanOrEqual(100);
        });

        await test.step('Verify MEM is within 0-100 range', async () => {
            const memNum = parseInt(metrics.mem);
            expect(memNum, `MEM should be >= 0, got ${memNum}`).toBeGreaterThanOrEqual(0);
            expect(memNum, `MEM should be <= 100, got ${memNum}`).toBeLessThanOrEqual(100);
        });

        await test.step('Verify DSK is within 0-100 range', async () => {
            const dskNum = parseInt(metrics.dsk);
            expect(dskNum, `DSK should be >= 0, got ${dskNum}`).toBeGreaterThanOrEqual(0);
            expect(dskNum, `DSK should be <= 100, got ${dskNum}`).toBeLessThanOrEqual(100);
        });

        await test.step('Verify all 8 Quick Action buttons are visible', async () => {
            for (const [name, btn] of Object.entries(dp.quickActionButtons)) {
                await expect(btn, `Button "${name}" should be visible`).toBeVisible();
            }
        });

        const termReady = await dp.gotoTerminal();
        expect(termReady, 'Terminal should be responsive for an online device').toBeTruthy();

        const uiDSK = parseFloat((metrics.dsk || '').replace('%', '').trim());
        const uiMEM = parseFloat((metrics.mem || '').replace('%', '').trim());

        const termDiskPercent = await dp.getTerminalDiskUsage();
        const termMemInfo = await dp.getTerminalMemInfo();

        await test.step('Cross-verify DSK with terminal (±2%)', async () => {
            expect.soft(termDiskPercent, 'Terminal must return disk usage data').not.toBeNull();
            if (termDiskPercent !== null && !isNaN(uiDSK)) {
                expect.soft(uiDSK, `DSK UI (${uiDSK}%) is below Terminal range (${termDiskPercent}% ±2)`).toBeGreaterThanOrEqual(termDiskPercent - 2);
                expect.soft(uiDSK, `DSK UI (${uiDSK}%) is above Terminal range (${termDiskPercent}% ±2)`).toBeLessThanOrEqual(termDiskPercent + 2);
            }
        });

        await test.step('Cross-verify MEM with terminal (±40%, soft)', async () => {
            if (termMemInfo.usedPercent === 0) {
                test.info().annotations.push({ type: 'warn', description: 'Terminal returned 0 MEM — device may not expose /proc/meminfo reliably' });
                return;
            }
            if (!isNaN(uiMEM)) {
                expect.soft(uiMEM, `MEM UI (${uiMEM}%) is below Terminal range (${termMemInfo.usedPercent}% ±40)`).toBeGreaterThanOrEqual(termMemInfo.usedPercent - 40);
                expect.soft(uiMEM, `MEM UI (${uiMEM}%) is above Terminal range (${termMemInfo.usedPercent}% ±40)`).toBeLessThanOrEqual(termMemInfo.usedPercent + 40);
            }
        });
    });

    test('TC-INFO-015: Health panel for offline device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, OFFLINE_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Verify Device Health heading is visible', async () => {
            await expect(dp.headingDeviceHealth).toBeVisible();
        });

        await test.step('Verify all health fields are rendered', async () => {
            const healthFields = ['Device Uptime', 'CPU', 'MEM', 'DSK'];
            let allFields;
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                const populated = healthFields.every(key => (data[key] || '').trim().length > 0);
                if (populated) {
                    allFields = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for offline device health fields to render' }).toBeTruthy();

            for (const key of healthFields) {
                const val = allFields[key] || '';
                expect(val.trim(), `Field "${key}" should be rendered (got empty string)`).not.toBe('');
            }
        });
    });
});
