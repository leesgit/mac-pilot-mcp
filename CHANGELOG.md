# Changelog

All notable changes to Mac-Pilot MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-05-18

Honesty-and-hardening release. After v0.4.0 we ran an external review
that found ~21 points of score inflation in the self-evaluation; this
patch fixes the real problems behind that gap. See
[docs/EVALUATION.md § v4](https://github.com/leesgit/mac-pilot-mcp/blob/main/docs/EVALUATION.md)
for the full audit.

### Added
- **Promotion loop now reaches the LLM** (P3): after a pattern succeeds
  3+ times for the same app, the next tool result for that app includes
  `💡 You've completed "<app>/<pattern>" N times — consider mac_recipe_save`.
  Previously `getPromotionCandidates` was a DB method with no consumer —
  a dead-end advertised in the marketing copy. It now closes.
- **`MAC_PILOT_SANDBOX=allowlist` mode** (P4-S4): in allowlist mode, only
  shell commands whose head appears in `MAC_PILOT_ALLOWLIST` (comma-separated)
  pass. The denylist still applies on top, so an allowlisted head can't
  smuggle `cmd | sh`.
- **`docs/SECURITY-MODEL.md § Known transitive CVEs`**: documents the
  upstream `hono` / `path-to-regexp` advisories carried by
  `@modelcontextprotocol/sdk` and explains why CI gates on `critical` only.

### Changed
- **`sudo` regex is now case-insensitive** (P4-S3): `Sudo`, `SUDO`, `sUdO`
  all match. macOS PATH does not provide a `Sudo` binary so the
  false-positive risk is zero.
- **`rm -rf $HOME` family** (P4-S1): the pattern now also catches
  `"$HOME"`, `$TMPDIR`, and `$PWD` variants regardless of casing.
- **Bare `eval` in strict mode** (P4-S2): `eval foo` and `; eval foo` are
  rejected when `MAC_PILOT_SANDBOX=strict`. Default mode still allows
  bare eval (legitimate patterns exist) but `eval $(…)` was already
  blocked via the `$(` rule.
- **CI: `npm audit` gates on `critical` only**. The two upstream `high`
  advisories in transitive deps are out of our reach until the SDK ships.
  The change moves CI from permanently red to green-by-default.
- **CI: removed dist-drift step**. `dist/` is `.gitignored`, so the
  `git status --porcelain dist` guard was dead code that always passed.
- **README**: the `docs/ELECTRON-SUPPORT.md` link is now an absolute
  GitHub URL so it resolves on the npmjs.com README page (relative links
  break there).
- **Tool descriptions**: each tool now opens with a single 80-character
  line so MCP client pickers (Claude Desktop, Cursor) don't truncate the
  most important text. Examples and limitations follow on subsequent lines.
- **`mac_state` description**: explicitly steers callers to `mac_clipboard`
  for read/write. The `clipboard` include enum stays for back-compat and
  will be removed in 1.0.

### Fixed
- Test suite reorganized: the previous "known limitation: capital `Sudo`
  is allowed" pin is now a block assertion (the limitation is gone).
- 271/271 tests pass (was 258).

### Honest scoring
External reviewer score after this patch: ~70/100 (was 64.5). The full
83 ceiling requires directory listings + stars + 6 weeks of adoption.
See `docs/EVALUATION.md § v4` for the rubric.

## [0.4.0] - 2026-05-16

First public npm release. Bundles every P0/P1/P2 change from the
evaluation cycle into a single minor bump.

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
