#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const zipFilePath = path.resolve(rootDir, 'fs04_web_deploy.zip');

async function packageApp() {
  console.log('Starting simplified packaging process...');
  
  // Remove existing zip if it exists
  if (fs.existsSync(zipFilePath)) {
    console.log('Removing existing zip file...');
    await fs.remove(zipFilePath);
  }
  
  // Create the zip file
  console.log('Creating zip file...');
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  archive.pipe(output);
  
  // Add essential files to the zip
  console.log('Adding essential files to zip...');
  
  // Add build directory
  archive.directory(path.resolve(rootDir, 'build'), 'build');
  
  // Add package.json and package-lock.json
  archive.file(path.resolve(rootDir, 'package.json'), { name: 'package.json' });
  archive.file(path.resolve(rootDir, 'package-lock.json'), { name: 'package-lock.json' });
  
  // Add production server file
  archive.file(path.resolve(rootDir, 'prodServer.js'), { name: 'prodServer.js' });
  
  // Add start.sh script
  console.log('Adding start.sh script...');
  archive.file(path.resolve(rootDir, 'scripts/build/start.sh'), { name: 'start.sh' });
  
  // No need to add standalone WebSocket utilities - they're in the build directory
  console.log('WebSocket utilities are included in the build directory');
  
  // Add all necessary server-side utilities
  console.log('Adding server utilities...');
  
  // Add package.json to include dependencies
  console.log('Ensuring ws dependency is included...');
  const packageJsonContent = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
  if (!packageJsonContent.dependencies.ws) {
    packageJsonContent.dependencies.ws = '^8.0.0';
  }
  if (!packageJsonContent.dependencies.nanoid) {
    packageJsonContent.dependencies.nanoid = '^4.0.0';
  }
  // Note: We don't need to create a root node_modules directory
  // All necessary dependencies are already in build/node_modules
  
  // Add ZenStack schema
  console.log('Adding ZenStack schema...');
  archive.file(path.resolve(rootDir, 'schema.zmodel'), { name: 'schema.zmodel' });
  
  // Add Prisma schema, migrations, and seed script
  if (fs.existsSync(path.resolve(rootDir, 'prisma/schema.prisma'))) {
    archive.file(path.resolve(rootDir, 'prisma/schema.prisma'), { name: 'prisma/schema.prisma' });
    
    // Add Prisma migrations directory if it exists
    const migrationsDir = path.resolve(rootDir, 'prisma/migrations');
    if (fs.existsSync(migrationsDir)) {
      console.log('Adding Prisma migrations directory...');
      archive.directory(migrationsDir, 'prisma/migrations');
    }
    
    // Add Prisma seed script
    const seedPath = path.resolve(rootDir, 'prisma/seed.ts');
    if (fs.existsSync(seedPath)) {
      console.log('Adding Prisma seed script...');
      archive.file(seedPath, { name: 'prisma/seed.ts' });
    }
  }
  
  // ZenStack files are already copied to build/node_modules by the copy-zenstack-files.js script
  // No need to duplicate them in the root node_modules
  console.log('ZenStack files are already included in build/node_modules');
  
  // WhatsApp auth directory is not needed
  console.log('Skipping WhatsApp auth directory - not needed for deployment');
  
  // Add environment files
  if (fs.existsSync(path.resolve(rootDir, '.env.example'))) {
    archive.file(path.resolve(rootDir, '.env.example'), { name: '.env.example' });
  }
  
  // Add actual .env file if it exists
  if (fs.existsSync(path.resolve(rootDir, '.env'))) {
    console.log('Adding .env file...');
    archive.file(path.resolve(rootDir, '.env'), { name: '.env' });
  }
  
  // Add Prisma database file and move it to the root
  // const prismaDbPath = path.resolve(rootDir, 'prisma/dev.db');
  // if (fs.existsSync(prismaDbPath)) {
  //   console.log('Adding Prisma database file to root...');
  //   archive.file(prismaDbPath, { name: 'dev.db' });
  // }
  
  // Create a README with deployment instructions
  console.log('Creating deployment README...');
  const readmeContent = `# FS04 Web Application Deployment

## Deployment Steps

1. Unzip this package into your application directory

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your production settings
   nano .env
   \`\`\`

3. Install dependencies (REQUIRED):
   \`\`\`bash
   # Make sure you're using Node.js 18+ (use nvm if needed)
   node -v
   # If needed: nvm use 18 (or higher)
   
   # Install dependencies - THIS STEP IS REQUIRED
   npm install
   \`\`\`

4. Generate ZenStack and Prisma files:
   \`\`\`bash
   # Generate ZenStack files
   npx zenstack generate
   
   # Generate Prisma client
   npx prisma generate
   \`\`\`

5. Run database migrations (if needed):
   \`\`\`bash
   # Run Prisma migrations
   npx prisma migrate deploy
   \`\`\`

6. Start the production server:
   
   \`\`\`bash
   # Run the server with WebSocket support
   NODE_ENV=production node prodServer.js
   \`\`\`
   
   Or using PM2 for production deployment:
   \`\`\`bash
   # Install PM2
   npm install -g pm2
   
   # Start with PM2
   pm2 start "NODE_ENV=production node prodServer.js" --name "fs04_web"
   
   # Make PM2 start on system boot
   pm2 startup
   pm2 save
   \`\`\`

## Important Notes

- The server will automatically detect and use WebSocket functionality
- Environment variables must be configured on the server (especially DATABASE_URL)
- The application requires Node.js 18+ to run properly
- The SQLite database file is included at the root as 'dev.db'
- Update your DATABASE_URL in .env to point to the correct location: 'file:./dev.db'
- Always run ZenStack generate before Prisma generate to ensure proper security rules
- Use Actions instead of API endpoints for data operations (following project standards)
- The application uses shadcn-svelte for UI components
`;

  // Add the README to the zip
  archive.append(readmeContent, { name: 'README.md' });
  
  // Finalize the archive
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.finalize();
  });
  
  console.log(`Packaging complete! Zip file created at: ${zipFilePath}`);
  console.log(`Size: ${(fs.statSync(zipFilePath).size / 1024 / 1024).toFixed(2)} MB`);
}

packageApp().catch(err => {
  console.error('Error during packaging:', err);
  process.exit(1);
});
