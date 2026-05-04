const { expect } = require('@playwright/test');
const config = require('../../config/config-loader');
const BulkDeploymentPage = require('./bulk-deployment-page');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Bundle IDs created during the current test (via `registerDeployment`); cleared after API/UI cleanup. */
const _trackedBundleIds = [];

function trackBulkBundleId(id) {
  if (!id || typeof id !== 'string') {
    return;
  }
  if (!_trackedBundleIds.includes(id)) {
    _trackedBundleIds.push(id);
  }
}

function takePendingBulkBundleIdsForCleanup() {
  const copy = [..._trackedBundleIds];
  _trackedBundleIds.length = 0;
  return copy;
}

/**
 * Delete bundles tracked for this test (reverse creation order). Uses the same session as `page`.
 */
async function deleteTrackedBundlesForPage(page) {
  const ids = takePendingBulkBundleIdsForCleanup();
  if (!ids.length || !page) {
    return;
  }

  let origin;
  try {
    origin = bulkAppOrigin();
  } catch {
    return;
  }

  for (const id of [...ids].reverse()) {
    try {
      const res = await page.request.delete(`${origin}/api/v2/bundles/${encodeURIComponent(id)}`);
      const status = res.status();
      if (status === 200 || status === 204 || status === 404) {
        continue;
      }
      if (status === 409) {
        const bd = new BulkDeploymentPage(page, {
          appUrl: origin,
          timeout: config.timeouts?.pageLoadMs || 30000,
          registerDeployment: () => {},
        });
        await bd.gotoDetail(id).catch(() => null);
        const canDelete = await bd.isDetailActionVisible(T.DELETE).catch(() => false);
        if (canDelete) {
          await bd.deleteFromDetail(true).catch(() => null);
        }
      }
    } catch {
      // best-effort cleanup per bundle
    }
  }
}

function bulkAppOrigin() {
  if (!config?.baseURL) {
    throw new Error('Missing required config: baseURL (config/environments/<env>.js).');
  }
  return new URL(config.baseURL).origin;
}

