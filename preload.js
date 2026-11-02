const { contextBridge, ipcRenderer } = require("electron");

// The page only gets these few things. It cannot reach Node or the file system.
contextBridge.exposeInMainWorld("hsk", {
  checkForUpdates: () => ipcRenderer.send("hsk:check-updates"),
  onUpdateStatus: (fn) => ipcRenderer.on("hsk:update-status", (_e, msg) => fn(String(msg))),
  setStreak: (s) => ipcRenderer.send("hsk:streak", { lastAt: Number(s.lastAt) || 0, streak: Number(s.streak) || 0 }),
  setReminders: (on) => ipcRenderer.send("hsk:reminders", !!on)
});
