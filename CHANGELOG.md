# Changelog

All notable changes to Mac-Pilot MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Electron AX fallback (P1-B)**: `mac_find_ui` now optionally talks to
  Chrome DevTools Protocol for Electron apps (VSCode, Cursor, Slack, Discord,
  Figma, Notion, Linear, Obsidian). Pass `useElectronFallback: "auto"` or
  `true`. Zero new runtime dependencies — a hand-rolled RFC 6455 client is
  used. Requires the user to launch the target app with
  `--remote-debugging-port=<PORT>`.
- **Self-learning rewrite (P1-A)**: errors are classified into a stable
  taxonomy (`permission`, `app_not_running`, `object_missing`,
  `invalid_syntax`, `timeout`, `rate_limit`, `unknown`) with an actionable
  suggestion + retry strategy. Knowledge entries dedupe by class instead of
  raw error text. Hints (reliability ≥ 0.7) are auto-prepended to every tool
  result, not just failures. Action patterns are tracked separately so the
  system can suggest promoting frequent patterns to recipes.
- **+97 built-in recipes (P1-C)**: 21 → 118 total. New categories: Finder,
  Safari, Mail, Notes, Messages, Calendar, Reminders, Shortcuts, System,
  Productivity, Music. See `src/recipes/builtin.ts`.
- **Sandbox dead-code activation (P0-0)**: `hasPipeChain` is now wired into
  `checkSecurity`; pipelines whose sink is `sh|bash|zsh|eval|python|node|
  ruby|perl` are blocked even when the prefix is dynamic.
- **AppleScript `do shell script` recursion (P0-1)**: the inner shell command
  is now re-checked against the shell sandbox rules, closing an injection bypass.
- **Audit-log masking (P0-2)**: `password`, `token`, `secret`, `api_key`,
  `authorization`, `bearer`, plus Bearer/JWT/sk-/xoxb- token shapes are
  redacted before any DB write.
- **Strict sandbox mode (P0-3)**: `MAC_PILOT_SANDBOX=strict` rejects shell
  chain tokens (`;`, `&&`, `||`) outside quotes. Default mode allows them.
- **SQLite hardening (P0-4)**: `busy_timeout=5000`, `synchronous=NORMAL`,
  `updateRecipeStats` wrapped in a transaction. Eliminates TOCTOU on
  concurrent recipe invocations.
- **Graceful shutdown (P0-5)**: `SIGINT`/`SIGTERM`/`uncaughtException`/
  `unhandledRejection` handlers; idempotent shutdown.
- **DB file permissions (P0-6)**: `~/.mac-pilot/` is created with mode 0700
  and `pilot.db` with 0600 (unix only).
- **AppleScript text escape (P0-7)**: `escapeForAppleScriptLiteral` rejects
  control characters (U+0000–U+001F, U+007F) for `type` / `keypress` inputs.
- **GitHub Actions CI matrix**: build + test on macOS 13/14/15 × Node 20/22,
  plus `npm audit --audit-level=high`.
- **Docs**: `EVALUATION.md`, `IMPROVEMENT_PLAN.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/ELECTRON-SUPPORT.md`,
  `docs/MCP-COMPATIBILITY.md`.

### Changed
- Tool descriptions for all 7 tools now include an `Examples:` block and a
  `Limitations:` block so LLMs make better first-call choices (P1-H).
- The "self-learning macOS automation" marketing string in startup logs was
  changed to "sandbox-protected macOS automation" until the new learning
  loop has been validated in the wild for a release cycle.

### Fixed
- `index.ts` version string was `0.3.0` while `package.json` was already `0.3.1`.

### Tests
- 144 → 215 (+71). Coverage: error-pattern classification, learning DB
  paths, sandbox bypass regression (`do shell script`, pipe sinks, chain
  tokens), audit masking, AppleScript literal escape, Electron CDP probe.

## [0.3.1] - 2026-04 (pre-published)

### Added
- Built-in recipes infrastructure (21 starter recipes).

## [0.3.0] - 2026-03 (pre-published)

### Added
- JXA support (`actionType: "jxa"`).
- `src/security/sandbox.ts` with shell + AppleScript pattern blocklist.
- README rewrite + npm keywords.

## [0.1.0] - Initial scaffold

- 7 MCP tools (`mac_run`, `mac_state`, `mac_find_ui`, `mac_screenshot`,
  `mac_recipe_save`, `mac_recipe_run`, `mac_recipe_search`).
- SQLite-backed action log + recipe store.
