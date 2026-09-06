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

// ---- 把钩子脚本复制到用户数据目录，确保安装路径稳定 ----
const HOOK_SCRIPTS_DIR = path.join(userData, 'scripts');
const HOOKS_TO_COPY = ['status-hook.mjs', 'install-hook.mjs'];

function copyHookScripts() {
  try {
    fs.mkdirSync(HOOK_SCRIPTS_DIR, { recursive: true });
    for (const name of HOOKS_TO_COPY) {
      const src = path.join(__dirname, 'scripts', name);
      const dst = path.join(HOOK_SCRIPTS_DIR, name);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, dst);
    }
  } catch (e) {
    console.error('复制钩子脚本失败', e);
  }
}

// 在常见位置找 node.exe，找不到就返回 ''
function findNode() {
  const candidates = [
    path.join(os.homedir(), '.workbuddy', 'binaries', 'node', 'versions', '22.22.2', 'node.exe'),
    path.join(os.homedir(), '.workbuddy', 'binaries', 'node', 'versions', '24.14.0', 'node.exe'),
    'C:/Program Files/nodejs/node.exe',
    'C:/Program Files (x86)/nodejs/node.exe',
  ];
  const fromEnv = process.env.NODE_PATH || process.env.PATH;
  if (fromEnv) {
    fromEnv.split(path.delimiter).forEach((p) => {
      candidates.push(path.join(p, 'node.exe'));
    });
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (e) { /* ignore */ }
  }
  return '';
}

// 在应用内直接注册 WorkBuddy 钩子（无需命令行）
function registerWorkBuddyHooks() {
  try {
    copyHookScripts();
    const node = findNode();
    if (!node) {
      notifyUser('注册钩子失败', '未找到 node.exe，请安装 Node.js 或使用源码方式运行 npm run install-hook。');
      return false;
    }
    const hookPath = path.join(HOOK_SCRIPTS_DIR, 'status-hook.mjs');
    if (!fs.existsSync(hookPath)) {
      notifyUser('注册钩子失败', '钩子脚本未找到，请重新安装桌宠。');
      return false;
    }

    const settingsPath = path.join(os.homedir(), '.workbuddy', 'settings.json');
    let cfg = {};
    if (fs.existsSync(settingsPath)) {
      try {
        cfg = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        notifyUser('注册钩子失败', '解析 ~/.workbuddy/settings.json 失败，请检查格式。');
        return false;
      }
      const bak = settingsPath + '.bak-' + Date.now();
      fs.copyFileSync(settingsPath, bak);
    }

    const EVENTS = [
      'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
      'Stop', 'Notification', 'PreCompact',
    ];
    const MARK = 'workbuddy-points-pet';
    cfg.hooks = cfg.hooks || {};
    let added = 0;
    for (const ev of EVENTS) {
      const arr = Array.isArray(cfg.hooks[ev]) ? cfg.hooks[ev] : [];
      const exists = arr.some(
        (x) =>
          x && Array.isArray(x.hooks) &&
          x.hooks.some((h) => h && typeof h.command === 'string' && h.command.includes(MARK))
      );
      if (exists) continue;
      arr.push({
        hooks: [{ type: 'command', command: `"${node}" "${hookPath}" ${ev}` }],
      });
      cfg.hooks[ev] = arr;
      added += 1;
    }

    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(cfg, null, 2));
    notifyUser('钩子注册成功', `已注册 ${added} 个 WorkBuddy 事件钩子。请完全退出并重新启动 WorkBuddy 后生效。`);
    return true;
  } catch (e) {
    console.error('注册钩子失败', e);
    notifyUser('注册钩子失败', e && e.message ? e.message : String(e));
    return false;
  }
}

function notifyUser(title, body) {
  try {
    if (!Notification.isSupported()) return;
    new Notification({ title: title || 'WorkBuddy 积分桌宠', body: body || '' }).show();
  } catch (e) {
    console.error('通知失败', e);
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
  // 默认让鼠标穿透：点击透传给后面的窗口，避免桌宠遮挡/抢焦点影响其他软件
  win.setIgnoreMouseEvents(true, { forward: true });
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
      { label: '注册 WorkBuddy 钩子', click: () => registerWorkBuddyHooks() },
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
    { label: '注册 WorkBuddy 钩子', click: () => registerWorkBuddyHooks() },
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
  copyHookScripts();
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
ipcMain.handle('register-hooks', () => registerWorkBuddyHooks());
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
// 渲染进程请求切换鼠标穿透 / 可点击：on=true 时接收点击（戳/拖/设置），否则穿透给后面的窗口
ipcMain.on('set-capture', (_e, on) => {
  try {
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true });
  } catch (e) { /* ignore */ }
});
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
