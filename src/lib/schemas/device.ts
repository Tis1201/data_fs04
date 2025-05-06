import { z } from 'zod';

// Define the device schema for validation
export const deviceSchema = z.object({
    name: z.string().min(1, "Name is required"),
    deviceType: z.enum(['CAMERA', 'SENSOR', 'CONTROLLER', 'OTHER'], {
        required_error: "Device type is required",
        invalid_type_error: "Invalid device type"
    }),
    description: z.string().optional(),
    model: z.string().optional(),
    manufacturer: z.string().optional(),
    osVersion: z.string().optional(),
    firmwareVersion: z.string().optional(),
    hardwareId: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE')
});

// Type for the device schema
export type DeviceSchemaType = z.infer<typeof deviceSchema>;
