import * as esbuild from 'esbuild';
import { mkdirSync } from 'fs';

// Ensure dist directory exists
mkdirSync('dist', { recursive: true });

// Bundle code-simple.ts → dist/code.js
await esbuild.build({
  entryPoints: ['src/code-simple.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2017',
  platform: 'browser',
});

console.log('Build complete: code.js');
