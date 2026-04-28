const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');
const { compare, isNotEmpty } = require('../../utils/terminal-helpers');
const {
    authFile,
    config,
    PROFILE_WITH_DEVICES_ID,
} = require('./dp-shared');

// Rule 11.1: Use Fixture
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 15 — Terminal Cross-Verification', () => {

    test('TC-DP-024: Profile configuration matches device terminal settings', async ({ dp, page }) => {
        test.setTimeout(180000);
        const ONLINE_DEVICE_ID = config.pageURL.devices.onlineDeviceId;

        // ── Part 1: Read profile configuration from UI ──
        console.log('\n══════ Part 1: Read profile configuration from UI ══════\n');
        await dp.gotoDetail(PROFILE_WITH_DEVICES_ID);
        
        // STANDARDIZATION: Use Web-first assertion to wait for loading to complete before extracting
        await expect(dp.configCard).toBeVisible();
        const configValues = await dp.extractConfigTabValues();

        const uiBrightness = (configValues['Brightness Level']?.value || '').replace('%', '').trim();
        const uiVolume = (configValues['Volume Level']?.value || '').replace('%', '').trim();
        const uiTimezone = (configValues['Timezone']?.value || '').trim();
        const uiOrientation = (configValues['Screen Orientation']?.value || '').trim();
        const uiResolution = (configValues['Display Resolution']?.value || '').trim();

        console.log(`  UI Brightness: "${uiBrightness}"`);
        console.log(`  UI Volume: "${uiVolume}"`);
        console.log(`  UI Timezone: "${uiTimezone}"`);
        console.log(`  UI Orientation: "${uiOrientation}"`);
        console.log(`  UI Resolution: "${uiResolution}"`);

        // ── Part 2: Read actual device settings via Terminal ──
        console.log('\n══════ Part 2: Terminal cross-verify ══════\n');
        const devicePage = new DeviceDetailPage(page, ONLINE_DEVICE_ID);
        await devicePage.gotoTerminal();

        const termConfig = await devicePage.getTerminalConfigDetails();

        console.log(`  Terminal Brightness: "${termConfig.brightness}"`);
        console.log(`  Terminal Volume: "${termConfig.volume}"`);
        console.log(`  Terminal Timezone: "${termConfig.timezone}"`);
        console.log(`  Terminal Orientation: "${termConfig.orientationRaw}" (${termConfig.orientationLabel})`);
        console.log(`  Terminal Resolution: "${termConfig.resolution}"`);

        const allTermValues = [termConfig.brightness, termConfig.volume, termConfig.timezone, termConfig.orientationRaw, termConfig.resolution];
        const hasAnyData = allTermValues.some(v => isNotEmpty(v));
        // Rule 11: Terminal returning no data is an environment error — test must FAIL
        expect(hasAnyData, 'Terminal should return at least one config value — unresponsive terminal is an environment error').toBeTruthy();

        // ── Part 3: Compare UI profile config vs terminal ──
        console.log('\n══════ Part 3: Cross-verify results ══════\n');
        // Rule 18 #12: Use expect.soft() for each comparison instead of collecting into results array
        let passCount = 0;
        let totalCount = 0;

        // Brightness: UI is 0-100%, Android screen_brightness is 0-255
        if (isNotEmpty(uiBrightness) && isNotEmpty(termConfig.brightness) && !isNaN(parseFloat(termConfig.brightness))) {
            const uiBrightnessNum = parseFloat(uiBrightness);
            const termBrightnessNum = parseFloat(termConfig.brightness);
            const expectedTermBrightness = Math.round((uiBrightnessNum / 100) * 255);
            const brightnessTolerance = 10;
            const brightnessMatch = Math.abs(termBrightnessNum - expectedTermBrightness) <= brightnessTolerance;
            console.log(`  ${brightnessMatch ? '✅' : '❌'} Brightness: UI ${uiBrightnessNum}% → expected ~${expectedTermBrightness}/255, terminal=${termBrightnessNum}`);
            expect.soft(brightnessMatch, `Brightness: UI ${uiBrightnessNum}% should match terminal ~${expectedTermBrightness}/255 (got ${termBrightnessNum})`).toBeTruthy();
            totalCount++; if (brightnessMatch) passCount++;
        } else {
            console.log('  ⚠️  Brightness: one or both values empty — skipping');
        }

        // Volume: UI is 0-100%, Android volume_music_speaker is 0-15
        if (isNotEmpty(uiVolume) && isNotEmpty(termConfig.volume) && !isNaN(parseFloat(termConfig.volume))) {
            const uiVolumeNum = parseFloat(uiVolume);
            const termVolumeNum = parseFloat(termConfig.volume);
            const expectedTermVolume = Math.round((uiVolumeNum / 100) * 15);
            const volumeTolerance = 2;
            const volumeMatch = Math.abs(termVolumeNum - expectedTermVolume) <= volumeTolerance;
            console.log(`  ${volumeMatch ? '✅' : '❌'} Volume: UI ${uiVolumeNum}% → expected ~${expectedTermVolume}/15, terminal=${termVolumeNum}`);
            expect.soft(volumeMatch, `Volume: UI ${uiVolumeNum}% should match terminal ~${expectedTermVolume}/15 (got ${termVolumeNum})`).toBeTruthy();
            totalCount++; if (volumeMatch) passCount++;
        } else {
            console.log('  ⚠️  Volume: one or both values empty — skipping');
        }

        // Timezone
        if (isNotEmpty(uiTimezone) && isNotEmpty(termConfig.timezone)) {
            const timezoneMatch = compare('Timezone', uiTimezone, termConfig.timezone, { caseInsensitive: true });
            expect.soft(timezoneMatch, `Timezone: UI "${uiTimezone}" should match terminal "${termConfig.timezone}"`).toBeTruthy();
            totalCount++; if (timezoneMatch) passCount++;
        } else {
            console.log('  ⚠️  Timezone: one or both values empty — skipping');
        }

        // Screen Orientation
        if (isNotEmpty(uiOrientation) && isNotEmpty(termConfig.orientationLabel)) {
            const orientationMatch = compare('Screen Orientation', uiOrientation, termConfig.orientationLabel, { caseInsensitive: true });
            expect.soft(orientationMatch, `Screen Orientation: UI "${uiOrientation}" should match terminal "${termConfig.orientationLabel}"`).toBeTruthy();
            totalCount++; if (orientationMatch) passCount++;
        } else {
            console.log('  ⚠️  Screen Orientation: one or both values empty — skipping');
        }

        // Resolution — normalize unicode × to x, strip "Physical size:" prefix and "(Full HD)" suffix
        if (isNotEmpty(uiResolution) && isNotEmpty(termConfig.resolution)) {
            const normalizeRes = (s) => s.replace(/.*:\s*/, '').replace(/\(.*\)/, '').replace(/×/g, 'x').replace(/\s+/g, '').toLowerCase();
            const uiResNorm = normalizeRes(uiResolution);
            const termResNorm = normalizeRes(termConfig.resolution);
            const resMatch = uiResNorm.includes(termResNorm) || termResNorm.includes(uiResNorm);
            console.log(`  ${resMatch ? '✅' : '❌'} Resolution: UI="${uiResolution}" → "${uiResNorm}" vs Terminal="${termConfig.resolution}" → "${termResNorm}"`);
            expect.soft(resMatch, `Resolution: UI "${uiResNorm}" should match terminal "${termResNorm}"`).toBeTruthy();
            totalCount++; if (resMatch) passCount++;
        } else {
            console.log('  ⚠️  Resolution: one or both values empty — skipping');
        }

        console.log(`\n  Summary: ${passCount}/${totalCount} checks passed`);
        expect(totalCount, 'Should have at least one comparison to verify').toBeGreaterThan(0);
    });
});
