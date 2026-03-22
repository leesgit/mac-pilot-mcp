<p align="center">
  <h1 align="center">mac-pilot-mcp</h1>
  <p align="center">
    <strong>Self-learning macOS automation for AI agents</strong>
  </p>
  <p align="center">
    The only macOS MCP server that <em>remembers</em>. Save what works, skip what doesn't.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mac-pilot-mcp"><img src="https://img.shields.io/npm/v/mac-pilot-mcp?color=cb3837&label=npm" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/mac-pilot-mcp"><img src="https://img.shields.io/npm/dm/mac-pilot-mcp?color=cb3837" alt="npm downloads"></a>
    <a href="https://github.com/leesgit/mac-pilot-mcp"><img src="https://img.shields.io/github/stars/leesgit/mac-pilot-mcp?style=social" alt="GitHub stars"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
    <a href="#"><img src="https://img.shields.io/badge/platform-macOS-000?logo=apple&logoColor=white" alt="macOS"></a>
    <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node.js"></a>
  </p>
</p>

---

## The Problem

There are 7+ macOS automation MCP servers. **None of them remember anything.** Every session starts from zero — same trial and error, same failures, same wasted tokens.

## The Solution

Mac-Pilot is different. It **learns from every interaction**:

- **Success?** The pattern is auto-saved as app-specific knowledge
- **Failure?** The error is recorded so it won't repeat the same mistake
- **Multi-step workflow?** Save it as a recipe — replay it in one call next time

Ships with **21 built-in recipes** so you're productive from the first run.

---

## Quick Start

### Install

```bash
npm install -g mac-pilot-mcp
```

### Connect to your AI client

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add mac-pilot -- mac-pilot-mcp
```

Or manually add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "mac-pilot": {
      "command": "mac-pilot-mcp"
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mac-pilot": {
      "command": "npx",
      "args": ["-y", "mac-pilot-mcp"]
    }
  }
}
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to your MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mac-pilot": {
      "command": "npx",
      "args": ["-y", "mac-pilot-mcp"]
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your MCP config:

```json
{
  "mcpServers": {
    "mac-pilot": {
      "command": "npx",
      "args": ["-y", "mac-pilot-mcp"]
    }
  }
}
```
</details>

### Grant Permissions

Mac-Pilot needs **Accessibility** access for UI automation:

1. **System Settings** → **Privacy & Security** → **Accessibility**
2. Toggle **ON** for your terminal app (Terminal, iTerm2, VS Code, Cursor, etc.)
3. Restart the terminal

---

## How It Works

```
You: "Export the current Figma frame as PNG"

┌─ First time ─────────────────────────────────────────┐
│                                                       │
│  1. mac_recipe_search("Figma export") → No matches   │
│  2. mac_state() → Figma is frontmost                 │
│  3. mac_run(applescript) → File > Export > PNG        │
│  4. mac_recipe_save("export-figma-png", steps=[...]) │
│                                                       │
│  ✓ Worked! Pattern saved automatically.              │
└───────────────────────────────────────────────────────┘

