async function attachJson(testInfo, name, data) {
  await testInfo.attach(name, {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  });
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegExp(pattern, fallback) {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  if (typeof pattern === 'string' && pattern.trim()) {
    return new RegExp(pattern, 'i');
  }

  if (fallback instanceof RegExp) {
    return fallback;
  }

  return new RegExp(String(fallback || ''), 'i');
}

function escapeShellDoubleQuotes(value = '') {
  return String(value).replace(/(["\\$`])/g, '\\$1');
}

function escapeShellSingleQuotes(value = '') {
  return String(value).replace(/'/g, `'\\''`);
}

function buildPrintfMarkerCommand(marker = '') {
  const normalizedMarker = String(marker);
  const splitIndex = Math.ceil(normalizedMarker.length / 2);
  const firstPart = escapeShellSingleQuotes(normalizedMarker.slice(0, splitIndex));
  const secondPart = escapeShellSingleQuotes(normalizedMarker.slice(splitIndex));

  return `printf '%s%s\\n' '${firstPart}' '${secondPart}'`;
}

function buildDelimitedCommand(command, startMarker, endMarker) {
  return [
    buildPrintfMarkerCommand(startMarker),
    command,
    buildPrintfMarkerCommand(endMarker),
  ].join('; ');
}

function extractLastDelimitedText(output = '', startMarker = '', endMarker = '') {
  const normalizedOutput = String(output);
  const startIndex = normalizedOutput.lastIndexOf(String(startMarker));
  const endIndex = normalizedOutput.lastIndexOf(String(endMarker));

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return '';
  }

  return normalizedOutput
    .slice(startIndex + String(startMarker).length, endIndex)
    .trim();
}

function buildPathExistsCommand(targetPath, marker = '__E2E_EXISTS__', missingMarker = '__E2E_MISSING__') {
  const escapedPath = escapeShellDoubleQuotes(targetPath);

  return [
    `if [ -e "${escapedPath}" ]; then`,
    `  ${buildPrintfMarkerCommand(marker)};`,
    `  ls -ld "${escapedPath}";`,
    'else',
    `  ${buildPrintfMarkerCommand(missingMarker)};`,
    'fi',
  ].join(' ');
}

async function openTerminalSession(context) {
  await context.deviceDetailPage.openTerminalFromDeviceDetail();
  await context.terminalPage.waitForTerminalPageReady();
  await context.terminalPage.waitForTerminalConnected();
  await context.terminalPage.waitForShellPrompt();
}

async function withFreshPageContext(browserContext, createContext, callback) {
  const page = await browserContext.newPage();
  try {
    const context = createContext(page);
    return await callback(context, page);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = {
  attachJson,
  buildDelimitedCommand,
  buildPrintfMarkerCommand,
  buildPathExistsCommand,
  escapeRegex,
  extractLastDelimitedText,
  openTerminalSession,
  toRegExp,
  withFreshPageContext,
};
