const pet = document.getElementById('pet');
const charEl = document.getElementById('char');
const balanceEl = document.getElementById('balance');
const labelEl = document.getElementById('label');
const statusEl = document.getElementById('status');
const settings = document.getElementById('settings');
const form = document.getElementById('form');
const chatBubble = document.getElementById('chatBubble');
const chatText = chatBubble.querySelector('.chat-text');
const heartsBox = document.getElementById('hearts');

// ---- 语录库 ----
const DEFAULT_TAP_LINES = [
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
];
const DEFAULT_QUOTES = [
  '积分要省着花~',
  '摸鱼一时爽',
  '该充能啦',
  '今天也要好好干活',
  '陪你一起搬砖',
];
const STATE_LINES = {
  thinking: ['思考中...', '让我想想', '正在分析...', '脑回路加载中', '嗯...有意思'],
  working: ['正在调用工具', '写代码呢，别急', '处理中，马上好', '搬砖中...', '跑起来了'],
  success: ['搞定！收工', '任务完成', '又活过了一天', '漂亮，干得不错', '这波稳了'],
  error: ['出问题了...', '这次没成功', '要不再试一次？'],
  low: ['积分告急，该充能啦', '余额不多了，省着点', '快没积分了哦'],
  eat: ['好吃！', '谢谢投喂～', '再来一份！', '嗝～满足了', '你最好了！'],
};

function pick(arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- 音效（Web Audio 实时合成，不需要任何音频文件） ----
let audioCtx = null;

function ensureAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function tone(freq, dur, type, gain, delay) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain || 0.1, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

const SFX = {
  tap: () => { tone(680, 0.11, 'sine', 0.1); tone(920, 0.11, 'sine', 0.07, 0.055); },
  think: () => { tone(460, 0.09, 'sine', 0.06); },
  work: () => { tone(360, 0.08, 'triangle', 0.06); },
  success: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.17, 'sine', 0.1, i * 0.07)); },
  error: () => { tone(320, 0.16, 'triangle', 0.09); tone(210, 0.24, 'triangle', 0.08, 0.12); },
  eat: () => { [523, 698, 880].forEach((f, i) => tone(f, 0.1, 'triangle', 0.09, i * 0.055)); },
};

function playSfx(name) {
  if (cfg.sound === false) return;
  const fn = SFX[name];
  if (fn) {
    try { fn(); } catch (e) { /* 音频不可用时静默 */ }
  }
}

// ---- 状态机 ----
let cfg = {};
let state = 'idle';
let isLow = false;
let stateTimer = null;
let realMode = false; // 是否已收到 WorkBuddy 真实事件

function setState(next, backMs) {
  state = next;
  const keep = document.body.className
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('st-'))
    .join(' ');
  document.body.className = (keep + ' st-' + next).trim();
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = null;
  if (backMs) stateTimer = setTimeout(goIdle, backMs);
}

function goIdle() {
  setState(isLow ? 'low' : 'idle');
}

// ---- 对话气泡（打字机） ----
let chatHideTimer = null;
let typeTimer = null;

function showChat(text, ms) {
  if (!text) return;
  clearTimeout(chatHideTimer);
  if (typeTimer) clearInterval(typeTimer);
  chatBubble.classList.add('show');
  let i = 0;
  chatText.textContent = '';
  typeTimer = setInterval(() => {
    i += 1;
    chatText.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(typeTimer);
      typeTimer = null;
    }
  }, 45);
  chatHideTimer = setTimeout(() => {
    chatBubble.classList.remove('show');
  }, ms || 3800);
}

// ---- 眼睛：跟随鼠标 + 随机眨眼 ----
let gazeX = 0;
let gazeY = 0;
const EYE_IDS = ['Normal', 'Think', 'Work', 'Happy', 'Error', 'Tap', 'Eat'];

function applyEyeTransform() {
  EYE_IDS.forEach((n) => {
    const el = document.getElementById('eyes' + n);
    if (el) el.style.transform = 'translate(' + gazeX + 'px,' + gazeY + 'px)';
  });
}

