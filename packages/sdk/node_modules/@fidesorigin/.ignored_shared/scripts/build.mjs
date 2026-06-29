import fs from 'fs';
import path from 'path';

// Simple build script to generate ESM wrapper files
const distDir = path.resolve('dist');

function createEsmWrapper(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Add mjs extension to imports
  const esmContent = content
    .replace(/from '\.\//g, "from './")
    .replace(/from '\.\.\//g, "from '../");
  const mjsPath = filePath.replace(/\.js$/, '.mjs');
  fs.writeFileSync(mjsPath, esmContent);
}

// Walk dist directory and create .mjs wrappers for all .js files
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.mjs')) {
      createEsmWrapper(fullPath);
    }
  }
}

if (fs.existsSync(distDir)) {
  walk(distDir);
  console.log('ESM wrappers created successfully');
} else {
  console.error('dist directory not found');
  process.exit(1);
}
