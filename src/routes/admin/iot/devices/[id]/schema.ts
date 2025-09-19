import { z } from 'zod';

// Device status options
export const DEVICE_STATUSES = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'DISABLED', label: 'Disabled' }
] as const;

// Device type options
export const DEVICE_TYPES = [
    { value: 'SENSOR', label: 'Sensor' },
    { value: 'GATEWAY', label: 'Gateway' },
    { value: 'CAMERA', label: 'Camera' },
    { value: 'CONTROLLER', label: 'Controller' },
    { value: 'OTHER', label: 'Other' }
] as const;

// Schema for device edit form
export const deviceEditSchema = z.object({
    id: z.string(),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().nullable(),
    status: z.string(),
    deviceType: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    manufacturer: z.string().optional().nullable(),
    osVersion: z.string().optional().nullable(),
    firmwareVersion: z.string().optional().nullable(),
    hardwareId: z.string().optional().nullable(),
    macAddress: z.string().optional().nullable(),
    wifiMac: z.string().optional().nullable(),
    lanMac: z.string().optional().nullable(),
    ipAddress: z.string().optional().nullable(),
    // API key is read-only in the form, managed through separate actions
    apiKey: z.string().optional().nullable(),
});

export type DeviceEditSchema = typeof deviceEditSchema;
