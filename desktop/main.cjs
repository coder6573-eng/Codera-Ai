const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('node:path');
const { createNativeAgentService } = require('./agent-runtime.cjs');

const GATEWAY = 'https://ai-gateway.kilo.ai/api/v1/chat/completions';
const agentService = createNativeAgentService(app.getPath('userData'));
const assertTrustedFrame = (event) => {
  const url = event.senderFrame && event.senderFrame.url;
  if (typeof url !== 'string' || !url.startsWith('file://')) throw new Error('Untrusted renderer origin.');
};
if (process.env.CODERA_E2E === '1') app.commandLine.appendSwitch('remote-debugging-port', '9222');
const createWindow = () => {
  const win = new BrowserWindow({
    width: 1480, height: 960, minWidth: 760, minHeight: 620,
    backgroundColor: '#0b0c10', show: false,
    title: 'Codera AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};
ipcMain.handle('codera:agent:sync', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.syncProject(payload || {});
});
ipcMain.handle('codera:agent:list', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.listFiles(payload || {});
});
ipcMain.handle('codera:agent:read', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.readFile(payload || {});
});
ipcMain.handle('codera:agent:write', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.writeFile(payload || {});
});
ipcMain.handle('codera:agent:delete', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.deleteFile(payload || {});
});
ipcMain.handle('codera:agent:search', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.searchFiles(payload || {});
});
ipcMain.handle('codera:agent:command', async (event, payload) => {
  assertTrustedFrame(event);
  return agentService.runCommand(payload || {});
});

ipcMain.handle('codera:kilo', async (_event, payload) => {
  if (!payload || payload.model !== 'kilo-auto/free' || !Array.isArray(payload.messages) || payload.messages.length > 8) {
    throw new Error('Invalid AI request.');
  }
  const size = JSON.stringify(payload).length;
  if (size > 1800000) throw new Error('The AI request is too large.');
  const response = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kilocode-mode': payload.temperature === 0.25 ? 'plan' : 'code' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55000)
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Kilo Auto Free is rate-limiting requests. Try again later.');
    throw new Error('Kilo Auto Free returned an error (' + response.status + ').');
  }
  return response.json();
});
app.whenReady().then(() => {
  app.setAppUserModelId('ai.codera.app');
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
