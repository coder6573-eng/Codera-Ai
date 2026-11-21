import { expect, test, type Page } from '@playwright/test';

const fixture = [{
  id: 'workspace-e2e', name: 'E2E workspace',
  projects: [{
    id: 'project-e2e', name: 'Interaction test site', updated: 1,
    plan: ['Create a responsive site', 'Verify interactions'],
    files: [
      { path: 'index.html', content: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Interaction fixture</title><link rel="stylesheet" href="styles.css"></head><body><header><nav aria-label="Main navigation"><a href="#home">Home</a><a href="#contact">Contact</a></nav></header><main id="home"><h1>Interaction fixture</h1><button id="toggle" type="button" aria-label="Show details" data-codera-test-safe="true" data-codera-test-target="#details" data-codera-test-state="visible">Show details</button><p id="details" hidden>Details are visible</p><section id="contact"><h2>Contact</h2><form id="contact-form"><label for="email">Email</label><input id="email" name="email" type="email" required><button type="submit">Send message</button></form><p id="form-status" role="status"></p></section></main><script>document.querySelector('#toggle').addEventListener('click',()=>{const d=document.querySelector('#details');d.hidden=!d.hidden;document.querySelector('#toggle').textContent=d.hidden?'Show details':'Hide details';document.querySelector('#toggle').setAttribute('aria-label',d.hidden?'Show details':'Hide details')});document.querySelector('#contact-form').addEventListener('submit',e=>{e.preventDefault();document.querySelector('#form-status').textContent='Message ready'});</script></body></html>` },
      { path: 'styles.css', content: `*{box-sizing:border-box}body{margin:0;font:16px system-ui}header{padding:16px;background:#172033;color:white}nav{display:flex;gap:20px;flex-wrap:wrap}nav a{color:white}main{max-width:760px;margin:auto;padding:24px}section{margin-top:35px}input{display:block;width:100%;max-width:360px;padding:12px;margin:8px 0}button{padding:12px 16px}@media(max-width:480px){main{padding:14px}h1{font-size:28px}}` },
      { path: 'app.js', content: '' }
    ]
  }]
}];

async function openApp(page: Page) {
  await page.addInitScript((data) => localStorage.setItem('codera-workspaces-v1', JSON.stringify(data)), fixture);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Interaction test site' })).toBeVisible();
}

test('preview buttons execute their expected interaction', async ({ page }) => {
  await openApp(page);
  const preview = page.frameLocator('iframe[title="Website preview"]');
  await expect(preview.getByText('Details are visible')).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Hide details' })).toBeVisible();
  await preview.getByRole('button', { name: 'Hide details' }).click();
  await expect(preview.getByText('Details are visible')).toBeHidden();
  await expect(preview.getByRole('button', { name: 'Show details' })).toBeVisible();
});

test('navigation links reach their in-page destination', async ({ page }) => {
  await openApp(page);
  const preview = page.frameLocator('iframe[title="Website preview"]');
  await preview.getByRole('link', { name: 'Contact' }).click();
  await expect.poll(() => preview.locator('body').evaluate(() => location.hash)).toBe('#contact');
  await expect(preview.locator('#contact')).toBeInViewport();
  await expect(preview.locator('#contact')).toBeVisible();
});

test('forms validate required fields and submit without leaving the preview', async ({ page }) => {
  await openApp(page);
  const preview = page.frameLocator('iframe[title="Website preview"]');
  const email = preview.getByLabel('Email');
  await expect(email).toBeVisible();
  expect(await email.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false);
  await email.fill('builder@example.com');
  expect(await email.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(true);
  await preview.getByRole('button', { name: 'Send message' }).click();
  await expect(preview.getByRole('status')).toHaveText('Message ready');
});

for (const width of [375, 768, 1280]) {
  test(`preview remains usable at ${width}px viewport width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    const frame = page.frameLocator('iframe[title="Website preview"]');
    await expect(frame.getByRole('heading', { name: 'Interaction fixture' })).toBeVisible();
    const dimensions = await frame.locator('html').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}

test('workspace and project navigation controls remain functional', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /E2E workspace/ }).click();
  await page.getByRole('button', { name: /Create workspace/ }).click();
  await page.getByPlaceholder('e.g. Personal projects').fill('Client work');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('heading', { name: 'A workspace for your next idea.' })).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'My first website' })).toBeVisible();
});
