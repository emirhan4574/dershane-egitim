const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');

const APP_URL = process.env.DERSHANE_APP_URL || 'http://localhost:8081';
const ICON = path.join(__dirname, 'build', 'icon.png');

async function waitForUrl(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || (res.status >= 200 && res.status < 500)) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dershane',
    backgroundColor: '#0F766E',
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code === -3) return; // aborted
    dialog.showErrorBox(
      'Dershane açılamadı',
      `Uygulama adresi yanıt vermiyor:\n${APP_URL}\n\n` +
        `Önce proje klasöründe "npm run web" çalıştırın,\n` +
        `veya masaüstündeki Dershane kısayolunu kullanın (web'i kendisi açar).\n\n` +
        `Detay: ${desc} (${code})`
    );
  });

  win.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  const ok = await waitForUrl(APP_URL, 45);
  if (!ok) {
    dialog.showErrorBox(
      'Web sunucusu yok',
      `http://localhost:8081 açılmadı.\n\n` +
        `1) Proje klasöründe terminal açın\n` +
        `2) npm run web\n` +
        `3) Sonra masaüstü kısayolundan tekrar açın`
    );
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
