import { customAlphabet } from 'nanoid';

const pinGenerator = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

export async function handleGetPin(): Promise<{ pin: string }> {
    const pin = pinGenerator();
    return { pin };
}