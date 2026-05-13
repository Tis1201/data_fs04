/**
 * Terminal output parsing utilities for xterm.js MQTT terminal sessions.
 * Provides helper functions to extract, normalize, and compare data between UI and Terminal.
 */

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalizes a string by trimming whitespace and converting it to lowercase.
 * @param {string} v - The raw string value.
 * @returns {string} The normalized string.
 */
const norm = (v) => (v || '').toString().trim().toLowerCase();

/**
 * Normalizes MAC addresses: converts to lowercase and replaces all '-' with ':' 
 * (e.g., '00-1A-2B' becomes '00:1a:2b').
 * @param {string} v - The raw MAC address string.
 * @returns {string} The standardized MAC address.
 */
const normMAC = (v) => norm(v).replace(/-/g, ':');

/**
 * Extracts a standard IPv4 address from a string, stripping out subnet masks 
 * or extra text (e.g., '192.168.1.1/24' becomes '192.168.1.1').
 * @param {string} v - The raw IP string.
 * @returns {string} The extracted IPv4 address.
 */
const extractIP = (v) => {
    const m = (v || '').toString().match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    return m ? m[1] : (v || '').toString().trim();
};

/**
 * Checks whether a value is considered "empty" for field validation.
 * Treats the following as empty: "", "N/A", "NA", "-"
 * Use isNotEmpty() when you need a field to have meaningful data.
 * @param {string} v - The raw value to check.
 * @returns {boolean} True if the value is empty (blank, N/A, NA, or dash).
 */
const isEmpty = (v) => {
    const s = (v || '').toString().trim().toLowerCase();
    return s === '' || s === 'n/a' || s === 'na' || s === '-';
};

/**
 * Checks whether a value has meaningful content.
 * The opposite of isEmpty().
 * @param {string} v - The raw value to check.
 * @returns {boolean} True if the value is not empty.
 */
const isNotEmpty = (v) => !isEmpty(v);

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parses raw terminal output to extract the result of a specific command.
 * It automatically filters out shell prompts, echoed commands, and known terminal noise.
 * * @param {string} rawText - The raw text buffer from the terminal.
 * @param {string} cmd - The command that was executed.
 * @returns {string} The clean output result.
 */
function parseCommandOutput(rawText, cmd) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const isPrompt = (line) => /^.*[\$#]\s*$/.test(line) && line.length < 40 && !line.includes('=');
    const cmdPrefix = cmd.substring(0, Math.min(15, cmd.length));

    let cmdEchoIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes(cmdPrefix)) {
            cmdEchoIdx = i;
            break;
        }
    }

    // Extract lines directly following the echoed command until the next prompt
    if (cmdEchoIdx >= 0) {
        const outputLines = [];
        for (let i = cmdEchoIdx + 1; i < lines.length; i++) {
            if (isPrompt(lines[i])) break;
            if (lines[i].match(/^[a-z0-9_]+@/)) break;
            outputLines.push(lines[i]);
        }
        const result = outputLines.join('\n').trim();
        if (result.length > 0) return result;
    }

    // Fallback strategy: filter out known terminal noise lines and return the remaining
    return lines.filter(l => {
        if (isPrompt(l)) return false;
        if (l.includes('Terminal Ready')) return false;
        if (l.includes('Connecting to device')) return false;
        if (l.includes('Device ID:')) return false;
        if (l.includes('Device Terminal')) return false;
        if (l.includes('TERM_OK')) return false;
        if (l.includes('echo TERM_OK')) return false;
        if (l.includes('MQTT')) return false;
        if (l.includes(cmdPrefix)) return false;
        return true;
    }).slice(-3).join('\n').trim();
}

/**
 * Parses marker-delimited batch output for device technical details (getprop commands).
 * Expected markers: __OS__, __SDK__, __MODEL__, __MFG__, __SERIAL__
 * * @param {string} raw - The raw batch output string.
 * @returns {Object} Extracted technical details.
 */
