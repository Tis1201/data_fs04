import { z } from 'zod';

export const PRECLAIM_SET_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' }
] as const;

export const preclaimSetEditSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE'], { required_error: 'Status is required' }),
  // Accept string from form; server will convert to Date | null
  expiresAt: z.string().optional().nullable(),
  // Optional device profile assignment
  profileId: z.string().optional().nullable()
});

export type PreclaimSetEditSchema = typeof preclaimSetEditSchema;
