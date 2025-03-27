#!/usr/bin/env node
/**
 * This script patches Prisma imports in the build output to be compatible with ESM
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.resolve(rootDir, 'build');

async function main() {
  console.log('Fixing Prisma imports in build files...');
  
  // Find all JS files in the build directory that might import Prisma
  const files = globSync('**/*.js', { 
    cwd: buildDir, 
    absolute: true,
    ignore: ['**/node_modules/**']
  });
  
  let fixCount = 0;
  
  for (const file of files) {
    let content = await fs.readFile(file, 'utf8');
    
    // Check if the file imports PrismaClient directly
    if (content.includes('import { PrismaClient } from') || 
        content.includes("import { PrismaClient }from")) {
      
      // Replace the direct import with our compatibility import
      content = content.replace(
        /import\s*{\s*PrismaClient\s*}\s*from\s*['"]@prisma\/client['"]/g,
        "import { PrismaClient } from '../prisma-compat.js'"
      );
      
      await fs.writeFile(file, content, 'utf8');
      fixCount++;
      console.log(`Fixed Prisma import in: ${path.relative(rootDir, file)}`);
    }
  }
  
  console.log(`Fixed Prisma imports in ${fixCount} files`);
}

main().catch(err => {
  console.error('Error fixing Prisma imports:', err);
  process.exit(1);
});
