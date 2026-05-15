# Mac-Pilot Positioning

> *Where Mac-Pilot fits in the macOS automation MCP landscape, and what
> survives if Anthropic or Apple ships native automation tooling.*

## The category, honestly

There are five+ macOS automation MCP servers in active rotation as of
2026-05:

| Project | Stars | Differentiator |
|---------|-------|----------------|
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 32k+ | Browser-only, ARIA tree, industry standard |
| Anthropic Computer Use (in `anthropic-quickstarts`) | 16k+ | OS-agnostic via vision + coordinates |
| [steipete/macos-automator-mcp](https://github.com/steipete/macos-automator-mcp) | 800+ | 200+ curated AppleScript snippets, recent AX query addition |
| `peakmojo/applescript-mcp` / `joshrutkowski/applescript-mcp` | 400+ each | Thin AppleScript pass-through |
| `supermemoryai/apple-mcp` | 3k+ but **archived 2026-01** | 30+ Apple-domain tools (Notes/Mail/etc.), now a gap |

Playwright doesn't touch native macOS. Computer Use works on anything but
trades latency, cost, and brittleness for generality. The remaining
AppleScript MCPs all share a disclaimer: *"makes no attempt to evaluate the
safety of commands; use your robot wisely."* That is the gap.

## Mac-Pilot's real wedge

Two things, said plainly:

1. **A sandbox that actually rejects calls.** Every competitor in the
   AppleScript family explicitly defers safety to the user. Mac-Pilot blocks
   ~25 destructive patterns at the shell layer, recursively re-checks
   `do shell script` bodies, masks credentials in the audit log, and offers
   a `strict` mode that disallows chain tokens. This is not novel
   engineering — it is engineering at all.

2. **A persistent local knowledge store that *learns* per app.** Errors are
   classified (`permission`, `app_not_running`, `object_missing`,
   `invalid_syntax`, `timeout`, `rate_limit`, `unknown`), each one carries
   an actionable retry strategy, and reliable knowledge is auto-prepended
   to the next call with the same `appContext`. Action patterns are tracked
   independently; once a pattern succeeds N times, the system can suggest
   promoting it to a recipe. macos-automator-mcp has a flat-file knowledge
   base; nothing else tracks per-app reliability scores.

Plus 118 built-in recipes, JXA + AppleScript dual support, and an Electron
CDP fallback for VSCode/Cursor/Slack/Discord that the others don't have.

## What Mac-Pilot is not pretending to be

- **It is not a market leader yet.** Zero stars, unpublished at the time of
  writing. Distribution is the single largest risk.
- **It does not beat Playwright at browser automation.** It doesn't try.
- **It does not beat Computer Use at OS-agnostic generality.** It also
  doesn't try.
- **"Self-learning" is real, but bounded.** The system memorizes failure
  classes and successful patterns. It does not invent new automations from
  scratch.

## The Anthropic / Apple native-integration scenario

The largest known risk is that Anthropic ships macOS automation directly
inside Claude Desktop, or Apple exposes a first-party MCP layer. Both are
plausible 6–12 month possibilities.

Mac-Pilot's positioning in that world:

| Property | Why it still matters |
|----------|----------------------|
| **Privacy-first, local-only** | No data leaves the machine. The recipe DB, action log, and knowledge entries live in `~/.mac-pilot/`. A vendor-native integration that phones home is not a substitute for a server you control. |
| **Recipe portability** | `mac_recipe_export` / `mac_recipe_import` (and the `.mac-recipe.json` format) let users carry workflows across machines and clients. Vendor-native systems are usually account-bound. |
| **Sandbox as opt-in spec** | The `MAC_PILOT_SANDBOX=strict` knob is something an enterprise can put in shared dotfiles. Vendor-native solutions rarely expose policy at this level. |
| **Cross-client neutrality** | Mac-Pilot is an MCP server; it runs equally in Claude Desktop, Cursor, Windsurf, Continue.dev, Cline, Zed. Vendor-native solutions are vendor-bound. |
| **Open knowledge base** | The 118 recipes (and any community contributions) are MIT-licensed. They survive vendor lock-in shifts. |

If Anthropic ships native automation, Mac-Pilot's pitch shifts from "the
sandbox + recipes MCP" to "the cross-client, local-only, open-source
alternative." The code doesn't need to change; the README does.

## What we do *not* claim

- We do not claim to be uniquely "self-learning" in a way no one else can
  copy. macos-automator-mcp can add usage tracking in a weekend.
- We do not claim the sandbox is a security boundary against a hostile
  client. The MCP client is in our trust base; see [SECURITY.md](../SECURITY.md).
- We do not claim Electron CDP support is novel. We claim it's *integrated*
  with the rest of the surface — find-ui returns a unified node shape no
  matter whether AX or CDP supplied the data.

## Marketing copy that we have *not* shipped, by design

- "Self-learning" was removed from the startup log on 2026-05 and reframed
  as "sandbox-protected." We'll bring it back when classified-error
  promotion has shipped to enough users that we can show recall numbers,
  not just architecture diagrams.
- We do not claim "200+ recipes" until we are at 200+ recipes. We are at
  118.

## When Mac-Pilot is the wrong tool

- **You need browser-only automation.** Use Playwright MCP.
- **You need OS-agnostic, fully visual control.** Use Computer Use in a VM.
- **You need an off-the-shelf, no-installation AppleScript snippet
  library.** macos-automator-mcp ships more snippets out of the gate.
- **You only need Notes/Mail/Calendar wrappers.** apple-mcp (archived) or a
  domain-specific MCP may be smaller. But our recipes cover the same surface.

If you need *most of those things in one well-behaved process* — that's
the use case.