function parseTechDetailsBatch(raw) {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const isShellError = (line) => line.includes('/system/bin/sh') || line.includes('inaccessible or not found') || line.includes('not found') || line.includes('Permission denied');
    const valueAfter = (marker) => {
        const idx = lines.findLastIndex(l => l === marker);
        if (idx === -1 || idx >= lines.length - 1) return '';
        for (let i = idx + 1; i < lines.length; i++) {
            const line = lines[i];
            // Stop if we hit the next marker, a prompt, or another getprop command
            if (line.startsWith('__') && line.endsWith('__')) break;
            if (/^.*[\$#]\s*$/.test(line)) continue;
            if (line.includes('getprop ')) continue;
            if (isShellError(line)) return '';
            return line;
        }
        return '';
    };
    return {
        osVersion: valueAfter('__OS__'),
        sdkVersion: valueAfter('__SDK__'),
        model: valueAfter('__MODEL__'),
        manufacturer: valueAfter('__MFG__'),
        serialNo: valueAfter('__SERIAL__'),
    };
}

/**
 * Parses marker-delimited batch output for network details.
 * Expected markers: __ETH0__, __WLAN0__, __IP__, __IFACE__, __SSID__
 * * @param {string} raw - The raw batch output string.
 * @returns {Object} Extracted network details.
 */
function parseNetworkDetailsBatch(raw) {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const linesAfter = (marker) => {
        const startIdx = lines.findLastIndex(l => l === marker);
        if (startIdx === -1) return [];
        const result = [];
        for (let i = startIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('__') && line.endsWith('__')) break;
            if (/^.*[\$#]\s*$/.test(line)) continue;
            result.push(line);
        }
        return result;
    };

    const firstLineAfter = (marker) => {
        const arr = linesAfter(marker);
        return arr.length > 0 ? arr[0] : '';
    };

    const extractMAC = (raw) => {
        if (!raw) return raw;
        const m = raw.match(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/);
        return m ? m[0] : raw;
    };
    const eth0MAC = extractMAC(firstLineAfter('__ETH0__'));
    const wlan0Raw = firstLineAfter('__WLAN0__');
    const wlan0MAC = (!wlan0Raw || wlan0Raw.includes('NO_WLAN') || wlan0Raw.includes('No such file'))
        ? 'N/A' : extractMAC(wlan0Raw.trim());
    
    const ipLines = linesAfter('__IP__');
    const ipLine = ipLines.find(l => l.includes('inet ')) || '';
    const ipMatch = ipLine.match(/inet\s+([\d.]+)/);
    const privateIP = ipMatch ? ipMatch[1] : '';
    
    const ifaceLines = linesAfter('__IFACE__');
    const ifaceLine = ifaceLines.find(l => l.includes('state UP')) || '';
    
    const ssidRaw = firstLineAfter('__SSID__');
    const ssid = (!ssidRaw || ssidRaw.includes('WIFI_NOT_FOUND')) ? 'WIFI_NOT_FOUND' : ssidRaw.trim();

    return { eth0MAC, wlan0MAC, privateIP, activeInterface: ifaceLine, wifiSSID: ssid };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Compares a UI value against a Terminal value with optional data normalization.
 * Logs a formatted pass/fail report to the console and returns a boolean result.
 * * @param {string} label - The name of the field being compared (for logging).
 * @param {string|number} uiVal - The value extracted from the User Interface.
 * @param {string|number} terminalVal - The value extracted from the Terminal.
 * @param {Object} options - Configuration flags.
 * @param {boolean} [options.caseInsensitive=false] - If true, ignores text casing.
 * @param {number} [options.tolerance=0] - Allowed numerical difference (e.g., for fluctuating CPU/RAM).
 * @param {boolean} [options.isMAC=false] - If true, normalizes MAC address formatting before comparing.
 * @param {boolean} [options.isIP=false] - If true, extracts standard IPv4 before comparing.
 * @returns {boolean} True if values match (within tolerance), otherwise false.
 */
function compare(label, uiVal, terminalVal, { caseInsensitive = false, tolerance = 0, isMAC = false, isIP = false } = {}) {
    let ui = (uiVal ?? '').toString().trim();
    let term = (terminalVal ?? '').toString().trim();

    // Apply specific normalization logic based on the provided flags
    if (isMAC) { 
        ui = normMAC(ui); 
        term = normMAC(term); 
    } else if (isIP) {
        ui = extractIP(ui);
        term = extractIP(term);
    } else if (caseInsensitive) { 
        ui = norm(ui); 
        term = norm(term); 
    }

    let pass;
    // If a tolerance is provided, parse strings as floats and check the numerical difference
    if (tolerance > 0) {
        const uiNum = parseFloat(ui);
        const termNum = parseFloat(term);
        pass = !isNaN(uiNum) && !isNaN(termNum) && Math.abs(uiNum - termNum) <= tolerance;
    } else {
        // Perform strict string comparison
        pass = ui === term;
    }

    // Print a formatted report to the console
    const icon = pass ? '✅' : '❌';
    console.log(`  ${icon} ${label}`);
    console.log(`      UI:       "${uiVal}"`);
    console.log(`      Terminal: "${terminalVal}"`);
    
    if (!pass) {
        console.log(`      ⚠️  MISMATCH (Processed UI: "${ui}", Processed Term: "${term}")`);
    }
    
    return pass;
}

module.exports = {
    parseCommandOutput,
    parseTechDetailsBatch,
    parseNetworkDetailsBatch,
    compare,
    normMAC,
    norm,
    extractIP,
    isEmpty,
    isNotEmpty,
};