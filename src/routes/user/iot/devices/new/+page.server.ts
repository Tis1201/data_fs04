import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

// Define the PIN code schema
const pinSchema = z.object({
    pin: z.string()
        .min(6, { message: "PIN code must be 6 digits" })
        .max(6, { message: "PIN code must be 6 digits" })
        .regex(/^\d+$/, { message: "PIN code must contain only digits" })
});

// Load function to provide the form schema for client-side validation
export const load = restrict(
    async () => {
        // Initialize the PIN claim form
        const pinForm = await superValidate(zod(pinSchema));

        return {
            pinForm
        };
    },
    [SystemRole.USER] // Restrict to authenticated users
) satisfies PageServerLoad;

// No actions needed as device claim is handled through SSE