function buildDeploymentName(prefix = 'E2E Bulk') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix} ${stamp}`;
}

function buildDraftPayload(overrides = {}) {
  const base = {
    name: overrides.name ?? buildDeploymentName(),
    targetOS: T.FORM.ANDROID,
    version: overrides.version ?? '1.0.0',
    batchSize: overrides.batchSize ?? 100,
    schedule: overrides.schedule ?? T.FORM.NONE,
    description: overrides.description ?? 'E2E draft created by automation.',
    rebootDevice: overrides.rebootDevice ?? false,
    forceUpdate: overrides.forceUpdate ?? false,
  };
  const merged = { ...base, ...overrides };
  if (merged.version !== undefined && String(merged.version).trim() === '') {
    merged.version = '1.0.0';
  }
  return merged;
}

function createBulkPage(page, options = {}) {
  const userReg = typeof options.registerDeployment === 'function' ? options.registerDeployment : () => {};
  return new BulkDeploymentPage(page, {
    ...options,
    appUrl: options.appUrl || bulkAppOrigin(),
    deploymentId: options.deploymentId,
    timeout: options.timeout || config?.timeouts?.pageLoadMs || 30000,
    registerDeployment: (created) => {
      if (created?.id) {
        trackBulkBundleId(created.id);
      }
      userReg(created);
    },
  });
}

/**
 * Create a Draft from the Add Deployment flow and land on Deployment Detail (Devices tab by default).
 */
async function createDraftOpenDetail(page, payloadOverrides = {}, registry = {}) {
  const bd = createBulkPage(page, {
    registerDeployment: (created) => {
      registry.lastDeployment = created;
    },
  });
  const data = buildDraftPayload(payloadOverrides);
  const created = await bd.createDraftDeployment(data);
  await bd.waitForPageReady();
  return { bulkPage: bd, deploymentId: created.id, payload: data };
}

/** Same as create draft + detail, then Apps tab (legacy BD-APPS / TC-BULK-APPS-*). */
async function openDeploymentForAppsTab(page, registry = {}) {
  const { bulkPage, deploymentId, payload } = await createDraftOpenDetail(page, {}, registry);
  await bulkPage.openAppsTab();
  return { bulkPage, deploymentId, payload };
}

/** `daysAhead` must keep datetime strictly in the future for the Add modal validator. */
function buildFutureSchedulePayload(daysAhead = 45) {
  const d = new Date();
  const addDays = Number.isFinite(Number(daysAhead)) ? Number(daysAhead) : 45;
  d.setDate(d.getDate() + addDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    schedule: T.FORM.FUTURE,
    scheduleDate: `${y}-${m}-${day}`,
    scheduleTime: '09:00',
  };
}

/**
 * Create draft then assign apps/devices on detail (TC-BULK-CREATE-001/002 style).
 */
async function createDraftWithAssignments(page, options = {}) {
  const {
    payloadOverrides = {},
    appNames = [],
    deviceNames = [],
    registry = {},
  } = options;
  const bd = createBulkPage(page, {
    registerDeployment: (c) => {
      registry.lastDeployment = c;
    },
  });
  const data = buildDraftPayload(payloadOverrides);
  const created = await bd.createDraftDeployment(data);
  await bd.waitForPageReady();
  if (appNames.length) {
    await bd.addAppsByNames(appNames);
  }
  if (deviceNames.length) {
    await bd.addDevicesByNames(deviceNames);
  }
  return { bulkPage: bd, deploymentId: created.id, payload: data };
}

async function assertListPageStructure(bd) {
  await expect(bd.listTitle.first()).toBeVisible();
  await expect(bd.searchInput).toBeVisible();
  await expect(bd.addDeploymentButton).toBeVisible();
  for (const column of [
    T.LIST_COL_DEPLOYMENT_NAME,
    T.LIST_COL_VERSION,
    T.LIST_COL_START_ON,
    T.LIST_COL_END_ON,
    T.LIST_COL_STATUS,
    T.LIST_COL_ACTIONS,
  ]) {
    await expect(bd.getListColumnHeaderText(column)).toBeVisible();
  }
}

async function assertDeploymentDetailShell(bd) {
  await expect(bd.pageTitle).toBeVisible();
  await expect(bd.overviewTitle).toBeVisible();
  await expect(bd.devicesTab).toBeVisible();
  await expect(bd.appsTab).toBeVisible();
  await expect(bd.batchesTab).toBeVisible();
}

async function assertDevicesTabIsDefault(bd) {
  await assertDeploymentDetailShell(bd);
  await expect(bd.deploymentDeviceTitle).toBeVisible();
  await expect(bd.deploymentAppsTitle).toBeHidden();
}

async function assertOverviewKeyFieldsVisible(bd) {
  const labels = [
    T.OVERVIEW_FIELD_DEPLOYMENT_NAME,
    T.OVERVIEW_FIELD_STATUS,
    T.OVERVIEW_FIELD_TARGET_OS,
    T.OVERVIEW_FIELD_VERSION,
    T.OVERVIEW_FIELD_BATCH_SIZE,
    T.OVERVIEW_FIELD_START_ON,
    T.OVERVIEW_FIELD_END_ON,
    T.OVERVIEW_FIELD_DESCRIPTION,
    T.OVERVIEW_FIELD_REBOOT_DEVICE,
    T.OVERVIEW_FIELD_FORCE_UPDATE,
  ];
  for (const label of labels) {
    await bd.expectOverviewFieldVisible(label);
  }
}

/**
 * Assert Add App modal structure: TC-BULK-APPS-001 / TC-BULK-DEVICES-001 pattern.
 */
async function assertAddAppModalStructure(bd, dialog) {
  await expect(dialog.getByRole('heading', { name: T.DIALOG_ADD_APP })).toBeVisible();
  await expect(bd.getAddAppSearchInput()).toBeVisible();
  await expect(dialog.getByText(T.SELECTED_ZERO_ITEMS)).toBeVisible();
  await expect(dialog.getByRole('button', { name: T.ASSIGN })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: T.CANCEL })).toBeVisible();
}

async function assertAddAppModalInvalidSearch(bd, keyword) {
  await bd.searchAppInAddModal(keyword);
  await expect(bd.getNoAppsMatchText()).toBeVisible({ timeout: bd.timeout });
  const dialog = bd.dialogByTitle(T.DIALOG_ADD_APP);
  await expect(dialog.getByRole('button', { name: T.ASSIGN })).toBeDisabled();
}

async function assertAddDeviceModalShell(bd, dialog) {
  await expect(dialog.getByRole('heading', { name: T.DIALOG_ADD_DEVICE })).toBeVisible();
  await expect(bd.getAddDeviceSearchInput()).toBeVisible();
  await expect(bd.getAddDeviceSelectedCount()).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: new RegExp(`^${escapeRegExp(T.ADD)}$`) })
  ).toBeDisabled();
}

async function assertAddDeviceModalInvalidSearch(bd, keyword) {
  await bd.searchDeviceInAddModal(keyword);
  await expect(bd.getNoDevicesFoundText()).toBeVisible({ timeout: bd.timeout });
  const dialog = bd.dialogByTitle(T.DIALOG_ADD_DEVICE);
  await expect(
    dialog.getByRole('button', { name: new RegExp(`^${escapeRegExp(T.ADD)}$`) })
  ).toBeDisabled();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  BULK_DEPLOYMENT,
  T,
  bulkAppOrigin,
  buildDeploymentName,
  buildDraftPayload,
  createBulkPage,
  deleteTrackedBundlesForPage,
  createDraftOpenDetail,
  openDeploymentForAppsTab,
  buildFutureSchedulePayload,
  createDraftWithAssignments,
  assertListPageStructure,
  assertDeploymentDetailShell,
  assertDevicesTabIsDefault,
  assertOverviewKeyFieldsVisible,
  assertAddAppModalStructure,
  assertAddAppModalInvalidSearch,
  assertAddDeviceModalShell,
  assertAddDeviceModalInvalidSearch,
};
