import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function exclude<T, Key extends keyof T>(
    model: T,
    keys: Key[]
): Omit<T, Key> {
    for (let key of keys) {
        delete (model as any)[key];
    }
    return model;
}
