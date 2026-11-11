const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};
contextBridge.exposeInMainWorld('wordbridge', {
  state: () => invoke('state'),
  saveMode: mode => invoke('mode:save', mode),
  addHistoryWord: (id, text) => invoke('history:add', id, text),
  translate: text => invoke('translate', text),
  cancel: () => invoke('cancel'),
  openMain: () => invoke('desktop:main'),
  hidePopup: () => invoke('desktop:hide'),
  savePrompt: text => invoke('prompt:save', text),
  resetPrompt: () => invoke('prompt:reset'),
  review: (key, day, reviewed) => invoke('review', key, day, reviewed),
  study: (key, id) => invoke('study', key, id),
  mnemonic: key => invoke('study:mnemonic', key),
  reload: () => invoke('config:reload'),
  saveConfig: input => invoke('config:save', input),
  saveShortcut: value => invoke('shortcut:save', value),
  importLibrary: name => invoke('library:import', name),
  onEvent: listener => {
    const handler = (_event, event) => listener(event);
    ipcRenderer.on('app:event', handler);
    return () => ipcRenderer.removeListener('app:event', handler);
  },
});
