# mac-pilot-mcp

[![npm version](https://img.shields.io/npm/v/mac-pilot-mcp)](https://www.npmjs.com/package/mac-pilot-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)](https://github.com/leesgit/mac-pilot-mcp)

> Self-learning macOS automation MCP server — gets smarter with every use.

Unlike other macOS automation MCP servers, Mac-Pilot **remembers** what worked and what didn't. Save successful automations as recipes and replay them instantly. The more you use it, the faster it gets.

**Ships with 21 built-in recipes** so you can start automating immediately.

## Why Mac-Pilot?

There are 7+ macOS automation MCP servers. None remember anything. Every session starts from zero.

Mac-Pilot is different:
- **Learns from success** — Successful patterns are auto-saved as app knowledge
- **Learns from failure** — Error patterns are recorded to prevent repeating mistakes
- **App-specific knowledge** — Remembers quirks and workarounds per app
- **21 built-in recipes** — Dark mode, volume, screenshots, clipboard, Finder, Safari, and more
- **JXA support** — JavaScript for Automation in addition to AppleScript
- **Security first** — Dangerous commands are blocked, everything is audit-logged

## Installation

```bash
npm install -g mac-pilot-mcp
```

### Claude Code

```bash
claude mcp add mac-pilot -- mac-pilot-mcp
```

Or add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "mac-pilot": {
      "command": "mac-pilot-mcp"
    }
  }
}
```

### Claude Desktop

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

### Cursor / Windsurf

Add to your MCP settings:

```json
{
  "mac-pilot": {
    "command": "npx",
    "args": ["-y", "mac-pilot-mcp"]
  }
}
```

### macOS Permissions

Mac-Pilot needs **Accessibility** permission for UI automation:

1. Open **System Settings > Privacy & Security > Accessibility**
2. Add your terminal app (Terminal, iTerm2, VS Code, Cursor, etc.)

## Tools (7)

| Tool | Description |
|------|-------------|
| `mac_run` | Execute AppleScript, JXA, shell commands, open apps/URLs, click, type, keypress |
| `mac_state` | Get current system state (active app, windows, clipboard, etc.) |
| `mac_find_ui` | Find UI elements using Accessibility API |
| `mac_screenshot` | Capture screen/window/region as base64 PNG |
| `mac_recipe_save` | Save a working action sequence as a reusable recipe |
| `mac_recipe_run` | Execute a saved recipe with parameter substitution |
| `mac_recipe_search` | Search recipes and action history |

## The Learning Loop

```
You: "Export the current Figma frame as PNG"

First time:
  1. mac_recipe_search("Figma export PNG") → No results
  2. mac_state → Figma is frontmost
  3. mac_run (applescript) → File > Export As > PNG
  4. mac_recipe_save("export-figma-png", steps=[...])

Next time:
  1. mac_recipe_search("Figma export PNG") → Found: export-figma-png (100% success rate)
  2. mac_recipe_run("export-figma-png") → Done instantly
```

## Built-in Recipes (21)

Mac-Pilot ships with ready-to-use recipes:

| Category | Recipes |
|----------|---------|
| **System** | `toggle-dark-mode`, `get-dark-mode`, `set-volume`, `mute-toggle`, `empty-trash`, `screenshot-desktop`, `lock-screen`, `show-desktop` |
| **Finder** | `new-finder-window`, `get-selected-files` |
| **Safari** | `safari-current-url`, `safari-current-title` |
| **Clipboard** | `get-clipboard`, `set-clipboard` |
| **Notifications** | `notify` |
| **Terminal** | `open-terminal-at`, `kill-process` |
| **Windows** | `list-windows`, `close-front-window` |
| **Music** | `music-play-pause`, `music-next-track` |

Use any built-in recipe immediately:
```
mac_recipe_run { name: "toggle-dark-mode" }
mac_recipe_run { name: "set-volume", params: { level: "50" } }
mac_recipe_run { name: "notify", params: { title: "Done!", message: "Build complete" } }
```

## Examples

### AppleScript
```
mac_run { actionType: "applescript", script: "tell application \"Finder\" to get name of every window" }
```

### JXA (JavaScript for Automation)
```
mac_run { actionType: "jxa", script: "Application('Safari').documents[0].url()" }
```

### Open an app
```
mac_run { actionType: "open", target: "Safari" }
```

### Run a shell command
```
mac_run { actionType: "shell", command: "ls -la ~/Desktop" }
```

### Type text
```
mac_run { actionType: "type", text: "Hello World" }
```

### Keyboard shortcut
```
mac_run { actionType: "keypress", text: "cmd+c" }
```

### Save a recipe
```
mac_recipe_save {
  name: "screenshot-desktop",
  description: "Take a screenshot and save to Desktop",
  steps: [
    { actionType: "shell", params: { command: "screencapture ~/Desktop/screenshot.png" }, description: "Capture screen" }
  ]
}
```

### Search recipes
```
mac_recipe_search { query: "screenshot" }
```

### Run a recipe
```
mac_recipe_run { name: "screenshot-desktop" }
```

## Security

Mac-Pilot takes security seriously:

- **Blocked**: `sudo`, `rm -rf /`, `curl | sh`, `dd if=`, `$()` subshell injection, keychain access, and 20+ dangerous patterns
- **Risk levels**: Every action is classified as low/medium/high/blocked
- **Audit trail**: All actions (including blocked ones) are logged to SQLite
- **Dry run**: Every tool supports `dryRun: true` to validate before executing
- **Auto-cleanup**: Action logs older than 30 days are automatically pruned

## Data Storage

- Database: `~/.mac-pilot/pilot.db` (SQLite with WAL mode)
- Contains: action logs, recipes, app knowledge, security audit log
- Built-in recipes are auto-loaded on first run

## Troubleshooting

### "Accessibility access not allowed"
Your terminal app needs Accessibility permission:
1. Open **System Settings > Privacy & Security > Accessibility**
2. Toggle ON for your terminal app
3. Restart your terminal

### "Application not found or not running"
The target app must be running for `mac_find_ui` and window-based `mac_screenshot`. Open it first with `mac_run { actionType: "open", target: "AppName" }`.

### Screenshots are too large
Use the `scale` parameter (default 0.5): `mac_screenshot { target: "screen", scale: 0.3 }`

### Recipe not found
Search first: `mac_recipe_search { query: "your keyword" }`. Recipe names are case-sensitive.

## Requirements

- macOS (darwin only)
- Node.js >= 18
- Accessibility permission for UI automation features

## License

MIT
