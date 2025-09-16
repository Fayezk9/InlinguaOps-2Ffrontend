const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const APP_PORT = process.env.APP_PORT || 3157;
let serverProcess = null;

function ping(url, timeout = 2000) {
  return new Promise((resolve) => {
    let done = false;
    const req = http.get(url, (res) => {
      res.destroy();
      if (!done) {
        done = true;
        resolve(true);
      }
    });
    req.on("error", () => {
      if (!done) {
        done = true;
        resolve(false);
      }
    });
    req.setTimeout(timeout, () => {
      try {
        req.destroy();
      } catch {}
      if (!done) {
        done = true;
        resolve(false);
      }
    });
  });
}

function waitForUrl(url, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeout)
          reject(new Error("Timed out waiting for " + url));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function findDevUrl() {
  const candidates = [
    process.env.ELECTRON_START_URL,
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean);
  for (const url of candidates) {
    if (await ping(url)) return url;
  }
  return null;
}

async function startInternalServer() {
  const candidates = [
    path.join(__dirname, "..", "dist", "server", "production.mjs"),
    path.join(
      process.resourcesPath || "",
      "app.asar.unpacked",
      "dist",
      "server",
      "production.mjs",
    ),
    path.join(
      process.resourcesPath || "",
      "app.asar",
      "dist",
      "server",
      "production.mjs",
    ),
  ];
  const entry = candidates.find((p) => fs.existsSync(p)) || candidates[0];

  serverProcess = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(APP_PORT) },
    stdio: "inherit",
  });

  await waitForUrl(`http://localhost:${APP_PORT}`);
}

async function createWindow() {
  // Single instance lock (handy in Fiddle restarts)
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  let devUrl = await findDevUrl();
  if (!devUrl) {
    try {
      await startInternalServer();
    } catch (e) {
      console.error("Server failed to start", e);
    }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (devUrl) {
    await win.loadURL(devUrl);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    // Production server started above
    await win.loadURL(`http://localhost:${APP_PORT}`);
  }
}

app.whenReady().then(createWindow);

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {}
  }
});
