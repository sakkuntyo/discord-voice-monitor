const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voiceMonitor", {
  getSnapshot: () => ipcRenderer.invoke("voice-monitor:get-snapshot"),
  onSnapshot: listener => {
    const wrapped = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on("voice-monitor:snapshot", wrapped);
    return () => ipcRenderer.removeListener("voice-monitor:snapshot", wrapped);
  }
});
