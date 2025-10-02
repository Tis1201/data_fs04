import type { DeviceProfile, DeviceProfileSetting, DeviceProfileAssignment } from '@prisma/client';


const mappingKeys: Record<string, string[]> = {
  kiosk_lock_mode: ["exit_lockdown_password"],
  download_schedule_enabled: [
    "download_schedule_frequency",
    "download_schedule_day",
    "download_schedule_time"
  ],
  reboot_schedule_enabled: [
    "reboot_schedule_frequency",
    "reboot_schedule_day",
    "reboot_schedule_time"
  ],
  power_management_schedule: [
    "power_on_datetime",
    "power_off_datetime"
  ]
};

export function mapToConfigPayload(
  deviceProfile: DeviceProfile & { settings: DeviceProfileSetting[] }
) {
  const settings = deviceProfile.settings;
  const config: Record<string, any> = Object.fromEntries(
    settings.map(({ key, value }) => [key, value])
  );

  for (const [parentKey, childKeys] of Object.entries(mappingKeys)) {
    if (parentKey in config) {
      const parentValue = config[parentKey];
      config[parentKey] = { value: parentValue };

      if (parentValue === "enabled") {
        for (const childKey of childKeys) {
          if (childKey in config) {
            config[parentKey][childKey] = config[childKey];
            delete config[childKey];
          }
        }
      } else {
        // Clean up children if parent is disabled
        for (const childKey of childKeys) {
          delete config[childKey];
        }
      }
    }
  }

  return config;
}

