const { expect } = require('@playwright/test');

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegex(matcher) {
  if (matcher instanceof RegExp) {
    return matcher;
  }

  return new RegExp(escapeRegex(String(matcher)), 'i');
}

function matchesAny(text = '', matchers = []) {
  if (!matchers.length) {
    return true;
  }

  return matchers.some((matcher) => toRegex(matcher).test(text));
}

async function findNewActivityLogByStatusAndText(
  deviceDetailPage,
  {
    previousSignatures = [],
    statusPattern,
    textMatchers = [],
    maxRows = deviceDetailPage.maxActivityLogRows,
  }
) {
  const rowCount = Math.min(await deviceDetailPage.activityLogRows.count(), maxRows);
  const previousSignatureCountMap = deviceDetailPage.buildSignatureCountMap(previousSignatures);
  const currentSeenCountMap = new Map();

  for (let index = 0; index < rowCount; index++) {
    const row = deviceDetailPage.activityLogRows.nth(index);
    const signature = await deviceDetailPage.getActivityLogRowSignature(index);

    const currentSeenCount = (currentSeenCountMap.get(signature) || 0) + 1;
    currentSeenCountMap.set(signature, currentSeenCount);

    const previousSeenCount = previousSignatureCountMap.get(signature) || 0;
    if (currentSeenCount <= previousSeenCount) {
      continue;
    }

    const eventName = await deviceDetailPage.safeText(row.locator('.activity-col-event'));
    const descriptionText = await deviceDetailPage.safeText(
      row.locator('.activity-col-description')
    );
    const statusText = await deviceDetailPage.safeText(row.locator('.activity-col-status'));
    const rowText = ((await row.textContent().catch(() => '')) || '').trim();

    let detailsText = '';
    const expanded = await deviceDetailPage.expandActivityLogRow(index);
    if (expanded) {
      detailsText = (
        (await deviceDetailPage.getActivityLogDetailsRow(index).textContent().catch(() => '')) ||
        ''
      ).trim();
    }

    const matchesStatus = statusPattern.test(statusText);
    const matchesText =
      matchesAny(eventName, textMatchers) ||
      matchesAny(descriptionText, textMatchers) ||
      matchesAny(detailsText, textMatchers) ||
      matchesAny(rowText, textMatchers);

    if (matchesStatus && matchesText) {
      return {
        index,
        signature,
        eventName,
        descriptionText,
        statusText,
        detailsText,
        rowText,
      };
    }
  }

  return null;
}

async function waitForNewActivityLogByStatusAndText(
  deviceDetailPage,
  {
    previousSignatures = [],
    statusPattern,
    textMatchers = [],
    message,
    timeout = deviceDetailPage.timeouts?.activityLog || 90000,
    maxRows = deviceDetailPage.maxActivityLogRows,
  }
) {
  let matchedLog = null;

  await expect.poll(
    async () => {
      await deviceDetailPage.waitForActivityLogsReady();
      matchedLog = await findNewActivityLogByStatusAndText(deviceDetailPage, {
        previousSignatures,
        statusPattern,
        textMatchers,
        maxRows,
      });
      return matchedLog ? 'found' : 'not-found';
    },
    {
      timeout,
      message,
    }
  ).toBe('found');

  return matchedLog;
}

module.exports = {
  findNewActivityLogByStatusAndText,
  waitForNewActivityLogByStatusAndText,
};
