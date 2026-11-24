const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const browserCache = path.join(root, '.codera-browser-cache');
fs.mkdirSync(browserCache, { recursive: true });
const playwrightCli = path.join(path.dirname(require.resolve('playwright')), 'cli.js');
const result = spawnSync(process.execPath, [playwrightCli, 'install', 'chromium-headless-shell'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserCache },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const entries = fs.readdirSync(browserCache);
if (!entries.some(name => name.startsWith('chromium_headless_shell-'))) {
  throw new Error('Playwright headless Chromium was not installed into the package cache.');
}
console.log('Prepared offline Chromium runtime in ' + browserCache);
