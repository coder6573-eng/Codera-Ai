/**
 * Native workspace service for Electron.
 *
 * Every operation is rooted inside Codera's private user-data directory.
 * The renderer never receives Node APIs or arbitrary filesystem paths.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL, fileURLToPath } = require('node:url');
function findPackageRoot(entry, marker) {
  let cursor = path.dirname(entry);
  while (cursor && cursor !== path.dirname(cursor)) {
    if (require('node:fs').existsSync(path.join(cursor, 'bin', marker))) return cursor;
    cursor = path.dirname(cursor);
  }
  throw new Error('Bundled npm runtime is missing: ' + marker);
}

const MAX_FILE_BYTES = 500_000;
const MAX_FILES = 250;
const MAX_OUTPUT_BYTES = 96_000;
const COMMAND_TIMEOUT_MS = 120_000;
const PROTECTED = new Set(['.git', 'node_modules', '.ssh', '.aws', '.azure', '.gnupg', '.config']);

const COMMANDS = new Set([
  'node', 'npm', 'npx', 'git', 'python', 'python3',
  'pytest', 'tsc', 'vite', 'eslint', 'prettier', 'rg', 'ls', 'pwd',
  'cat', 'head', 'tail', 'wc', 'find'
]);

const BLOCKED_OPTIONS = new Set(['-e', '--eval', '--require', 'push', 'pull', 'fetch', 'clone', 'remote', 'submodule', 'reset', 'clean', 'publish', 'login', 'logout', 'token', '-delete', '-exec', '-execdir']);

function projectKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) {
    throw new Error('Invalid Codera project identifier.');
  }
  return value;
}

function relativePath(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 240) throw new Error('Invalid project path.');
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) throw new Error('Absolute paths are not allowed.');
  const parts = normalized.split('/');
  if (parts.length > 24 || parts.some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe project path.');
  for (const part of parts) {
    if (!/^[a-zA-Z0-9_@.-][a-zA-Z0-9_@ .-]*$/.test(part) || part.endsWith('.') || part.endsWith(' ')) throw new Error('Unsupported path characters.');
    if (PROTECTED.has(part.toLowerCase()) || /^\.env(?:\.|$)/i.test(part)) throw new Error('Protected paths cannot be accessed by the agent.');
  }
  return parts.join(path.sep);
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function commandPolicy(executable, args, approved) {
  const name = path.basename(String(executable || '')).toLowerCase().replace(/\.exe$|\.cmd$/i, '');
  if (!COMMANDS.has(name)) throw new Error('Command is not in Codera native allowlist: ' + name);
  if (!Array.isArray(args) || args.length > 40 || !args.every(arg => typeof arg === 'string' && arg.length <= 1000)) throw new Error('Invalid command arguments.');
  if (args.some(arg => /[;&|<>\u0000\n\r`$]/.test(arg))) throw new Error('Shell operators are blocked.');
  if (args.some(arg => BLOCKED_OPTIONS.has(arg.toLowerCase()))) throw new Error('This command option is blocked.');
  if (args.some(arg => /^(?:\/|[a-zA-Z]:\\)/.test(arg))) throw new Error('Host absolute paths are blocked.');

  const first = String(args[0] || '').toLowerCase();
  const mutating = ['install', 'add', 'remove', 'update', 'upgrade', 'uninstall', 'init', 'commit', 'checkout', 'switch', 'merge', 'rebase', 'stash', 'branch'].includes(first);
  if (mutating && !approved) throw new Error('This command requires explicit user approval.');
  return name;
}

function cappedCollector() {
  let stdout = '';
  let stderr = '';
  const append = (current, chunk) => (current + chunk.toString('utf8')).slice(-MAX_OUTPUT_BYTES);
  return {
    addOut: chunk => { stdout = append(stdout, chunk); },
    addErr: chunk => { stderr = append(stderr, chunk); },
    read: () => ({ stdout, stderr })
  };
}

function createNativeAgentService(userDataPath, appOptions = {}) {
  const root = path.join(userDataPath, 'codera-agent-workspaces');
  const npmRootInPackage = findPackageRoot(require.resolve('npm'), 'npm-cli.js');
  const nodeEntry = path.join(path.dirname(npmRootInPackage), 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
  if (!require('node:fs').existsSync(nodeEntry)) throw new Error('Bundled Node.js runtime is missing: ' + nodeEntry);
  const unpackedPath = value => {
    if (!appOptions.isPackaged || !appOptions.appPath || !appOptions.resourcesPath) return value;
    return path.join(appOptions.resourcesPath, 'app.asar.unpacked', path.relative(appOptions.appPath, value));
  };
  const BUNDLED_NODE = unpackedPath(nodeEntry);
  const NPM_ROOT = unpackedPath(npmRootInPackage);

  async function projectRoot(projectId) {
    const target = path.join(root, projectKey(projectId));
    await fs.mkdir(target, { recursive: true });
    return target;
  }

  async function assertNoSymlinkPath(base, target) {
    const relative = path.relative(base, target);
    let cursor = base;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, segment);
      try {
        const stat = await fs.lstat(cursor);
        if (stat.isSymbolicLink()) throw new Error('Symbolic links are not accessible to the agent.');
      } catch (error) {
        if (error && error.code === 'ENOENT') continue;
        throw error;
      }
    }
  }

  async function resolveFile(projectId, input) {
    const base = await projectRoot(projectId);
    const target = path.resolve(base, relativePath(input));
    if (!inside(base, target)) throw new Error('Project path escaped its workspace.');
    await assertNoSymlinkPath(base, target);
    return { base, target };
  }

  async function walk(base, directory = base, output = []) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || PROTECTED.has(entry.name.toLowerCase())) continue;
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(base, full, output);
      else if (entry.isFile()) output.push(path.relative(base, full).split(path.sep).join('/'));
      if (output.length > MAX_FILES) throw new Error('Project exceeds the native agent file limit.');
    }
    return output;
  }

  async function syncProject(payload) {
    const projectId = projectKey(payload.projectId);
    if (!Array.isArray(payload.files) || payload.files.length > MAX_FILES) throw new Error('Invalid project file collection.');
    const base = await projectRoot(projectId);
    const written = new Set();
    for (const item of payload.files) {
      if (!item || typeof item.path !== 'string' || typeof item.content !== 'string') continue;
      const relative = relativePath(item.path);
      if (written.has(relative)) throw new Error('Duplicate project path: ' + relative);
      if (Buffer.byteLength(item.content, 'utf8') > MAX_FILE_BYTES) throw new Error('File is too large: ' + relative);
      written.add(relative);
      const target = path.resolve(base, relative);
      if (!inside(base, target)) throw new Error('Project path escaped its workspace.');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, item.content, 'utf8');
    }
    return { root: base, files: written.size };
  }

  async function listFiles(payload) {
    const base = await projectRoot(payload.projectId);
    return walk(base);
  }

  async function readFile(payload) {
    const { target } = await resolveFile(payload.projectId, payload.path);
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error('File is not a supported text file or exceeds the read limit.');
    return fs.readFile(target, 'utf8');
  }

  async function writeFile(payload) {
    if (typeof payload.content !== 'string' || Buffer.byteLength(payload.content, 'utf8') > MAX_FILE_BYTES) throw new Error('Invalid or oversized file content.');
    const { base, target } = await resolveFile(payload.projectId, payload.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, payload.content, 'utf8');
    const files = await walk(base);
    return { path: path.relative(base, target).split(path.sep).join('/'), files: files.length };
  }

  async function deleteFile(payload) {
    const { target } = await resolveFile(payload.projectId, payload.path);
    await fs.rm(target, { force: false });
    return { deleted: payload.path };
  }

  async function searchFiles(payload) {
    if (typeof payload.query !== 'string' || !payload.query.trim() || payload.query.length > 200) throw new Error('Invalid search query.');
    const base = await projectRoot(payload.projectId);
    const paths = await walk(base);
    const matches = [];
    const needle = payload.query.toLowerCase();
    for (const relative of paths) {
      if (matches.length >= 200) break;
      const full = path.join(base, relative);
      const stat = await fs.stat(full);
      if (stat.size > MAX_FILE_BYTES) continue;
      const text = await fs.readFile(full, 'utf8');
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length && matches.length < 200; index += 1) {
        if (lines[index].toLowerCase().includes(needle)) {
          matches.push({ path: relative, line: index + 1, text: lines[index].slice(0, 500) });
        }
      }
    }
    return matches;
  }


  async function verifyBrowser(payload) {
    const { base, target } = await resolveFile(payload.projectId, payload.path || 'index.html');
    if (path.extname(target).toLowerCase() !== '.html') throw new Error('Browser verification requires an HTML entry file.');
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error('The HTML entry file is missing or too large.');
    const browserPath = appOptions.isPackaged ? path.join(appOptions.resourcesPath, 'playwright-browsers') : process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (browserPath) process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const results = [];
    try {
      for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        const consoleErrors = [];
        const pageErrors = [];
        await page.route('**/*', async route => {
          const requestUrl = route.request().url();
          if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:')) return route.continue();
          if (!requestUrl.startsWith('file://')) return route.abort('blockedbyclient');
          try {
            const requestedPath = path.resolve(fileURLToPath(requestUrl));
            if (!inside(base, requestedPath)) return route.abort('blockedbyclient');
            return route.continue();
          } catch { return route.abort('blockedbyclient'); }
        });
        page.on('console', message => {
          if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
        });
        page.on('pageerror', error => pageErrors.push(error.message.slice(0, 500)));
        await page.goto(pathToFileURL(target).href, { waitUntil: 'load', timeout: 20000 });
        const metrics = await page.evaluate(() => ({
          title: document.title,
          bodyTextLength: (document.body?.innerText || '').trim().length,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          hasMain: Boolean(document.querySelector('main')),
          images: [...document.images].map(image => ({ alt: image.alt, loaded: image.complete && image.naturalWidth > 0 })).slice(0, 40)
        }));
        results.push({
          viewport: viewport.name,
          ...metrics,
          horizontalOverflow: metrics.documentWidth > metrics.viewportWidth + 1,
          consoleErrors,
          pageErrors
        });
        await page.close();
      }
    } finally {
      await browser.close();
    }
    return {
      browser: 'Chromium headless (offline)',
      entry: path.relative(base, target).split(path.sep).join('/'),
      passed: results.every(result => !result.horizontalOverflow && result.pageErrors.length === 0),
      results
    };
  }

  async function runCommand(payload) {
    const projectId = projectKey(payload.projectId);
    const executable = commandPolicy(payload.executable, payload.args, payload.approved === true);
    const base = await projectRoot(projectId);
    const cwdInput = payload.cwd ? relativePath(payload.cwd) : '.';
    const cwd = path.resolve(base, cwdInput);
    if (!inside(base, cwd)) throw new Error('Command working directory escaped the project.');
    await fs.mkdir(cwd, { recursive: true });

    return new Promise((resolve, reject) => {
      const collector = cappedCollector();
      const windows = process.platform === 'win32';
      const bundled = ['node', 'npm', 'npx'].includes(executable);
      const command = bundled ? BUNDLED_NODE : executable + (windows ? '.exe' : '');
      const commandArgs = executable === 'npm'
        ? [path.join(NPM_ROOT, 'bin', 'npm-cli.js'), ...payload.args]
        : executable === 'npx'
          ? [path.join(NPM_ROOT, 'bin', 'npx-cli.js'), ...payload.args]
          : payload.args;
      const child = spawn(command, commandArgs, {
        cwd,
        shell: false,
        windowsHide: true,
        env: {
          PATH: path.dirname(BUNDLED_NODE) + path.delimiter + (process.env.PATH || ''),
          HOME: process.env.HOME || userDataPath,
          USERPROFILE: process.env.USERPROFILE || userDataPath,
          TMP: process.env.TMP || userDataPath,
          TEMP: process.env.TEMP || userDataPath,
          CI: '1',
          NO_COLOR: '1'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 2500).unref();
      }, COMMAND_TIMEOUT_MS);
      child.stdout.on('data', collector.addOut);
      child.stderr.on('data', collector.addErr);
      child.once('error', error => {
        clearTimeout(timer);
        reject(new Error('Could not start ' + executable + ': ' + error.message));
      });
      child.once('close', code => {
        clearTimeout(timer);
        const output = collector.read();
        resolve({ code: typeof code === 'number' ? code : 1, ...output });
      });
    });
  }

  return Object.freeze({ syncProject, listFiles, readFile, writeFile, deleteFile, searchFiles, verifyBrowser, runCommand });
}

module.exports = { createNativeAgentService };
