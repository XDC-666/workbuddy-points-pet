'use strict';
/**
 * spool 尾部监听：读取 WorkBuddy 状态钩子写入的本地事件文件。
 *
 * - 只从本机 ~/.workbuddy-points-pet/events.spool 读取结构性事件
 *   （事件名/时间戳/会话ID/工具名），不含任何提示词或文件内容。
 * - 启动时跳到文件末尾，只消费之后新增的事件。
 * - 容忍部分写入的行、文件截断与轮转。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SPOOL_DIR = path.join(os.homedir(), '.workbuddy-points-pet');
const SPOOL_FILE = path.join(SPOOL_DIR, 'events.spool');

function startSpoolWatch(onEvent) {
  let offset = 0;
  let buffer = '';
  let stopped = false;
  let watcher = null;

  try {
    fs.mkdirSync(SPOOL_DIR, { recursive: true });
  } catch (e) {
    /* 目录创建失败也不影响后续，读取时会静默跳过 */
  }

  // 启动时定位到文件末尾，避免重放历史事件
  try {
    offset = fs.statSync(SPOOL_FILE).size;
  } catch (e) {
    offset = 0;
  }

  function drain() {
    if (stopped) return;
    let st;
    try {
      st = fs.statSync(SPOOL_FILE);
    } catch (e) {
      return; // 文件还不存在
    }
    if (st.size < offset) {
      offset = 0; // 被截断或轮转
      buffer = '';
    }
    if (st.size === offset) return;

    const len = st.size - offset;
    let fd;
    let read = 0;
    const buf = Buffer.alloc(len);
    try {
      fd = fs.openSync(SPOOL_FILE, 'r');
      read = fs.readSync(fd, buf, 0, len, offset);
    } catch (e) {
      return;
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch (e) {
          /* ignore */
        }
      }
    }

    offset += read;
    buffer += buf.toString('utf8', 0, read);

    // 只处理完整的行，残缺部分留给下一次
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const rec = JSON.parse(line);
        if (rec && rec.event) onEvent(rec);
      } catch (e) {
        /* 忽略无法解析的行 */
      }
    }
  }

  try {
    watcher = fs.watch(SPOOL_FILE, { persistent: true }, () => {
      setTimeout(drain, 25); // 轻微防抖，等待写入落盘
    });
  } catch (e) {
    watcher = null; // 文件不存在时依赖下面的轮询
  }

  // Windows 上 fs.watch 偶有漏事件，用低频轮询兜底
  const timer = setInterval(drain, 700);

  return function stop() {
    stopped = true;
    clearInterval(timer);
    if (watcher) {
      try {
        watcher.close();
      } catch (e) {
        /* ignore */
      }
    }
  };
}

module.exports = { startSpoolWatch, SPOOL_FILE };
