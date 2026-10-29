const { app, BrowserWindow, Menu, shell, nativeTheme, ipcMain } = require("electron");
const path = require("path");

let win = null;
let updater = null;

function status(msg) {
  if (win && !win.isDestroyed()) win.webContents.send("hsk:update-status", msg);
}

// Automatic updates come from the project's GitHub releases (see "publish" in package.json).
// Until a release exists there, every check just reports that no update server answered.
function setupUpdates() {
  try {
    const { autoUpdater } = require("electron-updater");
    updater = autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;
    autoUpdater.on("checking-for-update", () => status("Checking for updates…"));
    autoUpdater.on("update-available", (info) => status(`Downloading version ${info.version}…`));
    autoUpdater.on("update-not-available", () => status(`You have the latest version (${app.getVersion()}).`));
    autoUpdater.on("download-progress", (p) => status(`Downloading update: ${Math.round(p.percent)}%`));
    autoUpdater.on("update-downloaded", (info) => {
      status(`Version ${info.version} is ready. It installs when you close the app.`);
    });
    autoUpdater.on("error", (err) => {
      const m = String(err && err.message || err);
      if (/404|ENOTFOUND|ECONN|net::|ETIMEDOUT|No published versions/i.test(m)) status("Couldn't reach the update server. You're on version " + app.getVersion() + ".");
      else status("Update check failed: " + m.slice(0, 120));
    });
  } catch (e) {
    updater = null;
  }
}

function checkForUpdates() {
  if (!updater) { status("Updates aren't available in this build."); return; }
  updater.checkForUpdates().catch(() => {});
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    title: "Road to HSK",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#101614" : "#F3F6F4",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile("index.html");
  // Links inside the page open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); }
  });
  win.once("ready-to-show", () => setTimeout(checkForUpdates, 4000));
}

process.env.HSK_VERSION = app.getVersion();
ipcMain.on("hsk:check-updates", checkForUpdates);

app.whenReady().then(() => {
  setupUpdates();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => app.quit());
