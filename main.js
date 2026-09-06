const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { fetchBalance } = require('./src/store');
const { startSpoolWatch } = require('./src/spool');

const userData = app.getPath('userData');
const CONFIG_PATH = path.join(userData, 'config.json');

let win = null;
let tray = null;
let config = null;
let pollTimer = null;
let idleTimer = null;
let lowNotified = false;
let lastBalance = null; // 最近一次成功拉到的余额，用于拉取失败时回退展示

// 兜底图标（正常不会用到，因为 assets 下已有真实图标）
const FALLBACK_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/8mhAAAAAElFTkSuQmCC';

function defaultConfig() {
  return {
    source: 'file',
    label: 'WorkBuddy 积分',
    balance: 0,
    file: { path: '', jsonPath: 'balance' },
    http: {
      url: 'https://api.deepseek.com/user/balance',
      method: 'GET',
      headers: { Authorization: 'Bearer YOUR_API_KEY' },
      jsonPath: 'balance_infos[0].total_balance',
    },
    refreshIntervalSec: 30,
    lowBalanceThreshold: 5,
    scale: 1.0,
    idleFade: true,
    autoPlay: true,
    sound: true,
    notifyOnDone: true, // 任务完成时弹出桌面通知
    sleepAfterSec: 300, // 闲置多久进入睡眠（秒），0 = 永不睡眠
    initialBalance: 1000,
    costPerEvent: 1,
    autoDeduct: true,
    quotes: ['积分要省着花~', '摸鱼一时爽', '该充能啦', '今天也要好好干活'],
    tapLines: [
      '干嘛戳我～',
      '别闹，我干活呢',
      '再点一次试试？',
      '哎哟，痒！',
      '我是有尊严的桌宠',
      '积分要省着花哦',
      '你又在摸鱼吧？',
      '收到，我在听',
      '手痒痒是吧',
      '摸够了没？',
    ],
  };
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return Object.assign(defaultConfig(), JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
    }
  } catch (e) {
    console.error('读取配置失败，使用默认配置', e);
  }
  const def = defaultConfig();
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2));
  } catch (e) {
    console.error('写入默认配置失败', e);
  }
  return def;
}

function saveConfig(cfg) {
  config = Object.assign({}, config, cfg);
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('保存配置失败', e);
  }
  syncHookPrefs();
  restartPolling();
  applyScale(config.scale);
  return config;
}

function applyScale(scale) {
  if (!win) return;
  const s = Number(scale) || 1;
  win.setSize(Math.round(280 * s), Math.round(520 * s));
}

function pickQuote() {
  const q = (config.quotes && config.quotes.length) ? config.quotes : [''];
  return q[Math.floor(Math.random() * q.length)];
}

async function refreshNow() {
  try {
    const r = await fetchBalance(config);
    const balance = r.balance;
    lastBalance = balance; // 缓存成功结果
    const data = {
      balance,
      label: config.label,
      source: r.source,
      quote: pickQuote(),
      low: balance <= config.lowBalanceThreshold,
      time: Date.now(),
    };
    if (win && !win.isDestroyed()) win.webContents.send('update', data);
    if (data.low && !lowNotified) {
      new Notification({ title: '积分告急', body: `${config.label} 仅剩 ${balance}` }).show();
      lowNotified = true;
    }
    if (!data.low) lowNotified = false;
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    // 401/403 通常是登录态失效（Cookie 过期或环境变化），给出可操作的提示
    let hint = '';
    if (/40[13]/.test(msg)) {
      hint = '登录态可能已失效（Cookie 过期或网络环境变化）。请在浏览器 DevTools 重新复制该请求的 Cookie 写入配置后重启桌宠。';
    }
    if (win && !win.isDestroyed()) {
      win.webContents.send('update', {
        error: msg,
        label: config.label,
        lastBalance, // 回退展示上次成功余额，避免数字变红报错
        hint,
        time: Date.now(),
      });
    }
  }
}

