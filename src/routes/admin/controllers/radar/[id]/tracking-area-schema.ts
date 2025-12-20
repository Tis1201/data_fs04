import { z } from 'zod';

export const trackingAreaSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    startX: z.number().min(-50, 'Start X must be greater than -50').max(50, 'Start X must be less than 50'),
    startY: z.number().min(-50, 'Start Y must be greater than -50').max(50, 'Start Y must be less than 50'),
    endX: z.number().min(-50, 'End X must be greater than -50').max(50, 'End X must be less than 50'),
    endY: z.number().min(-50, 'End Y must be greater than -50').max(50, 'End Y must be less than 50'),
    description: z.string().optional()
}).refine(
    (data) => data.endX > data.startX,
    {
        message: "End X must be greater than Start X",
        path: ["endX"]
    }
).refine(
    (data) => data.endY > data.startY,
    {
        message: "End Y must be greater than Start Y",
        path: ["endY"]
    }
);

export type TrackingAreaSchema = typeof trackingAreaSchema;
