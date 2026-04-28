const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const config = require('../../config/config-loader');

class DeviceListingPage extends BasePage {
  constructor(page, deviceId) {
    super(page);
    this.url = config.pageURL.devices.url;
    this.deviceId = deviceId || null;
    this.deviceUrl = this.deviceId ? `${this.url}/${this.deviceId}` : null;

    this.tableRows = this.page.locator('table tbody tr');
    this.allBadges = this.page.locator('.badge');
    this.resourceDots = this.page.locator('.badge-dot');
    this.rowDots = (rowIndex) => this.tableRows.nth(rowIndex).locator('.badge-dot');
    this.paginationDetails = this.page.locator('.ds-pagination-details');
    this.pageNumberButtons = this.page.locator('.ds-pagination button').filter({ hasText: /^\d+$/ });
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('networkidle');
    await this.tableRows.first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async gotoPage(pageNum) {
    await this.page.goto(`${this.url}?page=${pageNum}&per_page=10&sort=name&order=asc`);
    await this.page.waitForLoadState('networkidle');
    await this.tableRows.first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async getTotalPages() {
    const pageButtons = this.pageNumberButtons;
    const count = await pageButtons.count();
    if (count === 0) return 1;
    const texts = await pageButtons.allTextContents();
    return Math.max(...texts.map(Number));
  }

  async getAllMetricBreakdown() {
    await this.goto();
    const totalPages = await this.getTotalPages();
    let online = 0, offline = 0, total = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p > 1) await this.gotoPage(p);
      online += await this.getOnlineCount();
      offline += await this.getOfflineCount();
      total += await this.getTotalDevicesCount();
    }
    return { online, offline, total };
  }

  async getAllCriticalBreakdown() {
    await this.goto();
    const totalPages = await this.getTotalPages();
    let cpu = 0, memory = 0, storage = 0, network = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p > 1) await this.gotoPage(p);
      const d = await this.getCriticalBreakdown();
      cpu += d.cpu; memory += d.memory; storage += d.storage; network += d.network;
    }
    return { cpu, memory, storage, network, total: cpu + memory + storage + network };
  }

  async getAllWarningBreakdown() {
    await this.goto();
    const totalPages = await this.getTotalPages();
    let cpu = 0, memory = 0, storage = 0, network = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (p > 1) await this.gotoPage(p);
      const d = await this.getWarningBreakdown();
      cpu += d.cpu; memory += d.memory; storage += d.storage; network += d.network;
    }
    return { cpu, memory, storage, network, total: cpu + memory + storage + network };
  }

  async getTotalDevicesCount() {
    const rowCount = await this.tableRows.count();
    return rowCount;
  }

  async getOnlineCount() {
    return await this.allBadges.filter({ hasText: 'Online' }).count();
  }

  async getOfflineCount() {
    return await this.allBadges.filter({ hasText: 'Offline' }).count();
  }

  async getBreakdownByStatus(status) {
    let targetColor = '';
    if (status === 'critical') targetColor = '#F04438';
    else if (status === 'warning') targetColor = '#F79009';
    else throw new Error('Invalid status. Use "critical" or "warning"');

    const rowCount = await this.tableRows.count();
    let cpuCount = 0, memCount = 0, diskCount = 0, netCount = 0;

    for (let i = 0; i < rowCount; i++) {
      const dots = this.rowDots(i);
      const dotCount = await dots.count();

      for (let j = 0; j < dotCount; j++) {
        const style = await dots.nth(j).getAttribute('style');
        if (style && style.includes(targetColor)) {
          if (j === 0) cpuCount++;
          else if (j === 1) memCount++;
          else if (j === 2) diskCount++;
          else netCount++;
        }
      }
    }

    return { cpu: cpuCount, memory: memCount, storage: diskCount, network: netCount, total: cpuCount + memCount + diskCount + netCount };
  }

  async getCriticalBreakdown() {
    return this.getBreakdownByStatus('critical');
  }

  async getWarningBreakdown() {
    return this.getBreakdownByStatus('warning');
  }

  async getMetricBreakdown() {
    return {
      online: await this.getOnlineCount(),
      offline: await this.getOfflineCount(),
      total: await this.getTotalDevicesCount()
    };
  }

  async gotoDeviceDetail(deviceId) {
    const deviceUrl = `${this.url}/${deviceId}`;
    await this.page.goto(deviceUrl);
    await this.page.waitForLoadState('domcontentloaded');
  }
}

module.exports = DeviceListingPage;
