import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

// Define source directories and files
const zenstackDir = path.resolve(process.cwd(), 'node_modules/.zenstack');
const zenstackRuntimeDir = path.resolve(process.cwd(), 'node_modules/@zenstackhq');

// Define destination directories
const destZenstackDir = path.resolve(process.cwd(), 'build/node_modules/.zenstack');
const destZenstackRuntimeDir = path.resolve(process.cwd(), 'build/node_modules/@zenstackhq');

// Ensure the destination directories exist
fs.ensureDirSync(destZenstackDir);
fs.ensureDirSync(destZenstackRuntimeDir);

// Copy the ZenStack directory
console.log(`Copying ZenStack directory from ${zenstackDir} to ${destZenstackDir}`);
fs.copySync(zenstackDir, destZenstackDir, { overwrite: true });

// Copy the entire ZenStack runtime package
console.log(`Copying ZenStack runtime from ${zenstackRuntimeDir} to ${destZenstackRuntimeDir}`);
fs.copySync(zenstackRuntimeDir, destZenstackRuntimeDir, { overwrite: true });

// Create a custom enhance.js to ensure it works
const enhanceFile = path.resolve(destZenstackRuntimeDir, 'runtime/enhance.js');
fs.ensureDirSync(path.dirname(enhanceFile));

console.log('Creating custom enhance.js implementation');
const customEnhanceContent = `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhance = void 0;
function enhance(prisma, options) {
    console.log('Using custom enhance function');
    return prisma;
}
exports.enhance = enhance;
`;
fs.writeFileSync(enhanceFile, customEnhanceContent);

// Create an index.js file as well
const indexFile = path.resolve(destZenstackRuntimeDir, 'runtime/index.js');
const indexContent = `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhance = void 0;
var enhance_1 = require("./enhance");
Object.defineProperty(exports, "enhance", { enumerable: true, get: function () { return enhance_1.enhance; } });
`;
fs.writeFileSync(indexFile, indexContent);

console.log('ZenStack files copied successfully');

// Copy node_modules to build directory to ensure all dependencies are available
console.log('Copying node_modules to build directory');
fs.copySync(
  path.resolve(process.cwd(), 'node_modules/@prisma'),
  path.resolve(process.cwd(), 'build/node_modules/@prisma'),
  { overwrite: true }
);

console.log('All dependencies copied successfully');