function syncHookPrefs() {
  try {
    const dir = path.join(os.homedir(), '.workbuddy-points-pet');
    fs.mkdirSync(dir, { recursive: true });
    const prefs = {
      initialBalance: Number(config.initialBalance) || 0,
      costPerEvent: Number(config.costPerEvent) || 0,
      autoDeduct: config.autoDeduct !== false,
    };
    fs.writeFileSync(path.join(dir, 'prefs.json'), JSON.stringify(prefs, null, 2));
    // 余额基准：仅首次（balance.json 不存在）用 initialBalance 初始化；存在则保留，避免丢失已扣减
    const balPath = path.join(dir, 'balance.json');
    let cur = null;
    try { cur = JSON.parse(fs.readFileSync(balPath, 'utf8')); } catch (e) { cur = null; }
    if (!cur) {
      fs.writeFileSync(balPath, JSON.stringify({
        balance: Number(config.initialBalance) || 0,
        updatedAt: new Date().toISOString(),
        source: 'hook',
      }, null, 2));
    }
  } catch (e) {
    console.error('同步钩子积分偏好失败（不影响桌宠）', e);
  }
}

function restartPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const sec = Math.max(5, Number(config.refreshIntervalSec) || 30);
  pollTimer = setInterval(refreshNow, sec * 1000);
}

function resetIdle() {
  if (!win) return;
  win.setOpacity(1);
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (win && !win.isDestroyed() && config.idleFade) win.setOpacity(0.4);
  }, 4000);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const s = Number(config.scale) || 1;
  win = new BrowserWindow({
    width: Math.round(280 * s),
    height: Math.round(520 * s),
    x: width - Math.round(300 * s),
    y: height - Math.round(540 * s),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => {
    win = null;
  });
  win.webContents.on('context-menu', () => openMenu());
  if (config.idleFade) {
    win.on('focus', resetIdle);
    resetIdle();
  }
}

function createTray() {
  let img;
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  if (fs.existsSync(iconPath)) img = nativeImage.createFromPath(iconPath);
  else img = nativeImage.createFromBuffer(Buffer.from(FALLBACK_ICON, 'base64'));
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip('WorkBuddy 积分桌宠');
  tray.on('click', () => {
    if (win) win.isVisible() ? win.hide() : win.show();
  });
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示 / 隐藏', click: () => win && (win.isVisible() ? win.hide() : win.show()) },
      { label: '立即刷新', click: () => refreshNow() },
      { label: '喂它吃东西', click: () => win && win.webContents.send('feed') },
      { label: '设置', click: () => win && win.webContents.send('show-settings') },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ])
  );
}

function openMenu() {
  if (!win) return;
  const menu = Menu.buildFromTemplate([
    { label: '喂它吃东西', click: () => win.webContents.send('feed') },
    { label: '立即刷新', click: () => refreshNow() },
    {
      label: config.sound === false ? '开启音效' : '关闭音效',
      click: () => saveConfig({ sound: config.sound === false }),
    },
    { label: '设置', click: () => win.webContents.send('show-settings') },
    { label: '隐藏', click: () => win.hide() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
}

function main() {
  config = loadConfig();
  createWindow();
  createTray();
  restartPolling();
  refreshNow();
  try {
    startSpoolWatch((rec) => {
      if (win && !win.isDestroyed()) win.webContents.send('agent-event', rec);
    });
  } catch (e) {
    console.error('状态钩子监听启动失败（不影响桌宠使用）', e);
  }
}

// ---- IPC ----
ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (_e, cfg) => saveConfig(cfg));
ipcMain.handle('refresh-now', () => refreshNow());
// 渲染进程请求弹出桌面通知（任务完成提醒等）
ipcMain.handle('notify', (_e, payload) => {
  try {
    if (!Notification.isSupported()) return false;
    const { title, body } = payload || {};
    new Notification({ title: title || 'WorkBuddy 积分桌宠', body: body || '' }).show();
    return true;
  } catch (e) {
    console.error('弹出通知失败', e);
    return false;
  }
});
ipcMain.on('drag', (_e, dx, dy) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});
ipcMain.on('zoom', (_e, factor) => {
  const s = Math.min(2, Math.max(0.6, (config.scale || 1) * factor));
  saveConfig({ scale: s });
});
ipcMain.on('snap', (_e, side) => {
  if (!win) return;
  const b = win.getBounds();
  const area = screen.getPrimaryDisplay().workAreaSize;
  if (side === 'left') win.setPosition(0, win.getBounds().y);
  else if (side === 'right') win.setPosition(area.width - b.width, win.getBounds().y);
});
ipcMain.on('open-menu', () => openMenu());
ipcMain.on('show-settings', () => {
  if (win) win.webContents.send('show-settings');
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) win.show();
  });
  app.whenReady().then(main);
}
