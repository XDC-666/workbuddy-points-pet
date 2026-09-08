# WorkBuddy Points Pet

> ⚠️ **Disclaimer**: WorkBuddy is a product name of its respective owner. This is an independent community open-source tool and is **not affiliated with or endorsed by WorkBuddy**. The bundled robot artwork is original sample material and can be replaced freely.

A desktop floating pet that shows your AI assistant's remaining points in real time. Inspired by the popular DeepSeek whale balance pet, but with a **fully pluggable data source** — manual entry, a local JSON file, or any HTTP balance endpoint. A single-file Electron window: double-click and it runs, and anyone can run it once it's open-sourced.

**🌐 [简体中文](./README.md) | English**

> Note: WorkBuddy currently has **no public points-query API**, and locally it only caches usage counts — not balances. So this pet defaults to **manual entry / local file** mode for displaying points. If you have your own balance endpoint (DeepSeek, or a self-hosted service), switch to HTTP mode and it refreshes automatically.

🔒 Privacy: runs entirely locally — no uploads, no telemetry, no open ports. See [PRIVACY.md](./PRIVACY.md).

## Features

**Interaction (DeepSeek-pet style)**

- Single click: a random speech bubble pops up with a bouncy reaction (lines are customizable)
- Double click: opens the settings panel
- Eight states, each with its own expression and animation: idle / thinking (head tilt) / working (shaking) / done (bounce + grin) / error (head shake + X eyes) / low balance (trembling + tears) / eating (content squint + chewing) / **sleeping** (closed eyes + floating Zzz + slow breathing)
- **Sound effects**: distinct cues for click, done, error, and eating (synthesized live with Web Audio — no audio files; can be muted in settings or from the context menu)
- **Feeding easter egg**: right-click → "Feed it" makes it squint and chew with floating hearts, and it remembers how many times you've fed it
- **Real-state sync** (optional): after installing a local hook, the pet mirrors your assistant's real state changes (see below)
- **Stays "working" for the whole task**: after a prompt it thinks briefly, then stays "working" until the task truly ends — it won't flicker back to idle halfway (falls back to idle after 45s with no new events)
- **Task-complete notification**: on finish it switches to the "done" face, plays a cue, and fires a desktop notification (can be disabled in settings)
- **Auto sleep**: after long inactivity it closes its eyes, drifts Zzz, and breathes slowly; poke it or trigger a new event and it wakes instantly (default 5 minutes, configurable or off)
- **Automatic points reporting** (optional): with the hook installed, the balance decrements with each conversation / tool call — no manual entry needed
- Eyes follow the cursor, with random blinking

