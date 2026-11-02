const { app, BrowserWindow, Menu, Tray, Notification, shell, nativeTheme, nativeImage, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const H24 = 24 * 3600 * 1000, H25_5 = 25.5 * 3600 * 1000, H26 = 26 * 3600 * 1000;
let win = null, tray = null, updater = null, updateReady = false, quitting = false;

// ---------- Small saved state: streak timing and reminder preference ----------
const stateFile = () => path.join(app.getPath("userData"), "reminders.json");
let state = { lastAt: 0, streak: 0, reminders: true, notified: 0 };
function loadState() { try { state = Object.assign(state, JSON.parse(fs.readFileSync(stateFile(), "utf8"))); } catch (e) {} }
function saveState() { try { fs.writeFileSync(stateFile(), JSON.stringify(state)); } catch (e) {} }

function status(msg) {
  if (win && !win.isDestroyed()) win.webContents.send("hsk:update-status", msg);
}

// ---------- Automatic updates from the project's GitHub releases ----------
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
      updateReady = true;
      status(`Version ${info.version} is ready. It installs when you close the window.`);
    });
    autoUpdater.on("error", (err) => {
      const m = String((err && err.message) || err);
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
// The app stays in the tray, so it may never quit by itself. Install a waiting update when the window closes,
// and come back to the tray rather than popping the window open again.
function installWaitingUpdate() {
  try { fs.writeFileSync(path.join(app.getPath("userData"), "start-hidden"), "1"); } catch (e) {}
  quitting = true;
  updater.quitAndInstall(true, true);
}

// ---------- Streak reminders ----------
function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(__dirname, "build", "icon.png") });
  n.on("click", showWindow);
  n.show();
}
function checkStreak() {
  if (!state.reminders || !state.lastAt || !state.streak) return;
  const since = Date.now() - state.lastAt;
  const days = `${state.streak}-day streak`;
  if (since >= H26) return;
  if (since >= H25_5 && state.notified < 2) {
    state.notified = 2; saveState();
    notify("Road to HSK: 30 minutes left", `Your ${days} ends in 30 minutes. One answer keeps it going.`);
  } else if (since >= H24 && state.notified < 1) {
    state.notified = 1; saveState();
    notify("Road to HSK: time to study", `It's been 24 hours. Your ${days} ends in 2 hours.`);
  }
}
function applyStartup() {
  // Only the installed app registers itself; development and test runs must not.
  if (!app.isPackaged || process.env.HSK_TEST_DATA) return;
  app.setLoginItemSettings({ openAtLogin: !!state.reminders, args: ["--hidden"] });
}

// ---------- Window and tray ----------
function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
}
function createWindow(hidden) {
  win = new BrowserWindow({
    width: 1040,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    show: !hidden,
    title: "Road to HSK",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#101614" : "#F3F6F4",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true
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
  win.on("close", (e) => {
    if (quitting) return;
    if (!state.reminders) {
      // Reminders off: closing the window really quits.
      return;
    }
    e.preventDefault();
    win.hide();
    if (updateReady && updater) installWaitingUpdate();
  });
  win.once("ready-to-show", () => setTimeout(checkForUpdates, 4000));
}
function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip("Road to HSK");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Road to HSK", click: showWindow },
    { label: "Check for updates", click: checkForUpdates },
    { type: "separator" },
    { label: "Quit", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("click", showWindow);
}

// ---------- Messages from the page ----------
ipcMain.on("hsk:check-updates", checkForUpdates);
ipcMain.on("hsk:streak", (_e, s) => {
  if (s.lastAt > state.lastAt) state.notified = 0;
  state.lastAt = s.lastAt; state.streak = s.streak;
  saveState();
});
ipcMain.on("hsk:reminders", (_e, on) => {
  if (state.reminders === on) return;
  state.reminders = on; saveState(); applyStartup();
});

// ---------- Start ----------
// Lets automated tests run against a throwaway folder instead of real progress.
if (process.env.HSK_TEST_DATA) app.setPath("userData", process.env.HSK_TEST_DATA);
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId("com.isaac.roadtohsk4");
  app.on("second-instance", showWindow);
  app.whenReady().then(() => {
    loadState();
    let hidden = process.argv.includes("--hidden");
    const flag = path.join(app.getPath("userData"), "start-hidden");
    if (fs.existsSync(flag)) { hidden = true; try { fs.unlinkSync(flag); } catch (e) {} }
    setupUpdates();
    createTray();
    createWindow(hidden);
    applyStartup();
    checkStreak();
    setInterval(checkStreak, 5 * 60 * 1000);
    setInterval(checkForUpdates, 6 * 3600 * 1000);
    app.on("activate", showWindow);
  });
  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => { if (!state.reminders || quitting) app.quit(); });
}
