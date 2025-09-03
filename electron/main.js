const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const isDev = !!process.env.ELECTRON_START_URL;
const APP_PORT = process.env.APP_PORT || 3157;
let serverProcess = null;

function waitForUrl(url, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Timed out waiting for ' + url));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function startInternalServer() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'server', 'production.mjs'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist', 'server', 'production.mjs'),
    path.join(process.resourcesPath || '', 'app.asar', 'dist', 'server', 'production.mjs'),
  ];
  const entry = candidates.find((p) => fs.existsSync(p)) || candidates[0];

  serverProcess = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(APP_PORT) },
    stdio: 'inherit',
  });

  await waitForUrl(`http://localhost:${APP_PORT}`);
}

async function createWindow() {
  if (!isDev) {
    try { await startInternalServer(); } catch (e) { console.error('Server failed to start', e); }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadURL(`http://localhost:${APP_PORT}`);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    try { serverProcess.kill(); } catch {}
  }
});