function visibleEyes() {
  for (const n of EYE_IDS) {
    const el = document.getElementById('eyes' + n);
    if (el && window.getComputedStyle(el).display !== 'none') return el;
  }
  return null;
}

window.addEventListener('mousemove', (e) => {
  const rect = charEl.getBoundingClientRect();
  if (!rect.width) return;
  const cx = rect.left + rect.width * (110 / 220);
  const cy = rect.top + rect.height * (92 / 200);
  let dx = (e.clientX - cx) / (rect.width * 0.6);
  let dy = (e.clientY - cy) / (rect.height * 0.6);
  dx = Math.max(-1, Math.min(1, dx));
  dy = Math.max(-1, Math.min(1, dy));
  gazeX = dx * 4;
  gazeY = dy * 3;
  applyEyeTransform();
});

function blink() {
  const el = visibleEyes();
  if (!el) return;
  el.style.transform = 'translate(' + gazeX + 'px,' + gazeY + 'px) scaleY(.12)';
  setTimeout(() => {
    el.style.transform = 'translate(' + gazeX + 'px,' + gazeY + 'px)';
  }, 120);
}

function scheduleBlink() {
  setTimeout(() => {
    blink();
    if (Math.random() < 0.25) setTimeout(blink, 220);
    scheduleBlink();
  }, 3200 + Math.random() * 4200);
}

// ---- 自动模拟工作状态（未接真实状态时才用） ----
let autoTimer = null;
let cycleTimers = [];

function clearCycle() {
  cycleTimers.forEach(clearTimeout);
  cycleTimers = [];
}

function runWorkCycle() {
  clearCycle();
  setState('thinking');
  showChat(pick(STATE_LINES.thinking), 2500);
  cycleTimers.push(setTimeout(() => {
    setState('working');
    showChat(pick(STATE_LINES.working), 2700);
    playSfx('work');
  }, 2600));
  cycleTimers.push(setTimeout(() => {
    setState('success');
    showChat(pick(STATE_LINES.success), 2300);
    playSfx('success');
  }, 5400));
  cycleTimers.push(setTimeout(goIdle, 7800));
}

function scheduleAuto() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  if (!cfg.autoPlay || realMode) return;
  autoTimer = setTimeout(() => {
    if (state === 'idle' || state === 'low') runWorkCycle();
    scheduleAuto();
  }, 10000 + Math.random() * 14000);
}

// ---- 真实状态联动：读取 WorkBuddy 钩子写入的 spool ----
const AGENT_MAP = {
  SessionStart: { st: 'idle', lines: ['开工了，我在', '准备就绪'] },
  UserPromptSubmit: { st: 'thinking', lines: ['收到，让我想想', '正在思考...', '这个问题有意思'] },
  PreToolUse: { st: 'working', lines: ['调用工具中...', '正在执行', '让我查一下'] },
  PostToolUse: { st: 'working', lines: ['工具跑完了', '拿到结果了'] },
  SessionEnd: { st: 'idle', lines: ['收工，摸鱼~', '这波结束了'] },
  Notification: { st: 'tap', lines: ['需要你确认一下', '在等你点头'] },
  PreCompact: { st: 'working', lines: ['整理上下文中...'] },
};

function handleAgentEvent(rec) {
  if (!rec || !rec.event) return;
  if (!realMode) {
    realMode = true; // 收到真实事件后停止模拟循环
    clearCycle();
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
    showChat('已连接 WorkBuddy 实时状态', 3200);
  }

  if (rec.event === 'Stop') {
    if (rec.stop) {
      setState('thinking', 3000);
      showChat('还在继续...', 2400);
    } else {
      setState('success', 2800);
      showChat(pick(STATE_LINES.success), 3000);
      playSfx('success');
    }
    return;
  }

  const m = AGENT_MAP[rec.event];
  if (!m) return;
  setState(m.st, m.st === 'idle' ? 0 : 4200);
  showChat(pick(m.lines), 3000);
  if (m.st === 'thinking') playSfx('think');
  else if (m.st === 'working') playSfx('work');
}

