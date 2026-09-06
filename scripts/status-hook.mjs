#!/usr/bin/env node
/**
 * WorkBuddy 状态钩子 —— 把生命周期事件写入本地 spool 文件，供积分桌宠读取。
 *
 * 用法：node status-hook.mjs <EventName>
 *   WorkBuddy 会把事件详情以 JSON 形式从 stdin 传入（可选）。
 *
 * 设计原则：
 *   1. 仅写入结构性字段（事件名/时间戳/会话ID/工具名/通知类型），
 *      不记录提示词、文件内容、工具参数或任何输出结果。
 *   2. fail-open：任何异常都静默退出，绝不影响或阻塞 WorkBuddy 本身。
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SPOOL_DIR = path.join(os.homedir(), '.workbuddy-points-pet');
const SPOOL_FILE = path.join(SPOOL_DIR, 'events.spool');
const MAX_BYTES = 2 * 1024 * 1024; // 超过 2MB 轮转一次

/** 带超时的 stdin 读取；没有输入时也安全返回 */
function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    let data = '';
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    try {
      if (!process.stdin || process.stdin.isTTY) return finish('');
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });
      process.stdin.on('end', () => finish(data));
      process.stdin.on('error', () => finish(''));
      setTimeout(() => finish(data), timeoutMs);
      process.stdin.resume();
    } catch {
      finish('');
    }
  });
}

async function main() {
  try {
    const event = process.argv[2];
    if (!event) return; // 没有事件名就什么都不做

    const raw = await readStdin(300);
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = {};
      }
    }

    // 只保留结构性字段，不写入任何内容数据
    const record = {
      event,
      ts: Date.now(),
      sessionId: payload.session_id || payload.sessionId || '',
      tool: payload.tool_name || payload.toolName || '',
      notification: payload.notification_type || payload.notificationType || '',
      stop: payload.stop_hook_active === true,
    };

    fs.mkdirSync(SPOOL_DIR, { recursive: true });

    // 简单的体积轮转，避免无限增长
    try {
      const st = fs.statSync(SPOOL_FILE);
      if (st.size > MAX_BYTES) {
        fs.renameSync(SPOOL_FILE, SPOOL_FILE + '.1');
      }
    } catch {
      /* 文件还不存在，忽略 */
    }

    fs.appendFileSync(SPOOL_FILE, JSON.stringify(record) + '\n');
  } catch {
    /* fail-open：静默失败，绝不影响宿主程序 */
  }
}

main();
