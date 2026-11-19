const { contextBridge, ipcRenderer } = require("electron");

// The page only gets these few things. It cannot reach Node or the file system,
// and it never sees the saved API key (only whether one is saved and its last 4 characters).
contextBridge.exposeInMainWorld("hsk", {
  checkForUpdates: () => ipcRenderer.send("hsk:check-updates"),
  onUpdateStatus: (fn) => ipcRenderer.on("hsk:update-status", (_e, msg) => fn(String(msg))),
  setStreak: (s) => ipcRenderer.send("hsk:streak", { lastAt: Number(s.lastAt) || 0, streak: Number(s.streak) || 0 }),
  setReminders: (on) => ipcRenderer.send("hsk:reminders", !!on),
  trStatus: () => ipcRenderer.invoke("hsk:tr-status"),
  trSetKey: (key) => ipcRenderer.invoke("hsk:tr-set-key", String(key || "")),
  trClearKey: () => ipcRenderer.invoke("hsk:tr-clear-key"),
  trSetModel: (m) => ipcRenderer.invoke("hsk:tr-model", String(m || "")),
  translate: (prompt) => ipcRenderer.invoke("hsk:translate", String(prompt || "")),
  trCancel: () => ipcRenderer.send("hsk:tr-cancel"),
  offStatus: () => ipcRenderer.invoke("hsk:off-status"),
  offDownload: () => ipcRenderer.invoke("hsk:off-download"),
  offCancel: () => ipcRenderer.send("hsk:off-cancel"),
  offRemove: () => ipcRenderer.invoke("hsk:off-remove"),
  offTranslate: (text) => ipcRenderer.invoke("hsk:off-translate", String(text || "")),
  onOffProgress: (fn) => ipcRenderer.on("hsk:off-progress", (_e, s) => fn(s))
});