if (window.api.onAgentEvent) window.api.onAgentEvent(handleAgentEvent);

// ---- 喂食彩蛋 ----
function spawnHearts() {
  if (!heartsBox) return;
  for (let i = 0; i < 5; i += 1) {
    const h = document.createElement('div');
    h.className = 'heart';
    h.style.left = (70 + Math.random() * 70) + 'px';
    h.style.animationDelay = (i * 0.11) + 's';
    h.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15">' +
      '<path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.3 12c-2.3 4.4-9.3 9-9.3 9z" ' +
      'fill="#ff8fa3"/></svg>';
    heartsBox.appendChild(h);
    setTimeout(() => h.remove(), 1700);
  }
}

function feed() {
  setState('eat', 2700);
  showChat(pick(STATE_LINES.eat), 2900);
  spawnHearts();
  playSfx('eat');
  const nextCount = (cfg.feedCount || 0) + 1;
  cfg.feedCount = nextCount;
  window.api.getConfig().then((cur) => {
    window.api.saveConfig(Object.assign({}, cur, { feedCount: nextCount }));
  });
}

if (window.api.onFeed) window.api.onFeed(feed);

// ---- 点击互动（单击说台词 / 双击开设置） ----
let dragging = false;
let moved = 0;
let lastScreenX = 0;
let clickTimer = null;

pet.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  moved = 0;
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.movementX;
  const dy = e.movementY;
  moved += Math.abs(dx) + Math.abs(dy);
  lastScreenX = e.screenX;
  window.api.move(dx, dy);
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  if (moved >= 5) {
    const w = window.screen.availWidth;
    if (lastScreenX < 40) window.api.snap('left');
    else if (lastScreenX > w - 40) window.api.snap('right');
    return;
  }
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
    openSettings();
  } else {
    clickTimer = setTimeout(() => {
      clickTimer = null;
      doTap();
    }, 220);
  }
});

function doTap() {
  pet.classList.remove('tap');
  void pet.offsetWidth;
  pet.classList.add('tap');
  setTimeout(() => pet.classList.remove('tap'), 540);
  setState('tap', 1800);
  const lines = (cfg.tapLines && cfg.tapLines.length) ? cfg.tapLines : DEFAULT_TAP_LINES;
  showChat(pick(lines), 3200);
  playSfx('tap');
  window.api.refresh();
}

// ---- 滚轮缩放 ----
pet.addEventListener('wheel', (e) => {
  e.preventDefault();
  window.api.zoom(e.deltaY < 0 ? 1.1 : 0.9);
}, { passive: false });

// ---- 右键菜单 ----
pet.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.api.openMenu();
});

// ---- 接收余额更新 ----
function applyData(d) {
  if (d.error) {
    if (d.lastBalance != null) {
      // 有历史余额：保留数字，仅给温和提示，不切报错态
      statusEl.textContent = '· 刷新失败，显示上次数据';
      statusEl.classList.add('warn');
      statusEl.classList.remove('err');
      if (d.hint) showChat(d.hint, 4200);
      return;
    }
    // 首次或从未成功：显示明确可操作的提示
    let short = '查询失败: ' + d.error;
    if (/40[13]/.test(d.error)) {
      short = 'Cookie 已失效，请重新登录 workbuddy.cn 后复制 Cookie';
    }
    statusEl.textContent = short;
    statusEl.classList.add('err');
    setState('error', 3000);
    showChat(d.hint || STATE_LINES.error[0], 4200);
    playSfx('error');
    return;
  }
  statusEl.classList.remove('err');
  labelEl.textContent = d.label || '积分';
  balanceEl.textContent = d.balance;
  balanceEl.classList.remove('pop');
  void balanceEl.offsetWidth;
  balanceEl.classList.add('pop');
  statusEl.textContent = d.quote || '';

  isLow = !!d.low;
  if (isLow && state !== 'tap' && state !== 'error' && state !== 'eat') {
    if (state !== 'low') setState('low');
    if (state === 'low') showChat(pick(STATE_LINES.low), 3600);
  } else if (!isLow && state === 'low') {
    goIdle();
  }
}
window.api.onUpdate(applyData);

