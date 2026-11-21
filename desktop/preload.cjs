const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('coderaDesktop', Object.freeze({
  complete: (payload) => ipcRenderer.invoke('codera:kilo', payload)
}));
