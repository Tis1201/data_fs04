import type { DeviceProfile, DeviceProfileSetting, DeviceProfileAssignment } from '@prisma/client';

/**
 * Maps a Prisma Company model to CompanyDto
 */
export function mapToConfigPayload(deviceProfile: DeviceProfile & { settings: DeviceProfileSetting[] } & { assignments: DeviceProfileAssignment }) {
    const settings = deviceProfile.settings;

    const config = Object.fromEntries(
        settings.map(({ key, value }) => [key, value])
    );

    return config;
}