import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/inject/banner.ts'],
  outfile: 'dist/inject/banner.js',
  bundle: true,
  format: 'iife',
  target: 'es2017',
  minify: true,
});

console.log('Built inject scripts: dist/inject/banner.js');
