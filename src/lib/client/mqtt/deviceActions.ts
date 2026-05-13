import { browser } from '$app/environment';
import { mqttClient } from './mqttClient';
import { callUserRpc } from './userRpc';

export interface DeviceActionOptions {
  timeoutMs?: number;
}

export interface RefreshDeviceParams {
  deviceId: string;
}

export interface RebootDeviceParams {
  deviceId: string;
}

export interface UpdateFirmwareParams {
  deviceId: string;
  firmwareVersion: string;
  resourceId: string;
}

export interface InstallAppParams {
  deviceId: string;
  packageName: string;
  resourceId: string;
}

export interface PullFileParams {
  deviceId: string;
  sourcePath: string;
  destinationPath: string;
}

export interface PushFileParams {
  deviceId: string;
  sourcePath: string;
  destinationPath: string;
  resourceId: string;
}

export interface GetLogsParams {
  deviceId: string;
  format?: 'zip' | 'text';
}

export interface DeviceActionResult {
  success: boolean;
  operationId?: string;
  message?: string;
  error?: string;
}

/**
 * Refresh device (pull latest device info)
 */
export async function refreshDevice(
  params: RefreshDeviceParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 30000;

  const result = await callUserRpc<DeviceActionResult>(
    'device.refresh',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Reboot device
 */
export async function rebootDevice(
  params: RebootDeviceParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 30000;

  const result = await callUserRpc<DeviceActionResult>(
    'device.reboot',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Update device firmware
 */
export async function updateFirmware(
  params: UpdateFirmwareParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 60000; // Firmware updates might take longer

  const result = await callUserRpc<DeviceActionResult>(
    'device.firmware.update',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Install app on device
 */
export async function installApp(
  params: InstallAppParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 60000;

  const result = await callUserRpc<DeviceActionResult>(
    'device.app.install',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Restart an app on the device via MQTT RPC
 * Status messages: "restart {packageName} init/success/error: {reason}"
 */
export async function restartApp(
  params: { deviceId: string; packageName: string },
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 180000; // 3 minutes

  const result = await callUserRpc<DeviceActionResult>(
    'device.app.restart',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Uninstall an app from the device via MQTT RPC
 * Status messages: "uninstall {packageName} init/success/error: {reason}"
 */
export async function uninstallApp(
  params: { deviceId: string; packageName: string },
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 300000; // 5 minutes

  const result = await callUserRpc<DeviceActionResult>(
    'device.app.uninstall',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Configure an app on the device via MQTT RPC
 * Status messages: "config {packageName} init/success/error: {reason}"
 */
export async function configApp(
  params: { deviceId: string; packageName: string; config?: any },
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 180000; // 3 minutes

  const result = await callUserRpc<DeviceActionResult>(
    'device.app.config',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Pull file from device
 */
export async function pullFile(
  params: PullFileParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 60000;

  const result = await callUserRpc<DeviceActionResult>(
    'device.file.pull',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Push file to device
 */
export async function pushFile(
  params: PushFileParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 60000;

  const result = await callUserRpc<DeviceActionResult>(
    'device.file.push',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Get device logs
 */
export async function getDeviceLogs(
  params: GetLogsParams,
  options: DeviceActionOptions = {}
): Promise<DeviceActionResult> {
  if (!browser) {
    throw new Error('Device actions are only available in the browser');
  }

  const timeoutMs = options.timeoutMs ?? 60000;

  const result = await callUserRpc<DeviceActionResult>(
    'device.logs.get',
    params,
    { timeoutMs }
  );

  return result;
}

/**
 * Wait for action progress/completion notifications
 * 
 * Subscribe to device action status updates for a specific operation ID
 * Listens for Pushpin-style status updates (device:statusUpdate)
 */
export interface ActionProgressUpdate {
  logId: string;
  deviceId?: string;
  action: string;
  status: 'initiated' | 'in_progress' | 'success' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  result?: any;
}

export function subscribeToActionProgress(
  operationId: string,
  callback: (update: ActionProgressUpdate) => void
): () => void {
  if (!browser) {
    return () => {};
  }

  console.log('[DeviceActions] Subscribing to action progress:', operationId);

  // Subscribe to Pushpin-style status updates (same as SSE flow)
  const unsubscribeStatus = mqttClient.onNotification('device:statusUpdate', (payload: any) => {
    // Match by logId (Pushpin-style) or operationId (legacy)
    if (payload.logId === operationId || payload.operationId === operationId) {
      console.log('[DeviceActions] Received status update:', payload);
      callback(payload);
    }
  });

  // Return unsubscribe function
  return () => {
    unsubscribeStatus();
  };
}

