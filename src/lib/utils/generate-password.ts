import { generateId } from 'lucia';

export function generateSecurePassword(): string {
    return generateId(12);
}
