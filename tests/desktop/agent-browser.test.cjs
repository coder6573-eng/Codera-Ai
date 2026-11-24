const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createNativeAgentService } = require('../../desktop/agent-runtime.cjs');

test('desktop agent verifies a project at desktop and mobile viewport sizes', async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'codera-browser-check-'));
  const service = createNativeAgentService(userData);
  try {
    await service.syncProject({
      projectId: 'browser-test',
      files: [
        {
          path: 'index.html',
          content: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Codera test</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>Responsive project</h1><p>Offline browser check.</p></main><script src="app.js"></script></body></html>'
        },
        {
          path: 'styles.css',
          content: '*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:system-ui}main{width:min(100% - 32px,900px);margin:48px auto;padding:24px}h1{font-size:clamp(2rem,7vw,4rem)}'
        },
        {
          path: 'app.js',
          content: "document.documentElement.dataset.ready = 'true';"
        }
      ]
    });
    const result = await service.verifyBrowser({ projectId: 'browser-test', path: 'index.html' });
    assert.equal(result.browser, 'Chromium headless (offline)');
    assert.equal(result.results.length, 2);
    assert.equal(result.passed, true);
    assert.deepEqual(result.results.map(view => view.viewport), ['desktop', 'mobile']);
    assert.ok(result.results.every(view => view.title === 'Codera test'));
    assert.ok(result.results.every(view => view.horizontalOverflow === false));
    assert.ok(result.results.every(view => view.pageErrors.length === 0));
  } finally {
    await fs.rm(userData, { recursive: true, force: true });
  }
});

test('native workspace rejects symlink paths during writes, sync, and command execution', async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'codera-symlink-check-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'codera-outside-'));
  const service = createNativeAgentService(userData);
  try {
    const workspace = await service.syncProject({
      projectId: 'symlink-test',
      files: [{ path: 'index.html', content: '<main>safe</main>' }]
    });
    await fs.symlink(outside, path.join(workspace.root, 'escape'), 'dir');
    await assert.rejects(
      service.writeFile({ projectId: 'symlink-test', path: 'escape/owned.txt', content: 'blocked' }),
      /Symbolic links are not accessible/
    );
    await assert.rejects(
      service.syncProject({ projectId: 'symlink-test', files: [{ path: 'escape/owned.txt', content: 'blocked' }] }),
      /Symbolic links are not accessible/
    );
    await assert.rejects(
      service.runCommand({ projectId: 'symlink-test', executable: 'node', args: ['--version'], cwd: 'escape', approved: false }),
      /Symbolic links are not accessible/
    );
    assert.equal(await fs.readdir(outside).then(entries => entries.length), 0);
  } finally {
    await fs.rm(userData, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});
