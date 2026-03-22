# mac-pilot-mcp

> Self-learning macOS automation MCP server — gets smarter with every use.

Unlike other macOS automation MCP servers, Mac-Pilot **remembers** what worked and what didn't. Save successful automations as recipes and replay them instantly. The more you use it, the faster it gets.

## Why Mac-Pilot?

There are 7+ macOS automation MCP servers. None remember anything. Every session starts from zero.

Mac-Pilot is different:
- **Learns from success** — Save working action sequences as reusable recipes
- **Learns from failure** — Error logs prevent repeating the same mistakes
- **App-specific knowledge** — Remembers quirks and workarounds per app
- **Security first** — Dangerous commands are blocked, everything is audit-logged

## Installation

```bash
npm install -g mac-pilot-mcp
```

### Claude Code Setup

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "mac-pilot": {
      "command": "mac-pilot-mcp"
    }
  }
}
```

### macOS Permissions

Mac-Pilot needs **Accessibility** permission for UI automation:

1. Open **System Preferences > Privacy & Security > Accessibility**
2. Add your terminal app (Terminal, iTerm2, etc.)

## Tools (7)

| Tool | Description |
|------|-------------|
| `mac_run` | Execute AppleScript, shell commands, open apps/URLs, click, type, keypress |
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

## Examples

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

- **Blocked**: `sudo`, `rm -rf /`, `curl | sh`, `dd if=`, keychain access, and 15+ dangerous patterns
- **Risk levels**: Every action is classified as low/medium/high/blocked
- **Audit trail**: All actions (including blocked ones) are logged to SQLite
- **Dry run**: Every tool supports `dryRun: true` to validate before executing

## Data Storage

- Database: `~/.mac-pilot/pilot.db` (SQLite)
- Contains: action logs, recipes, app knowledge, security audit log

## Requirements

- macOS (darwin only)
- Node.js >= 18
- Accessibility permission for UI automation features

## License

MIT
