import { z } from 'zod';

export const EnvelopeSchema = z.object({
    eventId: z.string().min(1),
    payload: z.record(z.any()),
    correlationId: z.string().optional(),
    source: z.string().optional(),
    type: z.string().optional(),
    timestamp: z.string().optional()
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export function parseEnvelope(input: unknown): Envelope {
    return EnvelopeSchema.parse(input);
}
