// This file helps with Prisma ESM compatibility
import { PrismaClient as PrismaClientCJS } from '@prisma/client';

// Re-export as ESM
export const PrismaClient = PrismaClientCJS;
export default PrismaClientCJS;
