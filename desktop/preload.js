const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  searchLeads: (query, city, maxLeads, existingData = [], searchFilters = {}) => ipcRenderer.invoke('search-leads', query, city, maxLeads, existingData, searchFilters),
  onSearchStatus: (callback) => ipcRenderer.on('search-status', (_event, value) => callback(value)),
  saveSession: (sessionData) => ipcRenderer.invoke('save-session', sessionData)
});
