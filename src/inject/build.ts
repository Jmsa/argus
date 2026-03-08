import * as esbuild from 'esbuild';

const scripts = ['banner', 'overlay'];

for (const name of scripts) {
  await esbuild.build({
    entryPoints: [`src/inject/${name}.ts`],
    outfile: `src/inject/dist/${name}.js`,
    bundle: true,
    format: 'iife',
    target: 'es2017',
    minify: true,
  });
}

console.log('Built inject scripts: banner.js, overlay.js');
