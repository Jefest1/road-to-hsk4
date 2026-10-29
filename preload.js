const { contextBridge, ipcRenderer } = require("electron");

// The page only gets these three things. It cannot reach Node or the file system.
contextBridge.exposeInMainWorld("hsk", {
  version: process.env.HSK_VERSION || "",
  checkForUpdates: () => ipcRenderer.send("hsk:check-updates"),
  onUpdateStatus: (fn) => ipcRenderer.on("hsk:update-status", (_e, msg) => fn(String(msg)))
});
