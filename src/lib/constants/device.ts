export enum DeviceModel {
  ANDROID = 'ANDROID',
  LINUX = 'LINUX',
  WINDOW = 'WINDOW',
  MACOS = 'MACOS',
}

/**
 * Actions that should trigger reload of apps list and device info when they succeed (MQTT device:statusUpdate).
 * Matches AUTO_REFRESH_PLAN: installApp, uninstall, restartApp, updateFirmware, applyProfile, config, refresh.
 * Server/device may send snake_case or camelCase.
 */
export const REFRESH_ACTIONS_ON_SUCCESS = [
  'install_app',
  'installApp',
  'uninstall_app',
  'uninstall',
  'restart_app',
  'restartApp',
  'firmware_update',
  'updateFirmware',
  'apply_profile',
  'applyProfile',
  'config_app',
  'config_update',
  'config',
  'refresh'
] as const;

export function isRefreshAction(action: string | undefined): boolean {
  if (!action) return false;
  return REFRESH_ACTIONS_ON_SUCCESS.includes(action as any);
}