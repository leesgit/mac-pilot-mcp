# Launch PRs — directory submission drafts

> Drafts for awesome-list / directory submissions. **The user submits these
> by hand** — sub-agent / Claude can't fork-and-PR for them.

## 1. punkpeye/awesome-mcp-servers

Path: <https://github.com/punkpeye/awesome-mcp-servers>
File: `README.md` → section that fits best is **`### 🖥️ <a name="command-line"></a>Command Line`** or **a new `Operating Systems` line under macOS**. Inspect the README and choose the closest existing rubric — do not invent a new top-level category.

**Suggested entry** (single line, alphabetical insertion):

```markdown
- [leesgit/mac-pilot-mcp](https://github.com/leesgit/mac-pilot-mcp) 🎖️ 🍎 - Sandbox-protected macOS automation with persistent recipe DB (118 built-ins), error-classified self-learning, and Chrome DevTools Protocol fallback for Electron apps (VSCode/Cursor/Slack/Discord).
```

Emoji legend (per the repo's README):
- 🎖️ = official integration? → No. Remove this if the repo's legend says otherwise.
- 🍎 = macOS

**PR description**:

```markdown
Add mac-pilot-mcp to the macOS automation list.

What it is: an MCP server that wraps AppleScript / JXA / shell / Accessibility / Chrome DevTools Protocol under one schema, with a deny-list sandbox, a persistent SQLite recipe DB (118 built-in recipes), and per-app error-classified knowledge that self-prepends to subsequent tool calls.

Why it's worth listing alongside the existing AppleScript MCP entries:
- Differentiated security model — every other AppleScript-family MCP in the list explicitly disclaims command safety. This one has a sandbox.
- Electron AX fallback via CDP (zero new deps; hand-rolled RFC 6455 client) for VSCode/Cursor/Slack/Discord where macOS AX is sparse.
- 271 tests on macOS 13/14/15 × Node 20/22.
- npm: https://www.npmjs.com/package/mac-pilot-mcp
- License: MIT.
```

---

## 2. mcpservers.org

Path: <https://mcpservers.org> (Linear-style submission form, or PR to the underlying repo if listed in their footer).

**Form fields**:

| Field | Value |
|-------|-------|
| Server name | `mac-pilot-mcp` |
| GitHub URL | `https://github.com/leesgit/mac-pilot-mcp` |
| npm package | `mac-pilot-mcp` |
| Category | `Operating Systems` / `Automation` |
| Description (≤150 chars) | `Sandbox-protected macOS automation MCP with persistent recipe DB, self-learning, and Chrome DevTools Protocol fallback for Electron apps.` |
| Tags | `macos`, `automation`, `applescript`, `jxa`, `electron`, `sandbox`, `recipes`, `self-learning` |
| Author | Byeongchang Lee |
| License | MIT |

---

## 3. wong2/awesome-mcp-servers

Path: <https://github.com/wong2/awesome-mcp-servers>

This list is more curated. Check the README first — many sections are by integration vendor, not feature. The closest match is **`Operating Systems`** if it exists, otherwise **`Productivity`**.

Same entry copy as PR 1, fewer emojis (this list does not use them).

---

## 4. mcp.so / mcp.directory (optional)

Lower-traffic but they scrape npm — sometimes auto-listed. Check first:
```
curl -s 'https://mcp.so/api/search?q=mac-pilot' | jq .
```

If not present after 48h since publish, submit via their contact form.

---

## 5. HN Show submission (post-merge of at least one directory PR)

**Don't submit until at least one directory PR is merged** — `0 stars + 0 directory listings` reads as "unmaintained" on HN front page.

**Title** (≤80 chars):
> Show HN: Mac-Pilot – sandbox-protected macOS automation MCP with recipe DB

**URL**: `https://github.com/leesgit/mac-pilot-mcp`

**First comment** (post immediately after submission):

```
Author here.

What it does: it's an MCP server that lets Claude / Cursor / Cline / Windsurf / Continue.dev / Zed drive macOS through AppleScript, JXA, shell, the Accessibility API, and Chrome DevTools Protocol — but with a deny-list sandbox in front of all of them.

Why I built it: every existing AppleScript MCP I tried explicitly says "we don't evaluate command safety." When the LLM gets prompt-injected, that means it can also `rm -rf $HOME`. Mac-Pilot blocks ~25 destructive patterns, recursively re-checks `do shell script` bodies, masks credentials in the audit log, and offers a strict mode + an allowlist mode for shared machines.

The other piece is a SQLite recipe DB — 118 built-in recipes for common Finder/Safari/Mail/Messages/Calendar/etc flows, plus per-app error classification so the next call gets actionable hints prepended instead of the same opaque AppleScript error.

Honest about positioning: Anthropic shipped native macOS automation inside Claude Cowork/Code two months ago, which lowers the ceiling here. Mac-Pilot's actual TAM is "MCP clients other than Claude Cowork + free + open-source + needs a sandbox." For Claude Cowork users, just use what's built in.

Code: MIT. 271 tests. npm: https://www.npmjs.com/package/mac-pilot-mcp.

Happy to take criticism — especially on the sandbox (a security model post is at docs/SECURITY-MODEL.md if you want a target).
```

---

## 6. Anthropic Discord — `#mcp` channel

Once npm is live again, one-line post in the official Anthropic Discord `#mcp` channel:

> Just shipped v0.4.1 of mac-pilot-mcp — sandbox-protected macOS automation MCP with 118 built-in recipes, Electron CDP fallback, and a self-learning per-app knowledge loop. Honest about positioning vs. Claude Code's native macOS support (it's for non-Claude-Code MCP clients). Repo: https://github.com/leesgit/mac-pilot-mcp · npm: https://www.npmjs.com/package/mac-pilot-mcp

---

## Order of operations

1. `npm publish` v0.4.1 (currently blocked — token revoked; user runs `npm login` then `npm publish --access public`).
2. Submit awesome-mcp-servers PR (#1 above) — highest leverage.
3. Submit mcpservers.org form.
4. Wait 2-3 days for first merge / inbound link.
5. HN Show submission (only after step 4 has any signal).
6. Discord post (any time after step 1).
