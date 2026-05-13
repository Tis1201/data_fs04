const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const config = require('../../config/config-loader');
const { DEVICE_DETAIL } = require('../../constants/device-detail.constants');

class DeviceTerminalPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.timeouts = {
      pageLoad: options.timeouts?.pageLoad || config.timeouts?.pageLoadMs || 30000,
      terminalReady:
        options.timeouts?.terminalReady || config.timeouts?.terminalReadyMs || 90000,
      terminalCommand:
        options.timeouts?.terminalCommand || config.timeouts?.terminalCommandMs || 60000,
    };

    this.pageTitle = this.page.getByRole('heading', {
      name: DEVICE_DETAIL.UI_TEXT.TERMINAL_PAGE_TITLE,
      exact: true,
    });

    this.terminalCardTitle = this.page.getByText(
      DEVICE_DETAIL.UI_TEXT.TERMINAL_CARD_TITLE,
      { exact: false }
    );

    this.terminalRoot = this.page.locator(DEVICE_DETAIL.SELECTORS.XTERM_ROOT).first();
    this.terminalRows = this.page.locator(DEVICE_DETAIL.SELECTORS.XTERM_ROWS).first();
    this.terminalViewport = this.page
      .locator(DEVICE_DETAIL.SELECTORS.XTERM_VIEWPORT)
      .first();
    this.terminalScreen = this.page.locator(DEVICE_DETAIL.SELECTORS.XTERM_SCREEN).first();
    this.terminalHelperTextarea = this.page.locator('.xterm-helper-textarea').first();
    this.terminalFocusTarget = this.terminalScreen
      .or(this.terminalRoot)
      .or(this.terminalViewport)
      .first();
  }

  getReadyPatterns() {
    return DEVICE_DETAIL?.PATTERNS?.TERMINAL_READY || [
      /terminal ready/i,
      /welcome to terminal/i,
      /connecting to device terminal/i,
      /terminal connected/i,
      /connected/i,
    ];
  }

  getPromptPatterns() {
    const promptPatterns = DEVICE_DETAIL?.PATTERNS?.TERMINAL_PROMPT || [
      /:\/ \$\s*$/m,
      /\$\s*$/m,
      /#\s*$/m,
      /\w+>\s*$/m,
    ];

    return promptPatterns.filter((pattern) => pattern.source !== '>\\s*$');
  }

  getErrorPatterns() {
    return DEVICE_DETAIL?.PATTERNS?.TERMINAL_ERROR || [
      /not found/i,
      /inaccessible/i,
      /unknown command/i,
      /no such file/i,
      /permission denied/i,
      /syntax error/i,
      /invalid/i,
    ];
  }

  escapeRegex(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  normalizeTerminalText(text = '') {
    return String(text)
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .trim();
  }

  async hasTerminalE2EHook() {
    return this.page
      .evaluate(() => Boolean(window.__deviceTerminalE2E))
      .catch(() => false);
  }

  async isTerminalConnectedViaHook() {
    return this.page
      .evaluate(() => Boolean(window.__deviceTerminalE2E?.isConnected?.()))
      .catch(() => false);
  }

  async getTerminalTextViaHook() {
    const bufferText = await this.page
      .evaluate(() => window.__deviceTerminalE2E?.getBufferText?.() || '')
      .catch(() => '');

    return this.normalizeTerminalText(bufferText);
  }

  async interruptViaHook() {
    return this.page
      .evaluate(() => Boolean(window.__deviceTerminalE2E?.interrupt?.()))
      .catch(() => false);
  }

  async sendInputViaHook(input) {
    return this.page
      .evaluate((value) => Boolean(window.__deviceTerminalE2E?.sendInput?.(value)), input)
      .catch(() => false);
  }

  async sendCommandViaHook(command) {
    return this.page
      .evaluate((value) => Boolean(window.__deviceTerminalE2E?.sendCommand?.(value)), command)
      .catch(() => false);
  }

  async sendTextViaCapturedListeners(text) {
    return this.page
      .evaluate((value) => {
        const capture = window.__xtermPlaywrightCapture;
        const textarea =
          capture?.helperTextarea || document.querySelector('.xterm-helper-textarea');

        if (!(textarea instanceof HTMLTextAreaElement)) {
          return false;
        }

        const listeners = Array.isArray(capture?.listeners?.input)
          ? capture.listeners.input
          : [];

        if (!listeners.length) {
          return false;
        }

        textarea.focus();
        textarea.value = value;

        const syntheticEvent = {
          data: value,
          inputType: 'insertText',
          composed: false,
          bubbles: true,
          cancelable: true,
          target: textarea,
          currentTarget: textarea,
          preventDefault() {},
          stopPropagation() {},
          stopImmediatePropagation() {},
        };

        for (const listener of listeners) {
          try {
            if (typeof listener === 'function') {
              listener.call(textarea, syntheticEvent);
            } else if (listener && typeof listener.handleEvent === 'function') {
              listener.handleEvent(syntheticEvent);
            }
          } catch {}
        }

        textarea.value = '';
        return true;
      }, text)
      .catch(() => false);
  }

  async dispatchTextToHelperTextarea(text) {
    const helperVisible = await this.terminalHelperTextarea.isVisible().catch(() => false);
    if (!helperVisible) {
      return false;
    }

    await this.terminalHelperTextarea.click({ force: true }).catch(() => {});
    await this.terminalHelperTextarea.focus().catch(() => {});

    return this.terminalHelperTextarea
      .evaluate((textarea, value) => {
        if (!(textarea instanceof HTMLTextAreaElement)) {
          return false;
        }

        textarea.focus();
        textarea.value = value;

        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          composed: false,
          data: value,
          inputType: 'insertText',
        });

        const dispatched = textarea.dispatchEvent(inputEvent);
        textarea.value = '';
        return dispatched;
      }, text)
      .catch(() => false);
  }

  async waitForTerminalPageReady() {
    await expect(
      this.pageTitle,
      'Device Terminal page heading should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await this.terminalCardTitle
      .waitFor({
        state: 'visible',
        timeout: this.timeouts.pageLoad,
      })
      .catch(() => {});

    await expect(
      this.terminalRoot,
      'Terminal root should be visible on the Terminal page.'
    ).toBeVisible({ timeout: this.timeouts.terminalReady });
  }

  async waitForTerminalConnected() {
    const readyPatterns = this.getReadyPatterns();
    const promptPatterns = this.getPromptPatterns();

    await expect.poll(
      async () => {
        const rootVisible = await this.terminalRoot.isVisible().catch(() => false);
        const rowsVisible = await this.terminalRows.isVisible().catch(() => false);
        const viewportVisible = await this.terminalViewport.isVisible().catch(() => false);
        const screenVisible = await this.terminalScreen.isVisible().catch(() => false);
        const helperVisible = await this.terminalHelperTextarea.isVisible().catch(() => false);
        const hookConnected = await this.isTerminalConnectedViaHook();

        const terminalText = await this.getTerminalText();

        const hasReadyText = readyPatterns.some((pattern) => pattern.test(terminalText));
        const hasPrompt = promptPatterns.some((pattern) => pattern.test(terminalText));

        return (
          (rootVisible &&
            (rowsVisible || viewportVisible || screenVisible) &&
            (hasReadyText || hookConnected)) ||
          hasPrompt ||
          (hookConnected && (hasReadyText || helperVisible))
        );
      },
      {
        timeout: this.timeouts.terminalReady,
        message: 'Terminal did not become ready or connected in time.',
      }
    ).toBe(true);
  }

  async focusTerminal() {
    const helperVisible = await this.terminalHelperTextarea.isVisible().catch(() => false);
    if (helperVisible) {
      await this.terminalHelperTextarea.focus().catch(() => {});
      return;
    }

    const focusTargetVisible = await this.terminalFocusTarget.isVisible().catch(() => false);
    if (focusTargetVisible) {
      await this.terminalFocusTarget.click().catch(() => {});
    }
  }

  async prepareForCommand() {
    await this.focusTerminal();
    await this.page.waitForTimeout(100);

    const interruptedThroughHook = await this.interruptViaHook();
    const interruptedThroughCapturedListeners = interruptedThroughHook
      ? false
      : await this.sendTextViaCapturedListeners('\x03');
    const interruptedThroughHelper =
      interruptedThroughHook || interruptedThroughCapturedListeners
      ? false
      : await this.dispatchTextToHelperTextarea('\x03');

    if (
      !interruptedThroughHook &&
      !interruptedThroughCapturedListeners &&
      !interruptedThroughHelper
    ) {
      await this.page.keyboard.press('Control+C').catch(() => {});
    }

    const wokePromptThroughHook = await this.sendInputViaHook('\r');
    const wokePromptThroughCapturedListeners = wokePromptThroughHook
      ? false
      : await this.sendTextViaCapturedListeners('\r');
    const wokePromptThroughHelper =
      wokePromptThroughHook || wokePromptThroughCapturedListeners
      ? false
      : await this.dispatchTextToHelperTextarea('\r');

    if (
      !wokePromptThroughHook &&
      !wokePromptThroughCapturedListeners &&
      !wokePromptThroughHelper
    ) {
      await this.focusTerminal();
      await this.page.keyboard.press('Enter').catch(() => {});
    }

    await this.waitForShellPrompt();
  }

  async sendCommand(command) {
    await this.focusTerminal();
    await this.page.waitForTimeout(100);
    const sentThroughHook = await this.sendCommandViaHook(command);

    if (sentThroughHook) {
      return;
    }

    const sentThroughCapturedListeners = await this.sendTextViaCapturedListeners(command);
    if (sentThroughCapturedListeners) {
      await this.page.waitForTimeout(100);
      const sentEnterThroughCapturedListeners = await this.sendTextViaCapturedListeners('\r');
      if (sentEnterThroughCapturedListeners) {
        return;
      }
    }

    const helperVisible = await this.terminalHelperTextarea.isVisible().catch(() => false);
    if (helperVisible) {
      await this.terminalHelperTextarea.click({ force: true }).catch(() => {});
      await this.terminalHelperTextarea.focus().catch(() => {});
      await this.page.keyboard.insertText(command).catch(() => {});
      await this.page.waitForTimeout(100);
      await this.page.keyboard.press('Enter').catch(() => {});
      return;
    }

    const helperSentCommand = await this.dispatchTextToHelperTextarea(command);
    if (helperSentCommand) {
      await this.page.waitForTimeout(100);
      const helperSentEnter = await this.dispatchTextToHelperTextarea('\r');
      if (helperSentEnter) {
        return;
      }
    }

    const helperVisibleAfterDispatch = await this.terminalHelperTextarea.isVisible().catch(() => false);
    if (helperVisibleAfterDispatch) {
      await this.terminalHelperTextarea.pressSequentially(command, { delay: 80 });
      await this.page.waitForTimeout(100);
      await this.terminalHelperTextarea.press('Enter');
      return;
    }

    await this.page.keyboard.type(command, { delay: 80 });
    await this.page.waitForTimeout(100);
    await this.page.keyboard.press('Enter');
  }

  async getTerminalText() {
    const hookText = await this.getTerminalTextViaHook();
    if (hookText) {
      return hookText;
    }

    const rowsText = this.normalizeTerminalText(
      (await this.terminalRows.textContent().catch(() => '')) || ''
    );
    const rootText = this.normalizeTerminalText(
      (await this.terminalRoot.textContent().catch(() => '')) || ''
    );
    return rowsText || rootText;
  }

  async waitForShellPrompt() {
    const promptPatterns = this.getPromptPatterns();
    const readyPatterns = this.getReadyPatterns();
    let promptWakeAttempts = 0;

    await expect.poll(
      async () => {
        const terminalText = await this.getTerminalText();
        const hasPrompt = promptPatterns.some((pattern) => pattern.test(terminalText));
        const hasReadyText = readyPatterns.some((pattern) => pattern.test(terminalText));
        const helperVisible = await this.terminalHelperTextarea.isVisible().catch(() => false);
        const hookConnected = await this.isTerminalConnectedViaHook();

        if (hasPrompt || (hasReadyText && (helperVisible || hookConnected)) || hookConnected) {
          return true;
        }

        promptWakeAttempts += 1;

        if (promptWakeAttempts === 1 || promptWakeAttempts % 5 === 0) {
          const wokePromptThroughHook = await this.sendInputViaHook('\r');
          const wokePromptThroughCapturedListeners = wokePromptThroughHook
            ? false
            : await this.sendTextViaCapturedListeners('\r');
          const wokePromptThroughHelper =
            wokePromptThroughHook || wokePromptThroughCapturedListeners
            ? false
            : await this.dispatchTextToHelperTextarea('\r');

          if (
            !wokePromptThroughHook &&
            !wokePromptThroughCapturedListeners &&
            !wokePromptThroughHelper
          ) {
            await this.focusTerminal();
            await this.page.keyboard.press('Enter').catch(() => {});
          }
        } else if (promptWakeAttempts % 3 === 0) {
          const interruptedThroughHook = await this.interruptViaHook();
          const interruptedThroughCapturedListeners = interruptedThroughHook
            ? false
            : await this.sendTextViaCapturedListeners('\x03');
          const interruptedThroughHelper =
            interruptedThroughHook || interruptedThroughCapturedListeners
            ? false
            : await this.dispatchTextToHelperTextarea('\x03');

          if (
            !interruptedThroughHook &&
            !interruptedThroughCapturedListeners &&
            !interruptedThroughHelper
          ) {
            await this.focusTerminal();
            await this.page.keyboard.press('Control+C').catch(() => {});
          }
        }

        return false;
      },
      {
        timeout: this.timeouts.terminalReady,
        message: 'Terminal did not show a usable shell prompt in time.',
      }
    ).toBe(true);
  }

  async runCommandAndWaitForOutput(command, expectedPattern) {
    await this.prepareForCommand();
    const beforeText = await this.getTerminalText();

    await this.sendCommand(command);

    let outputText = '';

    await expect.poll(
      async () => {
        outputText = await this.getTerminalText();
        return outputText !== beforeText && expectedPattern.test(outputText);
      },
      {
        timeout: this.timeouts.terminalCommand,
        message: `Terminal did not return expected output for command: ${command}`,
      }
    ).toBe(true);

    return outputText;
  }

  async runCommandAndWaitForTextChange(command) {
    await this.prepareForCommand();
    const beforeText = await this.getTerminalText();

    await this.sendCommand(command);

    let outputText = '';

    await expect.poll(
      async () => {
        outputText = await this.getTerminalText();
        return outputText !== beforeText;
      },
      {
        timeout: this.timeouts.terminalCommand,
        message: `Terminal output did not change after command: ${command}`,
      }
    ).toBe(true);

    return outputText;
  }

  async checkInstalledPackage(packageName, preferredCommands = []) {
    const packagePattern = new RegExp(this.escapeRegex(packageName), 'i');
    const explicitPackageOutputPattern = new RegExp(
      `package:\\s*.*${this.escapeRegex(packageName)}`,
      'i'
    );

    const commands = [
      ...preferredCommands.filter(Boolean),
      `pm path ${packageName}`,
      `cmd package path ${packageName}`,
      `pm list packages ${packageName}`,
      `cmd package list packages ${packageName}`,
      'pm list packages',
      'cmd package list packages',
    ];

    const seen = new Set();
    let lastOutput = '';
    let lastCommand = '';

    for (const command of commands) {
      if (!command || seen.has(command)) {
        continue;
      }

      seen.add(command);
      lastCommand = command;

      try {
        const expectsExplicitPackageOutput =
          command.includes('grep') ||
          /\bpm path\b/i.test(command) ||
          /\bpackage path\b/i.test(command) ||
          /\bpm list packages\s+\S+/i.test(command) ||
          /\bcmd package list packages\s+\S+/i.test(command);

        const expectedPattern = expectsExplicitPackageOutput
          ? command.includes('grep')
            ? packagePattern
            : explicitPackageOutputPattern
          : packagePattern;

        if (expectsExplicitPackageOutput) {
          lastOutput = await this.runCommandAndWaitForOutput(command, expectedPattern);
        } else {
          lastOutput = await this.runCommandAndWaitForTextChange(command);
        }

        if (expectedPattern.test(lastOutput)) {
          return {
            installed: true,
            command,
            output: lastOutput,
          };
        }
      } catch {
        continue;
      }
    }

    return {
      installed: false,
      command: lastCommand,
      output: lastOutput,
    };
  }

  async verifyInstalledPackage(command, packageName) {
    const result = await this.checkInstalledPackage(packageName, [command]);

    expect(
      result.installed,
      `Terminal did not confirm that package "${packageName}" is installed.`
    ).toBeTruthy();

    return result.output;
  }

  async verifyTerminalSessionReady() {
    const terminalText = await this.getTerminalText();
    const readyPatterns = this.getReadyPatterns();
    const promptPatterns = this.getPromptPatterns();

    const hasReadyText = readyPatterns.some((pattern) => pattern.test(terminalText));
    const hasPrompt = promptPatterns.some((pattern) => pattern.test(terminalText));

    expect(
      hasReadyText || hasPrompt,
      'Terminal should show ready text or a usable shell prompt.'
    ).toBeTruthy();

    return terminalText;
  }

  async runSmokeCommand(command, expectedPattern) {
    return this.runCommandAndWaitForOutput(command, expectedPattern);
  }

  async runInvalidCommand(command, expectedPattern) {
    const finalPattern =
      expectedPattern ||
      new RegExp(this.getErrorPatterns().map((pattern) => pattern.source).join('|'), 'i');

    return this.runCommandAndWaitForOutput(command, finalPattern);
  }
}

module.exports = DeviceTerminalPage;
