# Electron App Support (CDP fallback)

macOS Accessibility (AX) API exposes a very thin tree for Electron apps. For
VSCode, Cursor, Slack, Discord and similar containers, AX queries often return
the window frame and almost nothing inside it. Mac-Pilot ships an **opt-in**
Chrome DevTools Protocol (CDP) fallback that asks the Electron app's own
Chromium runtime for the full AX tree.

The fallback is implemented in `src/engine/electron-fallback.ts` and integrated
into the `mac_find_ui` tool via two optional parameters:

| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `useElectronFallback` | `true \| "auto"` | _unset_ | Enable the CDP fallback. `"auto"` only triggers it for known Electron bundle ids when AX returned 0 elements. `true` always tries CDP when AX yields nothing. |
| `electronCdpPort` | `number` | _auto-detect_ | Skip the process scan and use this port directly. |

When CDP is unreachable, `mac_find_ui` still returns the AX result (or the AX
error) plus an `electronFallback.activationHint` message explaining how to
enable CDP on the user's machine. Nothing crashes; nothing is logged at error
level for the normal "CDP off" case.

## Enabling CDP on the target app

CDP is **off by default** for security reasons. The user must relaunch the app
with `--remote-debugging-port=<PORT>`. Pick a free port per app to avoid
collisions.

```bash
# Quit the app first, then:
open -a "Visual Studio Code" --args --remote-debugging-port=9222
open -a "Cursor"             --args --remote-debugging-port=9223
open -a "Slack"              --args --remote-debugging-port=9224
open -a "Discord"            --args --remote-debugging-port=9225
```

After launch, Mac-Pilot's auto-detect can find the port (we `ps -A` for
`--remote-debugging-port=` and match the app name).

## Detection model

1. **Known bundle id?** `KNOWN_ELECTRON_BUNDLE_IDS` covers VSCode, Cursor,
   Slack, Discord, plus Figma/Notion/Linear/Obsidian. Used only as a hint for
   `useElectronFallback: "auto"`; missing bundles are fine if a port is found.
2. **Port discovery.** `findElectronCdpPort(appName)` runs
   `ps -Ao command= | grep -F -- '--remote-debugging-port='` and matches the
   app name (case-insensitive) against each line. The numeric port follows the
   flag (either `=` or space).
3. **CDP HTTP.** `GET http://127.0.0.1:<PORT>/json/list` returns the list of
   targets. We pick the first `type === "page"` target.
4. **CDP WS.** A minimal RFC 6455 client (no `ws` dep) opens the
   `webSocketDebuggerUrl`, sends `Accessibility.getFullAXTree`, waits for the
   matching response, and returns the `nodes` array.

`mac_find_ui` then applies the same `role` / `title` / `searchText` filters to
the CDP nodes that it already applies to AX results, so the tool output stays
shape-stable for callers. The response carries `"source": "electron-cdp"` so
the caller can distinguish the data origin.

## Example usage

```jsonc
// Always-try-CDP, with a port the agent already knows:
{
  "name": "mac_find_ui",
  "arguments": {
    "app": "Visual Studio Code",
    "searchText": "Run Test",
    "useElectronFallback": true,
    "electronCdpPort": 9222
  }
}

// Only fall back to CDP when AX returns nothing (recommended default):
{
  "name": "mac_find_ui",
  "arguments": {
    "app": "Cursor",
    "role": "button",
    "useElectronFallback": "auto"
  }
}
```

## Security notes

CDP exposes the full DevTools surface to anything that can connect to the port.
Mac-Pilot only sends `Accessibility.getFullAXTree` and only over `127.0.0.1`,
but **anyone else with local access could do more**. Treat the debugging port
as a per-session opt-in, not a permanent configuration.

We deliberately **do not** support `wss://` CDP endpoints from the built-in
fallback: every shipping Electron app exposes plain `ws://` on localhost, and
adding TLS would mean a real `ws` dependency.

## Limitations

- Read-only. We retrieve the AX tree; we do not click via CDP. Use AX-located
  coordinates or `mac_run` for actions.
- Single-frame WS responses only (8 MiB cap). Real CDP AX trees fit easily.
- Web/SharedWorker targets are skipped; we use the first `page` target only.
