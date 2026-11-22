import { chromium } from '@playwright/test';
const endpoint = 'http://127.0.0.1:9222';
let browser;
for (let attempt=0; attempt<40; attempt++) {
  try { browser = await chromium.connectOverCDP(endpoint); break; }
  catch { await new Promise(resolve => setTimeout(resolve, 750)); }
}
if (!browser) throw new Error('Packaged Codera window did not expose its test connection.');
try {
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0];
  if (!page) throw new Error('Packaged Codera opened no window.');
  await page.waitForSelector('.shell', { timeout: 15000 });
  if ((await page.title()) !== 'Codera AI') throw new Error('Unexpected desktop app title.');
  await page.getByRole('button', { name: /Build/ }).first().waitFor({ state:'visible' });
  const livePreview = page.frameLocator('iframe[title="Website preview"]');
  await livePreview.getByRole('heading', { name: /Make something/ }).waitFor({ state:'visible', timeout: 20000 });
  await livePreview.getByText('YOUR CANVAS IS READY').waitFor({ state:'visible', timeout: 10000 });
  const bridge = await page.evaluate(() => typeof window.coderaDesktop?.complete);
  if (bridge !== 'function') throw new Error('Secure desktop AI bridge is missing.');
  await page.screenshot({ path:'test-results/codera-desktop.png', fullPage:true });
  console.log('PASS: packaged Windows app opened, rendered the builder, and exposed its secure AI bridge.');
} finally { await browser.close(); }
