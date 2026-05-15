# MCP Client Compatibility

Mac-Pilot speaks the standard [Model Context Protocol](https://modelcontextprotocol.io)
over stdio. Any client that supports stdio MCP servers should work; this page
documents the install snippets and the tested clients.

> **Tested**: ✅ Claude Code (CLI), Claude Desktop, Cursor.
> **Should work, not yet verified**: Windsurf, Continue.dev, Cline, Zed (via mcp-edit).

## Claude Code (CLI)

Add to `~/.config/claude-code/mcp.json` or via `claude mcp add`:

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

Or for a globally-installed copy:

```bash
npm install -g mac-pilot-mcp
claude mcp add mac-pilot mac-pilot-mcp
```

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Restart Claude Desktop. The 7 tools appear under the plug icon.

## Cursor

Settings → Features → MCP Servers → Add new server.

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

For full Electron AX in Cursor itself, also launch Cursor with
`--remote-debugging-port=9223`:

```bash
open -a "Cursor" --args --remote-debugging-port=9223
```

## Windsurf

`~/.codeium/windsurf/mcp_config.json`:

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

## Continue.dev / Cline / Zed

Same JSON shape, in the client's MCP config. No client-specific quirks
observed in the protocol surface (we use only `tools/list` and `tools/call`).

## Permission grants (one-time, per client app)

The MCP client app — **not** Mac-Pilot — is what macOS sees as the
process driving AppleScript / Accessibility. Grant the following to your
client app once:

1. **Automation**: System Settings → Privacy & Security → Automation →
   expand `<client app>` and enable the apps you plan to drive (Finder,
   Safari, …). Mac-Pilot adds entries lazily, one per app touched.
2. **Accessibility**: System Settings → Privacy & Security → Accessibility
   → enable `<client app>`. Required for `mac_find_ui`, `click`, `type`,
   `keypress`.
3. **Screen Recording** *(only if you use `mac_screenshot`)*: same panel,
   Screen Recording section.

## Compatibility matrix

| Client | stdio MCP | Verified | Notes |
|--------|-----------|----------|-------|
| Claude Code (CLI) | ✅ | 2026-05 | Primary dev target |
| Claude Desktop | ✅ | 2026-05 | Tool icon shows all 7 tools |
| Cursor | ✅ | 2026-05 | For self-introspection, launch with `--remote-debugging-port` |
| Windsurf | ✅ | — | Should work; config is identical |
| Continue.dev | ✅ | — | Should work |
| Cline | ✅ | — | Should work |
| Zed | ✅ (via plugin) | — | Should work |

## Troubleshooting

- **"Spawn npx ENOENT"** — your client can't find Node. Either install
  globally (`npm i -g mac-pilot-mcp`) and use `command: "mac-pilot-mcp"`
  directly, or put the absolute path to `npx` in `command`.
- **"Not authorized to send Apple events"** — the *client* app, not
  Mac-Pilot, needs Automation permission for the target app. The error
  message names the missing pair.
- **`mac_find_ui` returns empty for VSCode/Slack/etc.** — Electron AX trees
  are thin. Pass `useElectronFallback: "auto"` and ensure the app was
  launched with `--remote-debugging-port=<PORT>`.
- **`SIGABRT` on first call** — usually an `npm install` issue with the
  `better-sqlite3` prebuild. Rebuild: `npm rebuild better-sqlite3`.
