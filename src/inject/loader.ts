import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Both src/inject/ (dev) and dist/inject/ (prod) are 2 levels below the project root,
// so this resolves to the project root in both cases.
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function ensureFresh(name: string): string {
  const srcPath = join(projectRoot, `src/inject/${name}.ts`);
  const distPath = join(projectRoot, `src/inject/dist/${name}.js`);
  let needsBuild = false;
  try {
    const srcMtime = statSync(srcPath).mtimeMs;
    const distMtime = statSync(distPath).mtimeMs;
    needsBuild = srcMtime > distMtime;
  } catch {
    needsBuild = true; // dist missing
  }
  if (needsBuild) {
    execSync('npm run build:inject', { stdio: 'inherit', cwd: projectRoot });
  }
  return readFileSync(distPath, 'utf-8');
}

export const BANNER_SCRIPT = ensureFresh('banner');
export const OVERLAY_SCRIPT = ensureFresh('overlay');