┌─ Next time ───────────────────────────────────────────┐
│                                                       │
│  1. mac_recipe_search("Figma export")                │
│     → Found: export-figma-png (100% success rate)    │
│  2. mac_recipe_run("export-figma-png")               │
│     → Done instantly                                  │
│                                                       │
│  ⚡ 4 steps → 2 steps. No trial and error.           │
└───────────────────────────────────────────────────────┘
```

---

## Tools

| Tool | What it does |
|------|-------------|
| **`mac_run`** | Execute AppleScript, JXA, shell commands, open apps/URLs, click, type, keypress |
| **`mac_state`** | Query system state — frontmost app, windows, clipboard, running apps |
| **`mac_find_ui`** | Find UI elements via Accessibility API (buttons, fields, menus) |
| **`mac_screenshot`** | Capture screen/window/region as base64 PNG |
| **`mac_recipe_save`** | Save a working action sequence as a reusable recipe |
| **`mac_recipe_run`** | Replay a saved recipe with parameter substitution |
| **`mac_recipe_search`** | Full-text search across recipes and action history |

---

## Built-in Recipes

21 recipes ship out of the box — no setup needed:

| Category | Recipes | Example |
|----------|---------|---------|
| **System** | `toggle-dark-mode` `set-volume` `mute-toggle` `lock-screen` `show-desktop` `screenshot-desktop` `empty-trash` `get-dark-mode` | `mac_recipe_run { name: "toggle-dark-mode" }` |
| **Finder** | `new-finder-window` `get-selected-files` | `mac_recipe_run { name: "new-finder-window", params: { path: "/tmp" } }` |
| **Safari** | `safari-current-url` `safari-current-title` | `mac_recipe_run { name: "safari-current-url" }` |
| **Clipboard** | `get-clipboard` `set-clipboard` | `mac_recipe_run { name: "set-clipboard", params: { text: "Hello" } }` |
| **Notifications** | `notify` | `mac_recipe_run { name: "notify", params: { title: "Done", message: "Build passed" } }` |
| **Terminal** | `open-terminal-at` `kill-process` | `mac_recipe_run { name: "open-terminal-at", params: { path: "~/dev" } }` |
| **Windows** | `list-windows` `close-front-window` | `mac_recipe_run { name: "close-front-window" }` |
| **Music** | `music-play-pause` `music-next-track` | `mac_recipe_run { name: "music-play-pause" }` |

---

## Examples

### AppleScript

```json
{ "actionType": "applescript", "script": "tell application \"Finder\" to get name of every window" }
```

### JXA (JavaScript for Automation)

```json
{ "actionType": "jxa", "script": "Application('Safari').documents[0].url()" }
```

### Shell command

```json
{ "actionType": "shell", "command": "ls -la ~/Desktop" }
```

### Open an app or URL

```json
{ "actionType": "open", "target": "Safari" }
{ "actionType": "open", "target": "https://github.com" }
```

### Type text

```json
{ "actionType": "type", "text": "Hello World" }
```

### Keyboard shortcut

```json
{ "actionType": "keypress", "text": "cmd+c" }
{ "actionType": "keypress", "text": "cmd+shift+4" }
```

### Find UI elements

```json
mac_find_ui { "app": "Safari", "role": "AXButton" }
mac_find_ui { "app": "Finder", "searchText": "Downloads" }
```

### Take a screenshot

```json
mac_screenshot { "target": "screen", "scale": 0.3 }
mac_screenshot { "target": "window", "windowName": "Safari" }
```

### Save a custom recipe

```json
mac_recipe_save {
  "name": "open-project",
  "description": "Open VS Code at project directory",
  "steps": [
    { "actionType": "shell", "params": { "command": "code {{path}}" }, "description": "Open VS Code" }
  ],
  "parameters": [
    { "name": "path", "description": "Project directory path" }
  ],
  "tags": ["dev", "vscode"]
}
```

---

## Security

Mac-Pilot blocks dangerous operations before they execute:

| Layer | Protection |
|-------|-----------|
| **Hard block** | `sudo`, `rm -rf /`, `curl\|sh`, `dd if=`, `$()` subshell injection, keychain access, `csrutil disable`, `diskutil erase`, and 20+ patterns |
| **Risk classification** | Every action is rated `low` / `medium` / `high` / `blocked` |
| **Audit log** | All actions (including blocked ones) are logged to SQLite |
| **Dry run** | Test any action with `dryRun: true` before executing |
| **Auto-cleanup** | Action logs older than 30 days are pruned automatically |

---

## Architecture

```
~/.mac-pilot/pilot.db (SQLite, WAL mode)
├── action_log       — Every action executed, with timing + success/failure
├── action_log_fts   — Full-text search index over action history
├── recipes          — Saved automation sequences
├── recipes_fts      — Full-text search index over recipes
├── app_knowledge    — Per-app quirks, selectors, workarounds (auto-learned)
└── security_log     — Blocked command audit trail
```

Built-in recipes are auto-loaded on first run. Your custom recipes and learned knowledge persist across sessions.

---

## Comparison

| Feature | mac-pilot-mcp | Other MCP servers |
|---------|:---:|:---:|
| Self-learning (auto-saves knowledge) | **Yes** | No |
| Reusable recipes with parameters | **Yes** | No |
| Built-in recipe library | **21** | 0 |
| JXA + AppleScript | **Both** | Usually one |
| Full-text search (recipes + history) | **Yes** | No |
| Security audit log | **Yes** | Rare |
| Risk classification (4 levels) | **Yes** | No |
| Dry run mode | **Yes** | Rare |
| Action log auto-cleanup | **Yes** | No |

---

## Troubleshooting

<details>
<summary><strong>"Accessibility access not allowed"</strong></summary>

Your terminal needs Accessibility permission:
1. **System Settings** → **Privacy & Security** → **Accessibility**
2. Toggle **ON** for your terminal
3. **Restart** the terminal app completely
</details>

<details>
<summary><strong>"Application not found or not running"</strong></summary>

The target app must be running. Open it first:
```json
mac_run { "actionType": "open", "target": "AppName" }
```
</details>

<details>
<summary><strong>Screenshots are too large / slow</strong></summary>

Reduce the scale (default is 0.5):
```json
mac_screenshot { "target": "screen", "scale": 0.3 }
```
</details>

<details>
<summary><strong>Recipe not found</strong></summary>

Recipe names are case-sensitive. Search first:
```json
mac_recipe_search { "query": "your keyword" }
```
</details>

<details>
<summary><strong>Command blocked unexpectedly</strong></summary>

Use dry run to check the risk classification:
```json
mac_run { "actionType": "shell", "command": "your-command", "dryRun": true }
```
</details>

---

## Requirements

- **macOS** (darwin only)
- **Node.js** >= 18
- **Accessibility** permission for UI automation

---

## Contributing

Issues and PRs welcome at [github.com/leesgit/mac-pilot-mcp](https://github.com/leesgit/mac-pilot-mcp).

```bash
git clone https://github.com/leesgit/mac-pilot-mcp.git
cd mac-pilot-mcp
npm install
npm run build
npm test        # 144 tests
```

---

## License

MIT - [Byeongchang Lee](https://github.com/leesgit)
