#!/usr/bin/env node

/**
 * Deployment Package Creator
 * 
 * This script creates a deployment package for the application.
 * It builds the application, copies all necessary files, and creates a zip file.
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

// Configuration
const BUILD_DIR = path.resolve(process.cwd(), 'build');
const DEPLOY_DIR = path.resolve(process.cwd(), 'deploy');
const OUTPUT_ZIP = path.resolve(process.cwd(), 'fs04_web_deploy.zip');
const ZENSTACK_DIRS = [
  '.zenstack',
  'node_modules/.zenstack',
  'node_modules/@zenstackhq',
  'node_modules/@prisma'
];

// Essential files to include
const ESSENTIAL_FILES = [
  'package.json',
  'package-lock.json',
  '.env.example',
  'prodServer.ts',
  'prisma/schema.prisma'
];

// Create clean deploy directory
console.log('🧹 Cleaning up previous deployment files...');
fs.removeSync(DEPLOY_DIR);
fs.removeSync(OUTPUT_ZIP);
fs.mkdirSync(DEPLOY_DIR, { recursive: true });

// Build the application if needed
if (process.argv.includes('--build') || process.argv.includes('-b')) {
  console.log('🏗️  Building application...');
  execSync('npm run build', { stdio: 'inherit' });
}

// Copy build directory
console.log('📂 Copying build directory...');
fs.copySync(BUILD_DIR, path.join(DEPLOY_DIR, 'build'));

// Copy essential files
console.log('📄 Copying essential files...');
ESSENTIAL_FILES.forEach(file => {
  const sourcePath = path.resolve(process.cwd(), file);
  const targetPath = path.join(DEPLOY_DIR, file);
  
  if (fs.existsSync(sourcePath)) {
    // Create directory if it's in a subdirectory
    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });
    
    fs.copySync(sourcePath, targetPath);
    console.log(`   ✅ Copied ${file}`);
  } else {
    console.log(`   ⚠️ Skipped ${file} (not found)`);
  }
});

// Copy ZenStack directories
console.log('🔒 Copying ZenStack files...');
ZENSTACK_DIRS.forEach(dir => {
  const sourcePath = path.resolve(process.cwd(), dir);
  const targetPath = path.join(DEPLOY_DIR, dir);
  
  if (fs.existsSync(sourcePath)) {
    // Create directory if needed
    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });
    
    fs.copySync(sourcePath, targetPath);
    console.log(`   ✅ Copied ${dir}`);
  } else {
    console.log(`   ⚠️ Skipped ${dir} (not found)`);
  }
});

// Copy WebSocket utilities
console.log('🔌 Copying WebSocket utilities...');
const wsUtilsSource = path.resolve(process.cwd(), 'src/lib/server/websocket');
const wsUtilsTarget = path.join(DEPLOY_DIR, 'src/lib/server/websocket');
fs.mkdirSync(wsUtilsTarget, { recursive: true });
fs.copySync(wsUtilsSource, wsUtilsTarget);

// Create a production-ready .env.production file
console.log('🔧 Creating production environment file...');
const envExamplePath = path.resolve(process.cwd(), '.env.example');
const envProdPath = path.join(DEPLOY_DIR, '.env.production');

if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf8')
    .split('\n')
    .map(line => {
      // Add production-specific environment variables
      if (line.trim().startsWith('NODE_ENV=')) {
        return 'NODE_ENV=production';
      }
      return line;
    })
    .join('\n');
  
  fs.writeFileSync(envProdPath, envContent);
  console.log('   ✅ Created .env.production');
}

// Create a README for deployment
console.log('📝 Creating deployment README...');
const deployReadmePath = path.join(DEPLOY_DIR, 'DEPLOY.md');
const deployReadmeContent = `# Deployment Instructions

## Quick Start

1. Unzip the deployment package:
   \`\`\`bash
   unzip fs04_web_deploy.zip -d app
   cd app
   \`\`\`

2. Install production dependencies:
   \`\`\`bash
   npm install --production
   \`\`\`

3. Configure environment variables:
   \`\`\`bash
   cp .env.production .env
   # Edit .env with your production settings
   nano .env
   \`\`\`

4. Start the production server:
   \`\`\`bash
   NODE_ENV=production npx tsx ./prodServer.ts
   # Or with PM2
   npm install -g pm2
   pm2 start npx --name "fs04_web" -- tsx ./prodServer.ts
   \`\`\`

## Environment Variables

Make sure to set these variables in your .env file:

- \`DATABASE_URL\`: PostgreSQL connection string
- \`PORT\`: Server port (defaults to 3000)
- \`NODE_ENV\`: Should be set to 'production'

## Troubleshooting

If you encounter any issues:

1. Check the logs: \`pm2 logs fs04_web\`
2. Ensure database is accessible
3. Verify environment variables are set correctly
`;

fs.writeFileSync(deployReadmePath, deployReadmeContent);
console.log('   ✅ Created DEPLOY.md');

// Create a deployment script
console.log('🚀 Creating deployment script...');
const deployScriptPath = path.join(DEPLOY_DIR, 'start.sh');
const deployScriptContent = `#!/bin/bash
# Deployment startup script

# Set environment to production
export NODE_ENV=production

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --production
fi

# Start the server
echo "Starting server..."
npx tsx ./prodServer.ts
`;

fs.writeFileSync(deployScriptPath, deployScriptContent);
fs.chmodSync(deployScriptPath, '755'); // Make executable
console.log('   ✅ Created start.sh');

// Create zip file
console.log('📦 Creating zip archive...');
const output = fs.createWriteStream(OUTPUT_ZIP);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Deployment package created: ${OUTPUT_ZIP} (${sizeInMB} MB)`);
  console.log('🎉 Done!');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(DEPLOY_DIR, false);
archive.finalize();
