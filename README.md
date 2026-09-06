# WorkBuddy 积分桌宠

> ⚠️ **免责声明**：WorkBuddy 是其各自所有者的产品名称。本项目是独立的社区开源工具，**与 WorkBuddy 无隶属关系，也未获其官方背书**。内置机器人形象为原创示例素材，可自由替换。

桌面悬浮宠物，实时显示你的 AI 助手剩余积分。灵感来自网上很火的 DeepSeek 鲸鱼余额桌宠，但**数据源完全可配置**——手动录入、本地 JSON 文件、或任意 HTTP 余额接口都行。Electron 单文件窗口，双击即用，开源出去别人也能跑。

> 说明：WorkBuddy 目前**没有公开的积分查询 API**，本地也只缓存了使用次数、没有余额。所以本桌宠默认用「手动录入 / 本地文件」模式显示积分；如果你有自己的余额接口（比如 DeepSeek、或自建服务），切到 HTTP 模式即可自动刷新。

🔒 隐私：纯本地运行，无上传、无遥测、无远程端口。详见 [PRIVACY.md](./PRIVACY.md)。

## 功能

**互动（参考 DeepSeek 桌宠）**

- 单击桌宠：随机弹出台词气泡 + Q 弹反应（台词可自定义）
- 双击桌宠：打开设置面板
- 七种状态各有独立表情与动画：待机 / 思考（晃头）/ 工作（抖动）/ 完成（弹跳 + 咧嘴笑）/ 出错（摇头 + X 眼）/ 低余额（颤抖 + 流泪）/ 进食（满足眯眼 + 咀嚼）
- **音效**：点击、完成、出错、进食各有不同提示音（Web Audio 实时合成，无音频文件，可在设置或右键菜单关闭）
- **喂食彩蛋**：右键菜单「喂它吃东西」，会眯眼咀嚼、飘出爱心，并记住你喂过几次
- **真实状态联动**（可选）：装一个本地钩子后，桌宠跟随 WorkBuddy 真实状态变化（详见下文）
- 眼睛跟随鼠标转动，并不定时随机眨眼
- 气泡文字为逐字打字机效果，显示数秒后自动淡出
- 头顶指示灯随状态变色（青 / 琥珀 / 绿 / 红）
- 开启「自动模拟工作状态」后会自己循环 思考 → 工作 → 完成
- 按本地时间问候（早上好 / 中午好 / 夜深了…）

**基础**

- 透明无边框悬浮桌宠，桌面角落常驻
- 拖拽移动、滚轮缩放（0.6x–2x）、靠近左右边缘自动吸附
- 显示剩余积分 + 随机语录 + 低余额系统通知
- 数据源可插拔：`file`（手动/本地文件）或 `http`（任意余额接口）
- 系统托盘图标、右键菜单（刷新 / 设置 / 退出）
- 闲置 4 秒后自动半透明、单实例运行

> 想先看效果？打开仓库里的 `preview.html`（纯静态，双击即可在浏览器里试玩全部互动）。

## 快速开始（给别人用）

去 Releases 下载 `WorkBuddy 积分桌宠 Setup *.exe`（安装版）或 `*.exe`（绿色便携版），双击运行。
首次运行会在用户目录生成 `config.json`，右键桌宠 → 设置 → 填入你的积分即可。

## 从源码运行

```bash
git clone https://github.com/XDC-666/workbuddy-points-pet.git
cd workbuddy-points-pet
npm install
npm run icons     # 生成托盘/窗口图标（纯 Python，无依赖）
npm start
```

首次启动会在以下位置生成配置文件，直接改它或右键「设置」都行：

- Windows：`%APPDATA%\workbuddy-points-pet\config.json`
- macOS / Linux：`~/.config/workbuddy-points-pet/config.json`

## 配置说明

`config.json` 字段：

| 字段 | 说明 |
|------|------|
| `source` | `file` 或 `http` |
| `label` | 桌宠上显示的称呼，如「WorkBuddy 积分」 |
| `balance` | 手动模式下的当前积分（`source=file` 且未指定文件时生效） |
| `file.path` | 可选，指向一个含余额字段的本地 JSON 文件 |
| `file.jsonPath` | 该文件里余额字段路径，默认 `balance` |
| `http.url` | 余额接口地址 |
| `http.headers` | 请求头，通常放 `Authorization: Bearer <key>` |
| `http.jsonPath` | 从返回 JSON 里取余额的路径，支持 `a.b[0].c` |
| `refreshIntervalSec` | 刷新间隔（秒，最小 5） |
| `lowBalanceThreshold` | 低于此值弹系统提醒 |
| `scale` | 缩放倍数 |
| `idleFade` | 闲置是否半透明 |
| `autoPlay` | 是否自动模拟「思考 → 工作 → 完成」的状态循环 |
| `quotes` | 待机随机语录数组 |
| `tapLines` | 点击桌宠时随机说的台词数组 |