// ---- 设置面板 ----
function toggleSource() {
  const isHttp = form.source.value === 'http';
  document.getElementById('fileCfg').style.display = isHttp ? 'none' : 'block';
  document.getElementById('httpCfg').style.display = isHttp ? 'block' : 'none';
}
form.source.addEventListener('change', toggleSource);

function fillForm(c) {
  form.source.value = c.source;
  form.label.value = c.label;
  form.balance.value = c.balance;
  form.url.value = (c.http && c.http.url) || '';
  form.auth.value = (c.http && c.http.headers && c.http.headers.Authorization) || '';
  form.jsonPath.value = (c.http && c.http.jsonPath) || '';
  form.interval.value = c.refreshIntervalSec;
  form.threshold.value = c.lowBalanceThreshold;
  form.idleFade.checked = !!c.idleFade;
  form.autoPlay.checked = c.autoPlay !== false;
  form.sound.checked = c.sound !== false;
  form.tapLines.value = (c.tapLines && c.tapLines.length)
    ? c.tapLines.join('\n')
    : DEFAULT_TAP_LINES.join('\n');
  form.quotes.value = (c.quotes && c.quotes.length)
    ? c.quotes.join('\n')
    : DEFAULT_QUOTES.join('\n');
  form.initialBalance.value = c.initialBalance;
  form.cost.value = c.costPerEvent;
  form.autoDeduct.checked = c.autoDeduct !== false;
  toggleSource();
}

function openSettings() {
  window.api.getConfig().then(fillForm);
  settings.classList.remove('hidden');
}
function closeSettings() {
  settings.classList.add('hidden');
}
document.getElementById('cancel').addEventListener('click', closeSettings);
window.api.onShowSettings(openSettings);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  window.api.getConfig().then((cur) => {
    const next = Object.assign({}, cur, {
      source: form.source.value,
      label: form.label.value,
      balance: Number(form.balance.value) || 0,
      http: Object.assign({}, cur.http, {
        url: form.url.value,
        jsonPath: form.jsonPath.value,
        // 保留 method / body / Cookie / Referer / Origin，仅更新界面上可编辑的字段
        headers: Object.assign({}, cur.http && cur.http.headers, {
          Authorization: form.auth.value,
        }),
      }),
      refreshIntervalSec: Number(form.interval.value) || 30,
      lowBalanceThreshold: Number(form.threshold.value) || 5,
      idleFade: form.idleFade.checked,
      autoPlay: form.autoPlay.checked,
      sound: form.sound.checked,
      tapLines: form.tapLines.value.split('\n').map((s) => s.trim()).filter(Boolean),
      quotes: form.quotes.value.split('\n').map((s) => s.trim()).filter(Boolean),
      initialBalance: Number(form.initialBalance.value) || 0,
      costPerEvent: Number(form.cost.value) || 0,
      autoDeduct: form.autoDeduct.checked,
    });
    window.api.saveConfig(next).then((saved) => {
      cfg = saved;
      if (saved.sound !== false) playSfx('tap');
      scheduleAuto();
      closeSettings();
      window.api.refresh();
    });
  });
});

// ---- 启动 ----
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '这么晚还没睡？';
  if (h < 11) return '早上好，今天也加油';
  if (h < 14) return '中午好，记得吃饭';
  if (h < 18) return '下午好，开工了';
  if (h < 23) return '晚上好，还在忙呀';
  return '夜深了，早点休息';
}

window.api.getConfig().then((c) => {
  cfg = c;
  setState('idle');
  scheduleBlink();
  scheduleAuto();
  const fed = c.feedCount || 0;
  setTimeout(() => {
    showChat(fed > 0 ? ('你喂过我 ' + fed + ' 次啦') : timeGreeting(), 3800);
  }, 800);
});
