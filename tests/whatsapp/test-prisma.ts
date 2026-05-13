import { PrismaClient } from '@prisma/client';
import { join } from 'path';

// Path to the SQLite database file
const dbPath = join(process.cwd(), 'prisma', 'dev.db');
const databaseUrl = `file:${dbPath}`;

// Create a Prisma client configured to use the SQLite database
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

// Simple function to get a Prisma client without Zenstack enhancement
// This avoids the $app import issue when running standalone tests
export function getTestPrisma() {
  return prisma;
}
