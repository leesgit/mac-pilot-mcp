# Mac-Pilot Security Model

> A reference description of what Mac-Pilot's sandbox actually does. Useful
> if you're evaluating MCP servers for a multi-tenant or compliance-sensitive
> environment, or if you're designing a similar sandbox elsewhere.

This is **how**, paired with [SECURITY.md](../SECURITY.md)'s **what** (threat
model + disclosure). Together they let an outside reviewer answer the
question *"can I trust this with my home directory?"* without reading source.

## Trust boundary

```
┌────────────────────────────────────────────────────────────────┐
│                       Your macOS user account                  │
│                                                                │
│  ┌────────────────┐    stdio    ┌─────────────────────────┐    │
│  │  MCP client    │ ◀────────▶ │  Mac-Pilot MCP server   │    │
│  │  (Claude       │             │  (this project)         │    │
│  │   Desktop, …)  │             │                         │    │
│  └────────────────┘             │  ┌──────────────────┐   │    │
│        ▲                        │  │  Sandbox         │   │    │
│        │ LLM tool calls         │  │  (sandbox.ts)    │   │    │
│        │                        │  └────────┬─────────┘   │    │
│  ┌─────┴──────┐                 │           │ allow/deny  │    │
│  │  Anthropic │                 │  ┌────────▼─────────┐   │    │
│  │  /OpenAI/… │                 │  │  Engines:        │   │    │
│  └────────────┘                 │  │  AppleScript     │   │    │
│                                 │  │  JXA             │   │    │
│                                 │  │  Shell           │   │    │
│                                 │  │  Accessibility   │   │    │
│                                 │  │  Electron CDP    │   │    │
│                                 │  └────────┬─────────┘   │    │
│                                 │           │ syscalls    │    │
│                                 └───────────┼─────────────┘    │
│                                             ▼                  │
│                                       macOS TCC                │
│                                       (Automation,             │
│                                        Accessibility,          │
│                                        Screen Recording)       │
└────────────────────────────────────────────────────────────────┘
```

Things inside the box are in our trust base. Things outside aren't.

- **Trusted**: the MCP client app's identity, the local macOS user, the
  on-disk `~/.mac-pilot/` directory.
- **Untrusted**: the LLM's tool-call inputs (treated as adversarial),
  network-sourced data the LLM may have ingested, any value a recipe takes
  as a parameter.

## Defense layers

### Layer 1 — Schema validation

Every tool call is parsed by a Zod schema (`src/schemas.ts`) before
anything else runs. Unknown `actionType` values, malformed coordinates,
out-of-range timeouts, etc. fail closed.

### Layer 2 — Deterministic sandbox (`src/security/sandbox.ts`)

Two block lists plus a recursive check:

- **`BLOCKED_SHELL_PATTERNS`** (25 entries): `rm -rf /…`, `rm -rf $HOME`,
  `sudo`, `su -c`, `curl … | sh`, `wget … | sh`, `chmod 777`, `mkfs`,
  `dd if=`, redirect-to-`/etc//System/`, `launchctl load/submit/bootstrap`,
  `defaults write LoginItems`, `diskutil erase/partitionDisk/unmount`,
  `csrutil disable`, `nvram`, `spctl --master-disable`, `systemsetup`,
  `$()`, backticks.
- **`PIPE_SINK_BLOCK`**: any unquoted pipe whose right-hand side is
  `sh|bash|zsh|eval|python\d?|node|ruby|perl|tclsh`. Catches dynamic-prefix
  variants of the `curl|sh` shape.
- **`BLOCKED_APPLESCRIPT_PATTERNS`** (6): `keystroke … password`,
  `keystroke … secret`, `do shell script … sudo`,
  `do shell script … rm -rf`, references to `System Preferences > Security`,
  `keychain`.
- **`do shell script` recursion**: when AppleScript contains
  `do shell script "<inner>"` (or single-quoted), `<inner>` is re-checked
  against the shell ruleset. Closes the most common AS → shell bypass.

Blocked calls return `riskLevel: 'blocked'` and never reach the engine.
The audit log records both allowed and blocked calls (masked, see Layer 4).

### Layer 3 — Strict mode opt-in (`MAC_PILOT_SANDBOX=strict`)

Shell chain tokens (`;`, `&&`, `||`) are legitimate in interactive use
(`ls ; date`). They are *also* a common injection shape (`ls ; rm -rf $HOME`).
We resolve this by leaving them allowed in the default mode and rejecting
them via `hasUnsafeChain` when `MAC_PILOT_SANDBOX=strict` is set.

