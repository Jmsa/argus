import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Both src/inject/ (dev) and dist/inject/ (prod) are 2 levels below the project root,
// so this resolves to the project root in both cases.
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function ensureFresh(name: string): string {
  const srcPath = join(projectRoot, `src/inject/${name}.ts`);
  const distPath = join(projectRoot, `dist/inject/${name}.js`);
  let needsBuild = false;
  try {
    const srcMtime = statSync(srcPath).mtimeMs;
    const distMtime = statSync(distPath).mtimeMs;
    needsBuild = srcMtime > distMtime;
  } catch {
    // If src doesn't exist we're running from the npm package — dist is pre-built.
    // If dist doesn't exist and src does, we need to build.
    try {
      statSync(srcPath);
      needsBuild = true; // src exists but dist is missing
    } catch {
      needsBuild = false; // src doesn't exist, trust pre-built dist
    }
  }
  if (needsBuild) {
    execSync('npm run build:inject', { stdio: 'inherit', cwd: projectRoot });
  }
  return readFileSync(distPath, 'utf-8');
}

export const BANNER_SCRIPT = ensureFresh('banner');
