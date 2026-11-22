import { expect, test, type Page } from '@playwright/test';

const fixtureHtml = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Interaction fixture</title><style>*{box-sizing:border-box}body{margin:0;font:16px system-ui}header{padding:16px;background:#172033;color:white}nav{display:flex;gap:20px;flex-wrap:wrap}nav a{color:white}main{max-width:760px;margin:auto;padding:24px}section{margin-top:35px}input{display:block;width:100%;max-width:360px;padding:12px;margin:8px 0}button{padding:12px 16px}@media(max-width:480px){main{padding:14px}h1{font-size:28px}}</style></head><body><header><nav aria-label=\"Main navigation\"><a href=\"#home\">Home</a><a href=\"#contact\">Contact</a></nav></header><main id=\"home\"><h1>Interaction fixture</h1><button id=\"toggle\" type=\"button\" aria-label=\"Show details\">Show details</button><p id=\"details\" hidden>Details are visible</p><section id=\"contact\"><h2>Contact</h2><form id=\"contact-form\"><label for=\"email\">Email</label><input id=\"email\" name=\"email\" type=\"email\" required><button type=\"submit\">Send message</button></form><p id=\"form-status\" role=\"status\"></p></section></main><script>document.querySelector('#toggle').addEventListener('click',()=>{const d=document.querySelector('#details');d.hidden=!d.hidden;document.querySelector('#toggle').textContent=d.hidden?'Show details':'Hide details';document.querySelector('#toggle').setAttribute('aria-label',d.hidden?'Show details':'Hide details')});document.querySelector('#contact-form').addEventListener('submit',e=>{e.preventDefault();document.querySelector('#form-status').textContent='Message ready'});</script></body></html>";

const fixture = [{
  id: 'workspace-e2e', name: 'E2E workspace',
  projects: [{
    id: 'project-e2e', name: 'Interaction test site', updated: 1,
    plan: ['Create a responsive site', 'Verify interactions'],
    files: [
      { path: 'index.html', content: fixtureHtml.replace('<style>', '<link rel="stylesheet" href="styles.css"><style>') },
      { path: 'styles.css', content: '*{box-sizing:border-box}body{margin:0;font:16px system-ui}header{padding:16px;background:#172033;color:white}nav{display:flex;gap:20px;flex-wrap:wrap}nav a{color:white}main{max-width:760px;margin:auto;padding:24px}section{margin-top:35px}input{display:block;width:100%;max-width:360px;padding:12px;margin:8px 0}button{padding:12px 16px}@media(max-width:480px){main{padding:14px}h1{font-size:28px}}' },
      { path: 'app.js', content: '' }
    ]
  }]
}];

async function openApp(page: Page) {
  await page.addInitScript((data) => localStorage.setItem('codera-workspaces-v1', JSON.stringify(data)), fixture);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open project Interaction test site' }).click();
  if ((page.viewportSize()?.width || 1280) < 768) {
    await page.getByRole('button', { name: 'Preview' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Interaction test site' })).toBeVisible();
}

test('Codera preview audit runs safe button, navigation, and form checks', async ({ page }) => {
  await openApp(page);
  await expect(page.getByText('Automated preview tests')).toBeVisible();
  await expect(page.getByText(/Safe button interactions/)).toBeVisible();
  await expect(page.getByText(/In-page navigation behavior/)).toBeVisible();
  await expect(page.getByText(/Form validation 1/)).toBeVisible();
  const source = await page.locator('iframe[title="Website preview"]').evaluate(el => (el as HTMLIFrameElement).srcdoc);
  expect(source).toContain('Interaction fixture');
  expect(source).toContain('Details are visible');
});

test('generated website buttons, navigation, and forms work in a browser', async ({ page }) => {
  const site = await page.context().newPage();
  await site.setContent(fixtureHtml);
  const toggle = site.getByRole('button', { name: 'Show details' });
  await expect(site.locator('#details')).toBeHidden();
  await toggle.click();
  await expect(site.locator('#details')).toBeVisible();
  await expect(site.getByRole('button', { name: 'Hide details' })).toBeVisible();
  await site.getByRole('link', { name: 'Contact' }).click();
  await expect.poll(() => site.evaluate(() => location.hash)).toBe('#contact');
  await expect(site.locator('#contact')).toBeInViewport();
  const email = site.getByLabel('Email');
  expect(await email.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false);
  await email.fill('builder@example.com');
  expect(await email.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(true);
  await site.getByRole('button', { name: 'Send message' }).click();
  await expect(site.getByRole('status')).toHaveText('Message ready');
  await site.close();
});

for (const width of [375, 768, 1280]) {
  test('Codera studio layout and preview checks work at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    await expect(page.getByText('Automated preview tests')).toBeVisible();
    await expect(page.getByText(/Current viewport fit/)).toBeVisible();
    const dimensions = await page.locator('html').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
    const columns = await page.locator('.workspace-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width < 768 ? 1 : 2);
    const source = await page.locator('iframe[title="Website preview"]').evaluate(el => (el as HTMLIFrameElement).srcdoc);
    expect(source).toContain('Interaction fixture');
  });
}

test('failed preview audits are sent to the repair engine and retested', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/generate', async route => {
    requests++;
    const html = requests === 1
      ? '<!doctype html><html lang="en"><head><title>Needs repair</title></head><body><main><h1>Needs repair</h1></main></body></html>'
      : '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Repaired page</title></head><body><main><h1>Repaired page</h1></main></body></html>';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: 'Fixture build', files: [
      { path: 'index.html', content: html }, { path: 'styles.css', content: 'body{margin:0;font:16px system-ui}' }
    ] }) });
  });
  await openApp(page);
  await page.locator('.prompt-card textarea').fill('Build a simple landing page');
  await page.getByRole('button', { name: /Build project/ }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByText('Preview checks passed · ready to review')).toBeVisible();
  await expect(page.getByText('Responsive viewport')).toBeVisible();
  await expect(page.getByText(/0 failures/)).toBeVisible();
});

