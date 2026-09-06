const pet = document.getElementById('pet');
const charEl = document.getElementById('char');
const balanceEl = document.getElementById('balance');
const labelEl = document.getElementById('label');
const statusEl = document.getElementById('status');
const settings = document.getElementById('settings');
const form = document.getElementById('form');
const chatBubble = document.getElementById('chatBubble');
const chatText = chatBubble.querySelector('.chat-text');

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
};

function pick(arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- 状态机 ----
let cfg = {};
let state = 'idle';
let isLow = false;
let stateTimer = null;
let backTimer = null;

function setState(next, backMs) {
  state = next;
  const keep = document.body.className
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('st-'))
    .join(' ');
  document.body.className = (keep + ' st-' + next).trim();
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = null;
  if (backMs) {
    stateTimer = setTimeout(goIdle, backMs);
  }
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
const EYE_IDS = ['Normal', 'Think', 'Work', 'Happy', 'Error', 'Tap'];

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
    if (Math.random() < 0.25) setTimeout(blink, 220); // 偶尔连眨两下
    scheduleBlink();
  }, 3200 + Math.random() * 4200);
}

// ---- 自动模拟工作状态 ----
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
  }, 2600));
  cycleTimers.push(setTimeout(() => {
    setState('success');
    showChat(pick(STATE_LINES.success), 2300);
  }, 5400));
  cycleTimers.push(setTimeout(goIdle, 7800));
}

function scheduleAuto() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  if (!cfg.autoPlay) return;
  autoTimer = setTimeout(() => {
    if (state === 'idle' || state === 'low') runWorkCycle();
    scheduleAuto();
  }, 10000 + Math.random() * 14000);
}

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
  // 区分单击 / 双击
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
    statusEl.textContent = '查询失败: ' + d.error;
    statusEl.classList.add('err');
    setState('error', 3000);
    showChat(STATE_LINES.error[0], 3000);
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
  // 低余额持续提醒；正常情况不打断当前互动状态
  if (isLow && state !== 'tap' && state !== 'error') {
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
  form.tapLines.value = (c.tapLines && c.tapLines.length)
    ? c.tapLines.join('\n')
    : DEFAULT_TAP_LINES.join('\n');
  form.quotes.value = (c.quotes && c.quotes.length)
    ? c.quotes.join('\n')
    : DEFAULT_QUOTES.join('\n');
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
      http: {
        url: form.url.value,
        method: 'GET',
        headers: { Authorization: form.auth.value },
        jsonPath: form.jsonPath.value,
      },
      refreshIntervalSec: Number(form.interval.value) || 30,
      lowBalanceThreshold: Number(form.threshold.value) || 5,
      idleFade: form.idleFade.checked,
      autoPlay: form.autoPlay.checked,
      tapLines: form.tapLines.value.split('\n').map((s) => s.trim()).filter(Boolean),
      quotes: form.quotes.value.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    window.api.saveConfig(next).then((saved) => {
      cfg = saved;
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
  setTimeout(() => showChat(timeGreeting(), 3800), 800);
});
