const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  refresh: () => ipcRenderer.invoke('refresh-now'),
  notify: (payload) => ipcRenderer.invoke('notify', payload),
  move: (dx, dy) => ipcRenderer.send('drag', dx, dy),
  zoom: (factor) => ipcRenderer.send('zoom', factor),
  snap: (side) => ipcRenderer.send('snap', side),
  openMenu: () => ipcRenderer.send('open-menu'),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, data) => cb(data)),
  onConfig: (cb) => ipcRenderer.on('config', (_e, cfg) => cb(cfg)),
  onShowSettings: (cb) => ipcRenderer.on('show-settings', () => cb()),
  onAgentEvent: (cb) => ipcRenderer.on('agent-event', (_e, rec) => cb(rec)),
  onFeed: (cb) => ipcRenderer.on('feed', () => cb()),
});
