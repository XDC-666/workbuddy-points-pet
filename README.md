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
- **积分自动上报**（可选）：装钩子后，余额随每次对话 / 工具调用自动扣减，无需手动填
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

## 快速开始

### 方式一：双击 exe 运行（推荐）

```bash
npm run dist
```

打包完成后 `dist/` 下会出现两个文件：

- `WorkBuddy 积分桌宠 1.0.0.exe` —— **绿色便携版，双击即用**（推荐你自己日常用）
- `WorkBuddy 积分桌宠 Setup 1.0.0.exe` —— 安装版（推荐给别人分发）

首次运行会在用户目录生成 `config.json`，右键桌宠 → 设置 → 填入你的积分即可。

### 方式二：从源码运行

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
| `http.method` | 请求方法，默认 `GET` |
| `http.headers` | 请求头，如 `Authorization`、`Cookie` |
| `http.body` | POST 请求体（对象或字符串） |
| `http.jsonPath` | 从返回 JSON 里取余额的路径，支持 `a.b[0].c`，也支持 `a.b[*].c` 对数组该字段求和 |
| `refreshIntervalSec` | 刷新间隔（秒，最小 5） |
| `lowBalanceThreshold` | 低于此值弹系统提醒 |
| `scale` | 缩放倍数 |
| `idleFade` | 闲置是否半透明 |
| `autoPlay` | 是否自动模拟「思考 → 工作 → 完成」的状态循环 |
| `quotes` | 待机随机语录数组 |
| `tapLines` | 点击桌宠时随机说的台词数组 |
| `initialBalance` | 钩子自动上报用的初始积分（首次保存时初始化余额基准） |
| `costPerEvent` | 每次计入事件扣减的积分（默认 1） |
| `autoDeduct` | 是否启用钩子自动扣减（默认 true） |

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

## 钩子自动上报积分（可选）

上面的真实状态联动只换表情；这个选项让积分也跟着你每次交互自动减少。

> 说明：WorkBuddy 没有公开积分 API，本地也无余额缓存。这里的「余额」是**基于交互次数估算消耗**——你先在设置里填一次真实初始积分和单次消耗，之后每次对话/工具调用自动扣减，桌宠实时显示剩余。

**步骤**

1. 已 `npm run install-hook` 装好钩子（见上文）。
2. 右键桌宠 → 设置 →「我的初始积分」填你当前真实剩余积分，「每次交互消耗」填每次扣多少（如 1）。
3. 保存。此时会在本机 `~/.workbuddy-points-pet/` 生成 `prefs.json`（初始积分与消耗）并初始化 `balance.json`（当前余额）。
4. 之后正常使用 WorkBuddy，桌宠余额实时下降；数值低于「低余额提醒阈值」会弹系统提醒。

**原理**

```
WorkBuddy ──hooks──▶ status-hook.mjs
                     ├─ 写 events.spool（状态联动用）
                     └─ 按 prefs.json 的 costPerEvent，对计入事件扣减
                        ~/.workbuddy-points-pet/balance.json
                             │
                       src/store.js 定时读取（file 模式优先）
                             │
                       桌宠显示剩余积分
```

计入「消耗」的事件：`UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `PreCompact`。

**重置 / 调整**

- 想重新设定基准余额：删掉 `~/.workbuddy-points-pet/balance.json`，再到设置改「我的初始积分」保存即可。
- 想只调消耗不影响余额：直接在设置改「每次交互消耗」保存（余额基准不会被覆盖）。
- 关闭自动扣减：设置里取消「启用自动扣减」即可，余额停止变化。

## 接你自己的数据源

**① WorkBuddy 积分（当前推荐）**

WorkBuddy 官方后台会调用内部接口返回剩余积分。你可以用浏览器 DevTools 抓到它，再配成 `http` 数据源，让桌宠直接显示真实余额：

1. 浏览器打开 `https://www.workbuddy.cn/profile/plans-usage`，按 `F12` → Network（网络）。
2. 刷新页面，找到请求 `get-user-resource-summary`。
3. 右键该请求 → Copy → Copy as cURL，或者查看 Headers 里的 **Cookie** 字段并复制整行。
4. 把下面配置里的 `Cookie` 替换为你复制的值，保存到 `%APPDATA%\workbuddy-points-pet\config.json`：

```json
{
  "source": "http",
  "label": "WorkBuddy 积分",
  "http": {
    "url": "https://www.workbuddy.cn/billing/meter/get-user-resource-summary",
    "method": "POST",
    "body": {},
    "headers": {
      "Content-Type": "application/json",
      "Cookie": "粘贴你的 Cookie"
    },
    "jsonPath": "data.Packages[*].CycleRemainCapacity"
  }
}
```

- `data.Packages[*].CycleRemainCapacity` 会把所有资源包的剩余积分相加。
- Cookie 会过期，过期后按上面步骤重新复制一次即可。
- 你也可以换成 `https://www.workbuddy.cn/activity/growth/energy`（GET，jsonPath 填 `data.balance`）显示成长能量。

如果你没有抓包条件，也可以用上面「钩子自动上报积分」的方式，让 `file` 模式读取钩子维护的 `~/.workbuddy-points-pet/balance.json`，余额随交互估算扣减。

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

## 开机自启（Windows）

每次开机都想让它自动出现，不用手动双击？

### 一键设置

```bash
npm run add-startup
```

运行后会在 Windows 启动目录里创建一个快捷方式，**重启电脑后桌宠会自动运行**。

### 手动设置

1. 按 `Win + R`，输入 `shell:startup`，回车
2. 把 `dist/WorkBuddy 积分桌宠 1.0.0.exe` 的快捷方式拖进去
3. 重启验证

### 取消开机自启

按 `Win + R` 输入 `shell:startup`，删除 `WorkBuddyPointsPet.lnk` 即可。

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
