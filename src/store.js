const fs = require('fs');
const os = require('os');
const path = require('path');

const SPOOL_BALANCE = path.join(os.homedir(), '.workbuddy-points-pet', 'balance.json');

// 按 "a.b[0].c" / "a.b[*].c" 形式从对象里取值
// 支持 [*] 对数组内某个字段求和（用于多资源包积分汇总）
function getByPath(obj, expr) {
  if (!expr || obj == null) return obj;
  const parts = expr.split('.');

  function walk(current, idx) {
    if (current == null) return undefined;
    if (idx >= parts.length) return current;
    const key = parts[idx];
    const m = key.match(/^(\w+)(?:\[(\d+|\*)\])?$/);
    if (!m) {
      // 兜底：key 可能是纯字段名
      return walk(current[key], idx + 1);
    }
    const name = m[1];
    const index = m[2];
    let v = current[name];
    if (index === '*') {
      if (!Array.isArray(v)) return undefined;
      const rest = parts.slice(idx + 1).join('.');
      if (!rest) return v;
      const nums = v
        .map((item) => getByPath(item, rest))
        .filter((n) => typeof n === 'number' || (typeof n === 'string' && !Number.isNaN(Number(n))));
      if (nums.length === 0) return undefined;
      return nums.reduce((sum, n) => sum + Number(n), 0);
    }
    if (index !== undefined) v = Array.isArray(v) ? v[Number(index)] : undefined;
    return walk(v, idx + 1);
  }

  return walk(obj, 0);
}

// 本地文件数据源：未指定 path 时优先读「钩子自动上报」维护的 balance.json，
// 否则回退到手动录入的 config.balance（手动模式）。
async function readFileBalance(cfg) {
  const fp = cfg.file && cfg.file.path;
  if (!fp) {
    try {
      const json = JSON.parse(fs.readFileSync(SPOOL_BALANCE, 'utf8'));
      const bal = Number(json.balance);
      if (!Number.isNaN(bal)) {
        return { balance: bal, source: 'hook', raw: json, hookUpdatedAt: json.updatedAt };
      }
    } catch {
      /* 没有钩子余额文件，回退手动模式 */
    }
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
// 默认补齐浏览器的 Sec-Fetch / User-Agent 等头，避免 Electron 默认 UA 被网关拒绝。
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 SLBrowser/9.0.8.7271 SLBChan/123 SLBVPV/64-bit';
const DEFAULT_HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'sec-ch-ua': '"Chromium";v="9", "Not?A_Brand";v="8"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': BROWSER_UA,
  'x-client-platform': 'web',
};

async function readHttpBalance(cfg) {
  const h = cfg.http || {};
  if (!h.url) throw new Error('http 数据源缺少 url');
  const headers = Object.assign({}, DEFAULT_HEADERS, h.headers);
  const opts = { method: h.method || 'GET', headers };
  if (h.body !== undefined && h.body !== '') {
    if (typeof h.body === 'object') opts.body = JSON.stringify(h.body);
    else opts.body = String(h.body);
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/json';
    }
  }
  const resp = await fetch(h.url, opts);
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
