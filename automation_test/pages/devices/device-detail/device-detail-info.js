const deviceDetailInfo = {
  // ── Extract All UI Fields ──────────────────────────────────────────

  async extractAllFieldValues() {
    return await this.page.evaluate(() => {
      const vals = {};
      const labels = [
        'Connection Status', 'Last ping', 'Public IP', 'LAN MAC', 'Wi-Fi MAC',
        'Device Uptime', 'CPU', 'MEM', 'DSK',
        'Device State', 'Device Name', 'Assigned Profile', 'Description',
        'OS Version', 'Firmware', 'Model', 'Operating System', 'Manufacturer', 'Hardware ID',
        'Network Interface', 'Wi-Fi SSID', 'Signal Strength', 'Private IP', 'Primary MAC',
        'API Key',
      ];
      const allElements = document.querySelectorAll('div, span, p, dt, td, label');
      for (const el of allElements) {
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent.trim())
          .join('');
        if (labels.includes(directText)) {
          const parent = el.parentElement;
          if (!parent) continue;
          const siblings = Array.from(parent.children);
          const idx = siblings.indexOf(el);
          let value = '';
          if (idx >= 0 && idx < siblings.length - 1) {
            value = siblings[idx + 1].textContent.trim();
          } else if (parent.children.length > 1) {
            value = parent.lastElementChild.textContent.trim();
          }
          const key = directText;
          if (vals[key]) {
            vals[key + '_network'] = value;
          } else {
            vals[key] = value;
          }
        }
      }
      return vals;
    });
  },

  // ── Device Health Metrics ──────────────────────────────────────────

  async getHealthMetrics() {
    const fields = await this.extractAllFieldValues();
    return {
      uptime: fields['Device Uptime'] || null,
      cpu: fields['CPU'] || null,
      mem: fields['MEM'] || null,
      dsk: fields['DSK'] || null,
    };
  },

  // ── Edit Device / Security ─────────────────────────────────────────

  async openEditDeviceModal() {
    await this.editDeviceButton.click();
    await this.page.waitForTimeout(1000);
  },

  async clickCopyApiKey() {
    await this.copyApiKeyButton.click();
  },

  async clickGenerateNewKey() {
    await this.generateNewKeyButton.click();
  },
};

module.exports = deviceDetailInfo;
