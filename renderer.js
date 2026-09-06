const pet = document.getElementById('pet');
const balanceEl = document.getElementById('balance');
const labelEl = document.getElementById('label');
const statusEl = document.getElementById('status');
const settings = document.getElementById('settings');
const form = document.getElementById('form');

let dragging = false;
let moved = 0;
let lastScreenX = 0;

// ---- 拖拽移动 + 点击刷新 + 边缘吸附 ----
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
window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  if (moved < 5) {
    pet.classList.remove('tap');
    void pet.offsetWidth;
    pet.classList.add('tap');
    setTimeout(() => pet.classList.remove('tap'), 460);
    window.api.refresh();
  } else {
    const w = window.screen.availWidth;
    if (lastScreenX < 40) window.api.snap('left');
    else if (lastScreenX > w - 40) window.api.snap('right');
  }
});

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
    return;
  }
  statusEl.classList.remove('err');
  labelEl.textContent = d.label || '积分';
  balanceEl.textContent = d.balance;
  balanceEl.classList.remove('pop');
  void balanceEl.offsetWidth;
  balanceEl.classList.add('pop');
  statusEl.textContent = d.quote || '';
  document.body.classList.toggle('low', !!d.low);
}
window.api.onUpdate(applyData);

// ---- 设置面板 ----
function toggleSource() {
  const isHttp = form.source.value === 'http';
  document.getElementById('fileCfg').style.display = isHttp ? 'none' : 'block';
  document.getElementById('httpCfg').style.display = isHttp ? 'block' : 'none';
}
form.source.addEventListener('change', toggleSource);

function fillForm(cfg) {
  form.source.value = cfg.source;
  form.label.value = cfg.label;
  form.balance.value = cfg.balance;
  form.url.value = (cfg.http && cfg.http.url) || '';
  form.auth.value = (cfg.http && cfg.http.headers && cfg.http.headers.Authorization) || '';
  form.jsonPath.value = (cfg.http && cfg.http.jsonPath) || '';
  form.interval.value = cfg.refreshIntervalSec;
  form.threshold.value = cfg.lowBalanceThreshold;
  form.idleFade.checked = !!cfg.idleFade;
  form.quotes.value = (cfg.quotes || []).join('\n');
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
    const cfg = Object.assign({}, cur, {
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
      quotes: form.quotes.value.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    window.api.saveConfig(cfg).then(() => {
      closeSettings();
      window.api.refresh();
    });
  });
});
