import { contextBridge, ipcRenderer } from 'electron';

const desktopAPI = {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state: unknown) => ipcRenderer.invoke('state:save', state),
  diagnostics: () => ipcRenderer.invoke('diagnostics'),
  exportBackup: (state: unknown) => ipcRenderer.invoke('backup:export', state),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  selectLogo: () => ipcRenderer.invoke('company:selectLogo'),
  writeExport: (fileName: string, bytes: number[]) => ipcRenderer.invoke('export:write', fileName, bytes),
  openPath: (target: string) => ipcRenderer.invoke('shell:openPath', target)
};

contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
contextBridge.exposeInMainWorld('saudiDevelopIQ', desktopAPI);