## 接入 WorkBuddy 真实状态（可选）

默认桌宠是「模拟」工作状态。装上本地钩子后，它会跟随 WorkBuddy 的真实生命周期换表情：

| WorkBuddy 事件 | 桌宠表现 |
|---|---|
| `UserPromptSubmit` | 眯眼晃头 ——「收到，让我想想」 |
| `PreToolUse` / `PostToolUse` | 专注抖动 ——「调用工具中...」 |
| `Stop`（任务结束） | 弹跳 + 咧嘴笑 ——「搞定！」 |
| `Notification` | 睁大眼 ——「需要你确认一下」 |
| `SessionStart` / `SessionEnd` | 回到待机 ——「开工了 / 收工，摸鱼~」 |
| `PreCompact` | 忙碌 ——「整理上下文中...」 |

**安装**

```bash
npm run install-hook     # 注册钩子（会自动备份原配置）
# 然后完全退出并重启 WorkBuddy 才会生效
```

**卸载**

```bash
npm run uninstall-hook
```

**原理**

```
WorkBuddy ──hooks──▶ scripts/status-hook.mjs ──▶ ~/.workbuddy-points-pet/events.spool
                                                          │
                                                    src/spool.js（尾部监听）
                                                          │
                                                    Electron IPC ──▶ 桌宠换表情
```

**隐私与安全**

- 钩子**只写入结构性字段**：事件名、时间戳、会话 ID、工具名、通知类型。
  **不记录提示词、回答内容、文件内容、工具参数或任何输出结果。**
- 钩子 **fail-open**：任何异常都静默退出，绝不阻塞或拖慢 WorkBuddy。
- spool 超过 2 MB 自动轮转，不会无限增长。
- 收到第一个真实事件后，桌宠会自动关闭「模拟模式」，不再自己瞎表演。
- 安装脚本只在本机改写 `~/.workbuddy/settings.json`，**不读取、不打印、不上传**其中的任何密钥，且每次都会生成带时间戳的备份。

## 接你自己的数据源

**① WorkBuddy 积分（当前推荐）**

没有公开 API，用 `file` 模式：在「设置」里把数据源切到「本地文件 / 手动录入」，填当前积分；之后每次手动改一下数字即可。也可以让某个脚本把余额写进一个 JSON 文件，配 `file.path` 让它自动读。

**② DeepSeek 余额（自动）**

数据源切 `http`：

```json
{
  "source": "http",
  "http": {
    "url": "https://api.deepseek.com/user/balance",
    "headers": { "Authorization": "Bearer 你的_DEEPSEEK_KEY" },
    "jsonPath": "balance_infos[0].total_balance"
  }
}
```

**③ 任意 HTTP 接口**

只要你的服务返回一个 JSON，并用 `jsonPath` 指到余额字段即可，例如返回 `{"balance": 123}` 就填 `jsonPath: "balance"`。

## 打包成 exe（给别人分发）

```bash
npm run dist
```

`dist/` 下会生成便携版 `*.exe` 与安装版 `Setup *.exe`（图标在 `assets/icon.png`）。

## 技术栈

Electron（透明窗 + 原生托盘/菜单）+ 内联 SVG 角色 + 前端轮询渲染。无后端、无数据库。

## 开源协议

MIT

## 相关项目（同类开源桌宠）

本项目不是唯一，下面这些也是社区开源的 WorkBuddy / AI 桌宠，供参考与学习：

- [STFQ/agent-buddy-workbuddy](https://github.com/STFQ/agent-buddy-workbuddy) — 显示 WorkBuddy 积分 + 实时 agent 状态（macOS）
- [xiaoshuxiaofu/WorkBuddy-pet](https://github.com/xiaoshuxiaofu/WorkBuddy-pet) — 聊天感知动画、多角色切换（Windows）
- [FlashFamily/workbuddy-buddy](https://github.com/FlashFamily/workbuddy-buddy) — 多伙伴 + hooks 联动（Rust/Tauri，macOS）
- [oahc09/workbuddy-pet](https://github.com/oahc09/workbuddy-pet) — 像素桌宠 + 本地 HTTP 联动（跨平台）

> 它们均为独立社区项目，与 WorkBuddy 无官方隶属关系。