Strict mode is for:
- Shared / multi-tenant macOS hosts.
- Headless agents where there's no human to review high-risk calls.
- Compliance regimes that require deny-by-default.

### Layer 4 — Audit log masking (`src/security/audit.ts`)

Before any call's parameters are written to the `security_log` or
`action_log` tables:

- Keys matching `password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|authorization|auth|bearer|cookie|session|private[_-]?key` (case-insensitive) → value replaced with `***MASKED***`.
- String values matching `Bearer <token>`, JWT `eyJ…`, OpenAI `sk-…`,
  Slack `xox[abprs]-…` → those substrings replaced with `***MASKED***`.
- Masking is recursive: nested objects and arrays are walked depth-first.

The masking *only* affects what gets written. The live tool call still
includes the real credential, because that's what the user asked for.

### Layer 5 — Engine-level escaping

`escapeForAppleScriptLiteral` (in `src/engine/applescript.ts`):

- Rejects control characters U+0000–U+001F (except `\t`, `\n`, `\r`) and
  U+007F (DEL). Returns an error instead of running.
- Escapes `\`, `"`, `\n`, `\r`, `\t` for AppleScript string-literal
  context.

Used by the `type` and `keypress` actions, where the input is most likely
user-derived.

Shell quoting uses POSIX single-quote escape (`'…'\\\''…'`), which is
safe against shell metacharacters by construction.

### Layer 6 — Filesystem permissions

On startup, `~/.mac-pilot/` is created or `chmod`-ed to `0700`, and
`pilot.db` to `0600`. Other local accounts on the same machine cannot
read the recipe DB, action history, or knowledge entries. No-op on
Windows (better-sqlite3 is portable; the project is macOS-targeted).

### Layer 7 — Concurrency hardening

- SQLite opened with `journal_mode=WAL`, `busy_timeout=5000`,
  `synchronous=NORMAL`.
- `updateRecipeStats` runs inside `db.transaction()` to prevent TOCTOU
  on `run_count`/`success_count`.
- `index.ts` installs `SIGINT/SIGTERM/uncaughtException/unhandledRejection`
  handlers; all close the DB before exit, idempotently.

## What we don't defend against

- **A malicious client app.** We trust the process invoking the MCP server.
- **A user who explicitly approves a `high`-risk call without reading it.**
  The risk classification surfaces these; deciding is the user's job.
- **Side-channels on TCC.** If macOS itself is broken, we are too.
- **Apple-event spoofing from a co-located process with the same UID.** TCC
  scope is per-app; we inherit whatever the client got granted.

## Known transitive CVEs (accepted)

`@modelcontextprotocol/sdk@1.27.x` pulls in `hono` and `path-to-regexp` whose
recent versions carry `high`-severity ReDoS advisories. Mac-Pilot does not
expose either to untrusted input (no HTTP server, no router) — they are
indirect deps of the SDK's internal helpers. We cannot patch them locally;
they ship through upstream SDK releases.

CI gates on `critical` only (`--audit-level=critical`) so a single upstream
`high` does not stop publish. We re-check `npm audit` on every SDK bump
and ship a patch release the same day if an advisory becomes exploitable
through our surface (e.g., if we ever expose an HTTP transport).

| Advisory | Affected dep | Severity | Mac-Pilot surface? | Action |
|----------|--------------|----------|---------------------|--------|
| hono ReDoS family (multiple) | hono (transitive of @modelcontextprotocol/sdk) | high | none — stdio only, no HTTP server | wait for SDK bump |
| path-to-regexp 8.0.0-8.3.0 ReDoS | path-to-regexp (transitive) | high | none — no router | wait for SDK bump |

If you need a zero-`high` audit, pin `@modelcontextprotocol/sdk` to a version
whose lockfile resolves to patched transitive deps when one lands.

## Test coverage

`tests/security.test.ts` exercises 60+ scenarios at the time of writing,
including all five defense layers and a regression suite of known bypass
attempts. CI runs the suite on macOS 13/14/15 × Node 20/22.

## Why publish this

Most macOS automation MCPs do not document their security model. We
publish ours because:

1. If you're going to copy us, copy something correct.
2. If you can break it, the failure mode is clearer with a reference
   document to point at.
3. It makes the trust boundary obvious to someone reviewing two MCP
   servers side by side.

If you find a gap that's not in [SECURITY.md](../SECURITY.md)'s out-of-scope
list, please report it privately — see that file for the disclosure process.
