#!/usr/bin/env node
/**
 * 把状态钩子注册到 WorkBuddy 的 settings.json（本机操作，绝不上传任何数据）。
 *
 *   node scripts/install-hook.mjs             安装
 *   node scripts/install-hook.mjs --uninstall 卸载
 *
 * 安全说明：
 *   - 本脚本只在本机读取并改写 ~/.workbuddy/settings.json，不会读取、打印或上传其中
 *     的任何密钥/令牌内容。
 *   - 每次安装都会先生成一份带时间戳的备份（settings.json.bak-<时间戳>）。
 *   - 幂等：重复执行不会重复添加同一条钩子。
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS = path.join(os.homedir(), '.workbuddy', 'settings.json');
const HOOK = path.join(__dirname, 'status-hook.mjs');
const MARK = 'workbuddy-points-pet';

const EVENTS = [
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'Notification',
  'PreCompact',
];

function load() {
  if (!fs.existsSync(SETTINGS)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch (e) {
    console.error('解析 settings.json 失败，已中止：', e.message);
    process.exit(1);
  }
}

function save(cfg) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(cfg, null, 2));
}

function install() {
  if (!fs.existsSync(HOOK)) {
    console.error('找不到钩子脚本：', HOOK);
    process.exit(1);
  }
  const cfg = load();

  if (fs.existsSync(SETTINGS)) {
    const bak = SETTINGS + '.bak-' + Date.now();
    fs.copyFileSync(SETTINGS, bak);
    console.log('已备份原配置 →', bak);
  }

  const node = process.execPath; // 当前 node 的绝对路径，避免 PATH 问题
  cfg.hooks = cfg.hooks || {};
  let added = 0;

  for (const ev of EVENTS) {
    const arr = Array.isArray(cfg.hooks[ev]) ? cfg.hooks[ev] : [];
    const exists = arr.some(
      (x) =>
        x &&
        Array.isArray(x.hooks) &&
        x.hooks.some(
          (h) => h && typeof h.command === 'string' && h.command.includes(MARK)
        )
    );
    if (exists) {
      cfg.hooks[ev] = arr;
      continue;
    }
    // 符合 CodeBuddy/WorkBuddy hooks 规范的嵌套格式：
    // "EventName": [ { "hooks": [ { "type": "command", "command": "..." } ] } ]
    arr.push({ hooks: [{ type: 'command', command: `"${node}" "${HOOK}" ${ev}` }] });
    cfg.hooks[ev] = arr;
    added += 1;
  }

  save(cfg);
  console.log(`已注册 ${added} 个事件钩子（共 ${EVENTS.length} 个，已存在的会跳过）`);
  console.log('钩子命令示例：', `"${node}" "${HOOK}" UserPromptSubmit`);
  console.log('\n请完全退出并重新启动 WorkBuddy，配置才会生效。');
}

function uninstall() {
  const cfg = load();
  if (!cfg.hooks) {
    console.log('未发现 hooks 配置，无需卸载。');
    return;
  }
  let removed = 0;
  for (const ev of Object.keys(cfg.hooks)) {
    const arr = cfg.hooks[ev];
    if (!Array.isArray(arr)) continue;
    const next = arr.filter((x) => {
      // 旧版扁平格式：{ type, command }
      if (x && typeof x.command === 'string' && x.command.includes(MARK)) {
        return false;
      }
      // 新版嵌套格式：{ hooks: [...] }
      if (x && Array.isArray(x.hooks)) {
        const kept = x.hooks.filter(
          (h) => !(h && typeof h.command === 'string' && h.command.includes(MARK))
        );
        x.hooks = kept;
        return kept.length > 0;
      }
      return true;
    });
    removed += arr.length - next.length;
    if (next.length) cfg.hooks[ev] = next;
    else delete cfg.hooks[ev];
  }
  if (Object.keys(cfg.hooks).length === 0) delete cfg.hooks;
  save(cfg);
  console.log(`已移除 ${removed} 条钩子。重启 WorkBuddy 生效。`);
}

if (process.argv.includes('--uninstall')) uninstall();
else install();
