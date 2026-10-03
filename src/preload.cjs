const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};
contextBridge.exposeInMainWorld('wordbridge', {
  state: () => invoke('state'),
  translate: text => invoke('translate', text),
  cancel: () => invoke('cancel'),
  savePrompt: text => invoke('prompt:save', text),
  resetPrompt: () => invoke('prompt:reset'),
  review: (key, day, reviewed) => invoke('review', key, day, reviewed),
  reload: () => invoke('config:reload'),
  importLibrary: name => invoke('library:import', name),
  onEvent: listener => {
    const handler = (_event, event) => listener(event);
    ipcRenderer.on('app:event', handler);
    return () => ipcRenderer.removeListener('app:event', handler);
  },
});
