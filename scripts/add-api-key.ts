import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error('API_KEY not found in .env file');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Check if the API key already exists
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        key: apiKey
      }
    });

    if (existingKey) {
      console.log('API key already exists');
      return;
    }

    // Create a system user if it doesn't exist
    let systemUser = await prisma.user.findFirst({
      where: {
        email: 'system@example.com'
      }
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: 'system@example.com',
          name: 'System User',
          systemRole: 'ADMIN'
        }
      });
      console.log('Created system user');
    }

    // Create the API key
    const newApiKey = await prisma.apiKey.create({
      data: {
        name: 'Default System API Key',
        key: apiKey,
        userId: systemUser.id,
        description: 'Default API key for system operations'
      }
    });

    console.log('API key added successfully');
  } catch (error) {
    console.error('Error adding API key:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