- Bubble text types out character by character, then fades after a few seconds
- The indicator light on its head changes color by state (cyan / amber / green / red)
- With "auto-simulate working state" on, it cycles thinking → working → done by itself
- Greets you by local time (good morning / good afternoon / it's late…)

**Basics**

- Transparent, borderless floating pet that stays in a screen corner
- Drag to move, scroll to zoom (0.6x–2x), snaps to left/right edges when nearby
- Shows remaining points + a random quote + a low-balance system notification
- Pluggable data source: `file` (manual / local file) or `http` (any balance endpoint)
- System tray icon with a context menu (refresh / settings / quit)
- Fades to semi-transparent after 4s idle; single-instance
- **Never gets in your way**: the window is click-through by default, so clicks pass to whatever is behind it; it only accepts clicks while the cursor is over the pet itself (poke / drag / settings). It never steals focus from an input box or makes your cursor stop working elsewhere. Animations also pause when idle or on low balance, to ease the load on the system compositor

> Want a quick look? Open `preview.html` in the repo (pure static — double-click it to try every interaction in your browser).

## Quick Start

### Option 1: Run the exe (recommended)

```bash
npm run dist
```

When packaging finishes, `dist/` will contain two files:

- `WorkBuddy 积分桌宠 1.0.0.exe` — **portable build, just double-click it** (recommended for your own daily use)
- `WorkBuddy 积分桌宠 Setup 1.0.0.exe` — installer (recommended for distributing to others)

On first run it creates `config.json` in your user directory; right-click the pet → Settings → enter your points balance.

### Option 2: Run from source

```bash
git clone https://github.com/XDC-666/workbuddy-points-pet.git
cd workbuddy-points-pet
npm install
npm run icons     # generate tray/window icons (pure Python, no dependencies)
npm start
```

On first launch the config file is created at:

- Windows: `%APPDATA%\workbuddy-points-pet\config.json`
- macOS / Linux: `~/.config/workbuddy-points-pet/config.json`

## Configuration

`config.json` fields:

| Field | Description |
|------|------|
| `source` | `file` or `http` |
| `label` | Name shown on the pet, e.g. `WorkBuddy points` |
| `balance` | Current points in manual mode (applies when `source=file` and no file is set) |
| `file.path` | Optional; path to a local JSON file containing a balance field |
| `file.jsonPath` | Path to the balance field inside that file; defaults to `balance` |
| `http.url` | Balance endpoint URL |
| `http.method` | HTTP method; defaults to `GET` |
| `http.headers` | Request headers, e.g. `Authorization`, `Cookie` |
| `http.body` | POST body (object or string) |
| `http.jsonPath` | Path to the balance field in the response JSON; supports `a.b[0].c` and `a.b[*].c` to sum a field across an array |
| `refreshIntervalSec` | Refresh interval in seconds (minimum 5) |
| `lowBalanceThreshold` | Below this value, a system reminder pops up |
| `scale` | Zoom factor |
| `idleFade` | Whether to fade when idle |
| `autoPlay` | Whether to auto-simulate the thinking → working → done cycle |
| `quotes` | Array of random idle lines |
| `tapLines` | Array of random lines spoken when you poke it |
| `initialBalance` | Starting points for automatic hook reporting (sets the baseline on first save) |
| `costPerEvent` | Points deducted per counted event (default 1) |
| `autoDeduct` | Whether hook auto-deduction is enabled (default true) |

## Syncing With Real WorkBuddy State (optional)

By default the pet *simulates* working states. Install the local hook and it will switch expressions in step with the real lifecycle:

| WorkBuddy event | Pet behavior |
|---|---|
| `UserPromptSubmit` | Squints and tilts — "Got it, let me think" |
| `PreToolUse` / `PostToolUse` | Focused shaking — "Calling a tool..." |
| `Stop` (task finished) | Bounce + grin — "Done!" |
| `Notification` | Eyes wide — "Need your input" |
| `SessionStart` / `SessionEnd` | Back to idle — "Starting work / clocking out~" |
| `PreCompact` | Busy — "Compacting context..." |

**Installing (two ways)**

Option 1: right-click the pet's tray icon → **"Register WorkBuddy hook"** (no command line needed, v1.1.1+)

Option 2: from the source directory

```bash
npm run install-hook     # registers the hook (backs up your existing config automatically)
```

> **Important**: after registering or modifying the hook you must **fully quit and restart WorkBuddy** for the new config to take effect. Refreshing or minimizing is not enough.

**Uninstalling**

```bash
npm run uninstall-hook
```

Alternatively, right-click the pet → **"Register WorkBuddy hook"**, which cleans up the old format before re-registering.

**How it works**

```
WorkBuddy ──hooks──▶ scripts/status-hook.mjs ──▶ ~/.workbuddy-points-pet/events.spool
                                                          │
                                                    src/spool.js (tail listener)
                                                          │
                                                    Electron IPC ──▶ pet changes expression
```

**Privacy & security**

- The hook **only writes structural fields**: event name, timestamp, session ID, tool name, notification type.
  **It does not record prompts, responses, file contents, tool arguments, or any output results.**
- The hook is **fail-open**: any exception exits silently, never blocking or slowing down WorkBuddy.
- The spool rotates automatically past 2 MB, so it never grows without bound.
- After the first real event, the pet turns off "simulation mode" and stops performing on its own.
- The installer only rewrites `~/.workbuddy/settings.json` locally; it **never reads, prints, or uploads** any secrets in it, and it takes a timestamped backup every time.

## Automatic Points Reporting via the Hook (optional)

Real-state sync only changes expressions; this option makes the points counter decrease with every interaction too.

> Note: WorkBuddy has no public points API and no local balance cache. The "balance" here is **estimated from interaction counts** — you enter your real starting balance and per-interaction cost once, then each message / tool call decrements it and the pet shows the remainder live.

**Steps**

1. Install the hook with `npm run install-hook` (see above).
2. Right-click the pet → Settings → set "My initial points" to your actual remaining balance, and "Cost per interaction" to how much to deduct each time (e.g. 1).
3. Save. This creates `prefs.json` (initial balance and cost) and initializes `balance.json` (current balance) under `~/.workbuddy-points-pet/`.
4. Use WorkBuddy normally afterwards; the pet's balance drops in real time, and a system reminder pops up below the "low balance threshold".

**How it works**

```
WorkBuddy ──hooks──▶ status-hook.mjs
                     ├─ writes events.spool (for state sync)
                     └─ decrements by costPerEvent from prefs.json for counted events
                        ~/.workbuddy-points-pet/balance.json
                             │
                       src/store.js reads it periodically (file mode takes priority)
                             │
                        pet displays remaining points
```

Events counted as "consumption": `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `PreCompact`.

**Resetting / adjusting**

- To set a fresh baseline: delete `~/.workbuddy-points-pet/balance.json`, then change "My initial points" in settings and save.
- To change only the cost without touching the balance: edit "Cost per interaction" in settings and save (the baseline is not overwritten).
- To disable auto-deduction: uncheck "Enable automatic deduction" in settings; the balance stops changing.

## Wiring Up Your Own Data Source

**① WorkBuddy points (currently recommended)**

The official WorkBuddy console calls an internal endpoint that returns remaining points. You can capture it with browser DevTools and configure it as an `http` source so the pet shows your real balance:

1. Open `https://www.workbuddy.cn/profile/plans-usage` in a browser and press `F12` → Network.
2. Reload the page and find the `get-user-resource-summary` request.
3. Right-click it → Copy → Copy as cURL, or open Headers and copy the entire **Cookie** line.
4. Replace `Cookie` in the config below with the value you copied and save it to `%APPDATA%\workbuddy-points-pet\config.json`:

```json
{
  "source": "http",
  "label": "WorkBuddy points",
  "http": {
    "url": "https://www.workbuddy.cn/billing/meter/get-user-resource-summary",
    "method": "POST",
    "body": {},
    "headers": {
      "Content-Type": "application/json",
      "Cookie": "paste-your-cookie-here"
    },
    "jsonPath": "data.Packages[*].CycleRemainCapacity"
  }
}
```

- `data.Packages[*].CycleRemainCapacity` sums the remaining points across all resource packages.
- The cookie expires; when it does, just repeat the steps above.
- You can also switch to `https://www.workbuddy.cn/activity/growth/energy` (GET, with `jsonPath` set to `data.balance`) to show growth energy instead.

**Why does it sometimes return 401 / fail?**

WorkBuddy has no public third-party points API; this endpoint is called internally by the web page. The APISIX gateway binds the `session` and other login state to the network environment, so:

- Requests from an AI execution environment, a different IP, or with an expired cookie usually return `401 Authorization Required`.
- Running the pet **on your own machine**, on the same IP as your browser with headers fully configured, generally gets a 200.

If you still get 401 locally after copying the cookie, it has usually been rotated or expired — log in to `workbuddy.cn` again and re-copy it. You can also switch back to `file` mode and use "hook-based points reporting" for an estimate.

**How do other projects get WorkBuddy points?**

Community projects generally take one of three approaches:

1. **No points, state sync only**: most open-source pets (e.g. `FlashFamily/workbuddy-buddy`, `oahc09/workbuddy-pet`, `xiaoshuxiaofu/WorkBuddy-pet`) only read agent events through WorkBuddy hooks to switch expressions, and never touch points.
2. **Reading internal/private WorkBuddy endpoints**: `STFQ/agent-buddy-workbuddy` claims to read credits directly once WorkBuddy is installed and you're logged in, but the implementation isn't open-sourced — it may call private endpoints in the local WorkBuddy installation or browser-accessible internal APIs.
3. **Cookie capture to mimic the browser**: the approach this project uses — lowest barrier and cross-platform, but the cookie needs periodic refreshing.

If you can't capture traffic, use "hook-based points reporting" above and let `file` mode read the hook-maintained `~/.workbuddy-points-pet/balance.json`, decrementing the estimate as you interact.

**② DeepSeek balance (automatic)**

Switch the data source to `http`:

```json
{
  "source": "http",
  "http": {
    "url": "https://api.deepseek.com/user/balance",
    "headers": { "Authorization": "Bearer YOUR_DEEPSEEK_KEY" },
    "jsonPath": "balance_infos[0].total_balance"
  }
}
```

**③ Any HTTP endpoint**

As long as your service returns JSON and `jsonPath` points at the balance field, it works — e.g. for `{"balance": 123}`, set `jsonPath: "balance"`.

## Launch at Startup (Windows)

Want it to appear automatically on every boot instead of double-clicking?

### One-click setup

```bash
npm run add-startup
```

This creates a shortcut in the Windows startup folder, and **the pet will launch automatically after a reboot**.

### Manual setup

1. Press `Win + R`, type `shell:startup`, press Enter
2. Drag a shortcut of `dist/WorkBuddy 积分桌宠 1.0.0.exe` into that folder
3. Reboot to verify

### Removing it

Press `Win + R`, type `shell:startup`, and delete `WorkBuddyPointsPet.lnk`.

## Packaging an exe (for distribution)

```bash
npm run dist
```

`dist/` will contain the portable `*.exe` and the `Setup *.exe` installer (icon at `assets/icon.png`).

## Automated Build & Release (GitHub Actions)

The repo ships with `.github/workflows/release.yml`, so **no local packaging is needed** — builds run in the cloud:

- **Release by pushing a tag** (recommended)

  ```bash
  git tag v1.0.1 && git push origin v1.0.1
  ```

  GitHub builds the installer on a Windows runner and creates a Release with both the portable and installer exes attached.

- **Manual build**: repo → `Actions` → `Build and Release` → `Run workflow`
  Builds only, no release; artifacts are downloadable from the Artifacts section.

### Security Design

Automated builds are where local credentials most easily leak, so the workflow adds these guards:

| Measure | Detail |
| --- | --- |
| Least privilege | `GITHUB_TOKEN` is granted only `contents: write` |
| Pinned dependencies | `npm ci` installs strictly from `package-lock.json`, preventing drift/typosquatting |
| No third-party upload actions | Only official GitHub actions and the runner's built-in `gh` CLI |
| Security gate | Pre-release scan: if `config.json` or session-credential keywords such as `session_2` / `tgw_l7_route` are found, it aborts immediately and never publishes |
| Untracked-file check | Verifies `config.json` has never been tracked by git |
| Ignores PRs | Not triggered by `pull_request`, so forks can't steal tokens |
| No caching | Avoids cache poisoning (build takes ~2 minutes, acceptable) |

**Your cookie stays local** in `%APPDATA%\workbuddy-points-pet\config.json`: it can't enter the repo (excluded by `.gitignore`) and is never baked into the installer — the app only reads it at runtime.

### Publishing a new version

```bash
# 1. Bump version in package.json
# 2. Commit the code
git add -A && git commit -m "release: v1.0.1"
git push origin master
# 3. Push a tag to trigger the cloud build and auto-release
git tag v1.0.1
git push origin v1.0.1
```

> On first use, confirm the repo's `Settings → Actions → General` allows Actions read/write (GitHub enables this by default).

## Tech Stack

Electron (transparent window + native tray/menu) + inline SVG character + frontend polling render. No backend, no database.

## License

MIT

## Related Projects (similar open-source pets)

This isn't the only one — these community WorkBuddy / AI pets are also open source, for reference and learning:

- [STFQ/agent-buddy-workbuddy](https://github.com/STFQ/agent-buddy-workbuddy) — shows WorkBuddy points + live agent state (macOS)
- [xiaoshuxiaofu/WorkBuddy-pet](https://github.com/xiaoshuxiaofu/WorkBuddy-pet) — chat-aware animations, multi-character switching (Windows)
- [FlashFamily/workbuddy-buddy](https://github.com/FlashFamily/workbuddy-buddy) — multiple companions + hook integration (Rust/Tauri, macOS)
- [oahc09/workbuddy-pet](https://github.com/oahc09/workbuddy-pet) — pixel pet + local HTTP integration (cross-platform)

> All are independent community projects with no official affiliation to WorkBuddy.
