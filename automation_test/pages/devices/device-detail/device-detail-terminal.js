const { parseCommandOutput, parseTechDetailsBatch, parseNetworkDetailsBatch } = require('../../../utils/terminal-helpers');

const deviceDetailTerminal = {
  // ── Terminal Navigation ────────────────────────────────────────────

  async gotoTerminal() {
    await this.page.goto(this.terminalUrl);
    await this.page.waitForLoadState('domcontentloaded');

    for (let fullRetry = 0; fullRetry < 2; fullRetry++) {
      if (fullRetry > 0) {
        console.log('  [WARN] Terminal not responsive, reloading page...');
        await this.page.reload();
        await this.page.waitForLoadState('domcontentloaded');
      }

      await this.xtermContainer.waitFor({ state: 'visible', timeout: 15000 });

      for (let i = 0; i < 15; i++) {
        await this.page.waitForTimeout(2000);
        const text = await this.xtermRows.innerText().catch(() => '');
        if (text.includes('Terminal Ready')) break;
      }

      await this.xtermContainer.click();
      await this.page.waitForTimeout(500);
      await this.xtermTextarea.focus();
      await this.page.keyboard.press('Enter');

      for (let j = 0; j < 10; j++) {
        await this.page.waitForTimeout(1000);
        const t = await this.xtermRows.innerText().catch(() => '');
        if (/[$#]\s*$/.test(t.trim())) break;
      }

      await this.xtermContainer.click();
      await this.xtermTextarea.focus();
      await this.page.keyboard.type('echo TERM_OK', { delay: 80 });
      await this.page.keyboard.press('Enter');

      let termOkFound = false;
      for (let k = 0; k < 10; k++) {
        await this.page.waitForTimeout(1000);
        const t2 = await this.xtermRows.innerText().catch(() => '');
        if (t2.includes('TERM_OK') && !t2.trim().endsWith('echo TERM_OK')) {
          termOkFound = true;
          break;
        }
      }

      if (termOkFound) {
        await this.page.waitForTimeout(2000);
        await this.xtermContainer.click();
        await this.xtermTextarea.focus();
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(1000);
        return true;
      }

      await this.page.keyboard.press('Control+c');
      await this.page.waitForTimeout(1000);
    }

    console.log('  [ERROR] Terminal not responsive after all retries');
    return false;
  },

  // ── Run Commands ───────────────────────────────────────────────────

  async runTerminalCommand(cmd, timeoutMs = 15000) {
    await this.xtermContainer.click();
    await this.page.waitForTimeout(200);
    await this.xtermTextarea.focus();
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type(cmd, { delay: 50 });
    await this.page.waitForTimeout(200);
    await this.page.keyboard.press('Enter');

    let output = '';
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await this.page.waitForTimeout(500);
      output = await this.xtermRows.innerText().catch(() => '');
      const lines = output.trim().split('\n').filter(line => line.length > 0);
      if (lines.length === 0) continue;
      const lastLine = lines[lines.length - 1];
      if (/[$#]\s*$/.test(lastLine) && !lastLine.includes(cmd)) break;
    }
    return output;
  },

  async runCommandAndGetOutput(cmd, timeoutMs = 15000) {
    const rawText = await this.runTerminalCommand(cmd, timeoutMs);
    const result = parseCommandOutput(rawText, cmd);
    if (result.length > 0) return result;
    const retryText = await this.runTerminalCommand(cmd, timeoutMs + 5000);
    return parseCommandOutput(retryText, cmd);
  },

  // ── Technical Details ──────────────────────────────────────────────

  async getTerminalOSVersion() {
    return await this.runCommandAndGetOutput('getprop ro.build.version.release');
  },
  async getTerminalSDKVersion() {
    return await this.runCommandAndGetOutput('getprop ro.build.version.sdk');
  },
  async getTerminalModel() {
    return await this.runCommandAndGetOutput('getprop ro.product.model');
  },
  async getTerminalManufacturer() {
    return await this.runCommandAndGetOutput('getprop ro.product.manufacturer');
  },
  async getTerminalSerialNo() {
    return await this.runCommandAndGetOutput('getprop ro.serialno');
  },

  async getTerminalTechDetails() {
    const cmd = [
      'echo __OS__', 'getprop ro.build.version.release',
      'echo __SDK__', 'getprop ro.build.version.sdk',
      'echo __MODEL__', 'getprop ro.product.model',
      'echo __MFG__', 'getprop ro.product.manufacturer',
      'echo __SERIAL__', 'getprop ro.serialno',
      'echo __END__',
    ].join('; ');
    const raw = await this.runTerminalCommand(cmd, 10000);
    let result = parseTechDetailsBatch(raw);
    if (!result.osVersion && !result.sdkVersion && !result.model) {
      console.log('  [RETRY] getTerminalTechDetails: all empty, re-establishing terminal...');
      await this.gotoTerminal();
      const raw2 = await this.runTerminalCommand(cmd, 15000);
      result = parseTechDetailsBatch(raw2);
    }
    return result;
  },

  // ── Network Details ────────────────────────────────────────────────

  async getTerminalEth0MAC() {
    return await this.runCommandAndGetOutput('cat /sys/class/net/eth0/address');
  },
  async getTerminalWlan0MAC() {
    const raw = await this.runCommandAndGetOutput('cat /sys/class/net/wlan0/address');
    if (!raw || raw.includes('No such file') || raw.includes('cat:') || raw.includes('Permission denied')) return 'N/A';
    return raw.trim();
  },
  async getTerminalPrivateIP() {
    const raw = await this.runCommandAndGetOutput('ip addr show eth0 | grep "inet "');
    const match = raw.match(/inet\s+([\d.]+)/);
    return match ? match[1] : raw;
  },
  async getTerminalActiveInterface() {
    return await this.runCommandAndGetOutput('ip link show up | grep "state UP"');
  },
  async getTerminalWifiSSID() {
    const raw = await this.runCommandAndGetOutput('dumpsys wifi | grep mWifiInfo');
    if (!raw || raw.includes('not found') || raw.includes('dumpsys:')) return 'WIFI_NOT_FOUND';
    return raw.trim() || 'WIFI_NOT_FOUND';
  },

  async getTerminalNetworkDetails() {
    const cmd = [
      'echo __ETH0__', 'cat /sys/class/net/eth0/address',
      'echo __WLAN0__', 'cat /sys/class/net/wlan0/address 2>/dev/null || echo NO_WLAN',
      'echo __IP__', 'ip addr show eth0 | grep "inet "',
      'echo __IFACE__', 'ip link show up | grep "state UP"',
      'echo __SSID__', 'dumpsys wifi 2>/dev/null | grep mWifiInfo || echo WIFI_NOT_FOUND',
      'echo __NETEND__',
    ].join('; ');
    const raw = await this.runTerminalCommand(cmd, 15000);
    let result = parseNetworkDetailsBatch(raw);
    if (!result.eth0MAC && !result.privateIP) {
      console.log('  [RETRY] getTerminalNetworkDetails: critical values empty, retrying...');
      await this.page.keyboard.press('Control+c');
      await this.page.waitForTimeout(1000);
      await this.xtermContainer.click();
      await this.xtermTextarea.focus();
      await this.page.waitForTimeout(500);
      await this.page.keyboard.insertText(cmd);
      await this.page.waitForTimeout(500);
      await this.page.keyboard.press('Enter');
      let output2 = '';
      const startTime2 = Date.now();
      while (Date.now() - startTime2 < 15000) {
        await this.page.waitForTimeout(500);
        output2 = await this.xtermRows.innerText().catch(() => '');
        const lines = output2.trim().split('\n').filter(line => line.length > 0);
        if (lines.length > 0 && /[$#]\s*$/.test(lines[lines.length - 1])) break;
      }
      result = parseNetworkDetailsBatch(output2);
    }
    return result;
  },

  // ── System Metrics ─────────────────────────────────────────────────

  async getTerminalDiskUsage() {
    const raw = await this.runCommandAndGetOutput('df -h /data');
    const match = raw.match(/(\d+)%/);
    return match ? parseInt(match[1]) : null;
  },

  async getTerminalMemInfo() {
    const raw = await this.runCommandAndGetOutput('cat /proc/meminfo | head -3');
    const totalMatch = raw.match(/MemTotal:\s+(\d+)/);
    const availMatch = raw.match(/MemAvailable:\s+(\d+)/);
    if (totalMatch && availMatch) {
      const total = parseInt(totalMatch[1]);
      const available = parseInt(availMatch[1]);
      const usedPercent = Math.round(((total - available) / total) * 100);
      return { total, available, usedPercent, raw };
    }
    return { total: 0, available: 0, usedPercent: 0, raw };
  },

  async getTerminalUptime() {
    return await this.runCommandAndGetOutput('uptime');
  },

  // ── Configuration Details ──────────────────────────────────────────

  _cleanSettingsValue(raw) {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (/exception|error|not found|permission denied|N\/A|invalid command/i.test(trimmed)) return '';
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return lines[lines.length - 1] || '';
  },

  async getTerminalBrightness() {
    const raw = await this.runCommandAndGetOutput('settings get system screen_brightness');
    return this._cleanSettingsValue(raw);
  },
  async getTerminalVolume() {
    const raw = await this.runCommandAndGetOutput('settings get system volume_music_speaker');
    return this._cleanSettingsValue(raw);
  },
  async getTerminalTimezone() {
    return await this.runCommandAndGetOutput('getprop persist.sys.timezone');
  },
  async getTerminalScreenOrientation() {
    const raw = await this.runCommandAndGetOutput('settings get system user_rotation');
    const cleaned = this._cleanSettingsValue(raw);
    const map = { '0': 'Landscape', '1': 'Portrait', '2': 'Reverse Landscape', '3': 'Reverse Portrait' };
    return { raw: cleaned, label: map[cleaned] || cleaned };
  },
  async getTerminalDisplayResolution() {
    return await this.runCommandAndGetOutput('wm size');
  },

  async getTerminalConfigDetails() {
    const cmd = [
      'echo __BRIGHTNESS__', 'settings get system screen_brightness 2>/dev/null',
      'echo __VOLUME__', 'settings get system volume_music_speaker 2>/dev/null',
      'echo __TIMEZONE__', 'getprop persist.sys.timezone',
      'echo __ORIENTATION__', 'settings get system user_rotation 2>/dev/null',
      'echo __RESOLUTION__', 'wm size',
      'echo __CFGEND__',
    ].join('; ');
    const raw = await this.runTerminalCommand(cmd, 15000);
    let result = this._parseConfigBatch(raw);
    if (!result.brightness && !result.timezone && !result.resolution) {
      console.log('  [RETRY] getTerminalConfigDetails: all empty, retrying...');
      const raw2 = await this.runTerminalCommand(cmd, 20000);
      result = this._parseConfigBatch(raw2);
    }
    return result;
  },

  _parseConfigBatch(raw) {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const valueAfter = (startMarker, endMarker) => {
      const startIdx = lines.findLastIndex(l => l === startMarker);
      if (startIdx === -1) return '';
      const endIdx = endMarker
        ? lines.findIndex((l, i) => i > startIdx && l === endMarker)
        : lines.length;
      const actualEnd = endIdx === -1 ? lines.length : endIdx;
      const candidates = [];
      for (let i = startIdx + 1; i < actualEnd; i++) {
        const line = lines[i];
        if (/^.*[$#]\s*$/.test(line) && line.length < 40) continue;
        if (/settings\s+get|getprop\s|wm\s+size|echo\s+__/i.test(line)) continue;
        if (line.startsWith('__') && line.endsWith('__')) continue;
        if (/exception|invalid command|not found|permission denied/i.test(line)) continue;
        candidates.push(line);
      }
      return candidates.length > 0 ? candidates[candidates.length - 1] : '';
    };
    const brightness = valueAfter('__BRIGHTNESS__', '__VOLUME__');
    const volume = valueAfter('__VOLUME__', '__TIMEZONE__');
    const timezone = valueAfter('__TIMEZONE__', '__ORIENTATION__');
    const orientationRaw = valueAfter('__ORIENTATION__', '__RESOLUTION__');
    const resolution = valueAfter('__RESOLUTION__', '__CFGEND__');
    const orientationMap = { '0': 'Landscape', '1': 'Portrait', '2': 'Reverse Landscape', '3': 'Reverse Portrait' };
    return {
      brightness, volume, timezone, orientationRaw,
      orientationLabel: orientationMap[orientationRaw] || orientationRaw,
      resolution,
    };
  },
};

module.exports = deviceDetailTerminal;
