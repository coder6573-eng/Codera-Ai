const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('coderaDesktop', Object.freeze({
  complete: (payload) => ipcRenderer.invoke('codera:kilo', payload),
  agent: Object.freeze({
    syncProject: (payload) => ipcRenderer.invoke('codera:agent:sync', payload),
    listFiles: (payload) => ipcRenderer.invoke('codera:agent:list', payload),
    readFile: (payload) => ipcRenderer.invoke('codera:agent:read', payload),
    writeFile: (payload) => ipcRenderer.invoke('codera:agent:write', payload),
    deleteFile: (payload) => ipcRenderer.invoke('codera:agent:delete', payload),
    searchFiles: (payload) => ipcRenderer.invoke('codera:agent:search', payload),
    runCommand: (payload) => ipcRenderer.invoke('codera:agent:command', payload)
  })
}));