test('workspace and project navigation controls remain functional', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Back to projects' }).click();
  await page.getByRole('button', { name: /E2E workspace/ }).click();
  await page.getByRole('button', { name: /Create workspace/ }).click();
  await page.getByPlaceholder('e.g. Personal projects').fill('Client work');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'A workspace for your next idea.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'My first website' })).toBeVisible();
});

test('Floot-imported local workspaces and files are migrated without losing projects', async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem('codera-floot-api-v1', JSON.stringify(data)), {
    workspaces: [{ id: 'imported-workspace', name: 'Imported workspace' }],
    projects: [{
      id: 'imported-project', workspaceId: 'imported-workspace', name: 'Imported website',
      prompt: 'Keep my existing website', status: 'built',
      planJson: { features: ['Preserve the original content', 'Keep the responsive styles'] },
      updatedAt: new Date(1700000000000).toISOString()
    }],
    files: {
      'imported-project': [
        { path: 'index.html', language: 'html', content: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Migrated site</title></head><body><main><h1>Floot migration preserved</h1></main></body></html>' },
        { path: 'styles.css', language: 'css', content: 'body{font:16px system-ui}' }
      ]
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Imported website' })).toBeVisible();
  await page.getByRole('button', { name: 'Open project Imported website' }).click();
  const source = await page.locator('iframe[title="Website preview"]').evaluate(el => (el as HTMLIFrameElement).srcdoc);
  expect(source).toContain('Floot migration preserved');
  expect(source).toContain('Migrated site');
  expect(await page.evaluate(() => localStorage.getItem('codera-workspaces-v1'))).toContain('Imported website');
});

test('project builds create restorable version-history checkpoints', async ({ page }) => {
  await page.route('**/api/generate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: 'A first generated page',
        files: [
          { path: 'index.html', content: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Generated page</title></head><body><main><h1>Generated checkpoint</h1></main></body></html>' },
          { path: 'styles.css', content: 'body{margin:0;font:16px system-ui}' }
        ]
      })
    });
  });
  await openApp(page);
  await page.locator('.prompt-card textarea').fill('Build a clean responsive landing page');
  await page.getByRole('button', { name: /Build project/ }).click();
  await expect(page.getByText('Build complete · Kilo Auto Free')).toBeVisible();
  await page.getByRole('button', { name: /Version history/ }).click();
  await expect(page.getByText('Before build')).toBeVisible();
  await page.locator('.version-menu button').first().click();
  await expect.poll(async () => {
    return await page.locator('iframe[title="Website preview"]').evaluate(el => (el as HTMLIFrameElement).srcdoc);
  }).toContain('Interaction fixture');
});

test('project menu supports safe rename and confirmed deletion', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('menuitem', { name: 'Rename project' }).click();
  await page.getByLabel('Project name').fill('Renamed studio project');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { name: 'Renamed studio project' })).toBeVisible();
  await page.getByRole('button', { name: 'Project options' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('menuitem', { name: 'Delete project' }).click();
  await expect(page.getByRole('heading', { name: 'A workspace for your next idea.' })).toBeVisible();
});

test('phone layout keeps version history and ZIP export accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 820 });
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Version history' })).toBeVisible();
  await page.getByRole('button', { name: 'Project options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Export project ZIP' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export project ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/source\.zip$/);
});

test('starter website is visibly rendered inside the live preview iframe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open project My first website' }).click();
  const previewElement = page.locator('iframe[title="Website preview"]');
  const srcDoc = await previewElement.evaluate(el => (el as HTMLIFrameElement).srcdoc);
  expect(srcDoc).toContain('Make something');
  expect(srcDoc).toContain('YOUR CANVAS IS READY');
  const previewFrame = page.frameLocator('iframe[title="Website preview"]');
  await expect(previewFrame.getByRole('heading', { name: /Make something/ })).toBeVisible();
  await expect(previewFrame.getByText('YOUR CANVAS IS READY')).toBeVisible();
  await expect(previewFrame.locator('body')).toHaveCSS('background-color', 'rgb(12, 16, 32)');
});
