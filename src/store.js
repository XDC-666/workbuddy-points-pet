const fs = require('fs');

// 按 "a.b[0].c" 形式从对象里取值
function getByPath(obj, expr) {
  if (!expr || obj == null) return obj;
  return expr.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    const m = key.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (!m) return acc[key];
    let v = acc[m[1]];
    if (m[2] !== undefined) v = Array.isArray(v) ? v[Number(m[2])] : undefined;
    return v;
  }, obj);
}

// 本地文件数据源：未指定 path 时直接读 config.balance（手动模式）
async function readFileBalance(cfg) {
  const fp = cfg.file && cfg.file.path;
  if (!fp) {
    return {
      balance: Number(cfg.balance) || 0,
      source: 'file',
      raw: { balance: cfg.balance },
    };
  }
  const text = await fs.promises.readFile(fp, 'utf8');
  const json = JSON.parse(text);
  const bal = getByPath(json, (cfg.file && cfg.file.jsonPath) || 'balance');
  return { balance: Number(bal) || 0, source: 'file', raw: json };
}

// HTTP 数据源：拉取余额接口，按 jsonPath 解析
async function readHttpBalance(cfg) {
  const h = cfg.http || {};
  if (!h.url) throw new Error('http 数据源缺少 url');
  const headers = Object.assign({}, h.headers);
  const resp = await fetch(h.url, { method: h.method || 'GET', headers });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const json = await resp.json();
  const bal = getByPath(json, h.jsonPath);
  return { balance: Number(bal) || 0, source: 'http', raw: json };
}

async function fetchBalance(cfg) {
  if (cfg.source === 'http') return readHttpBalance(cfg);
  return readFileBalance(cfg);
}

module.exports = { fetchBalance, getByPath };
