import type { Tool, CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import type { PilotDatabase } from '../db/database.js';
import type { AuditLogger } from '../security/audit.js';

import { handleMacRun } from './run.js';
import { handleMacState } from './state.js';
import { handleMacFindUi } from './find-ui.js';
import { handleMacScreenshot } from './screenshot.js';
import { handleRecipeSave } from './recipe-save.js';
import { handleRecipeRun } from './recipe-run.js';
import { handleRecipeSearch } from './recipe-search.js';
import { handleRecipeExport } from './recipe-export.js';
import { handleRecipeImport } from './recipe-import.js';
import { handleMacPermissions } from './permissions.js';
import { handleMacClipboard } from './clipboard.js';

// === Tool Definitions ===

export const tools: Tool[] = [
  {
    name: 'mac_run',
    description: `Execute a macOS action. Supported actionTypes: applescript, jxa, shell, open, click, type, keypress.

Examples:
  - Open Safari: { actionType: "open", target: "Safari" }
  - Type text: { actionType: "type", text: "hello world" }
  - Cmd+C: { actionType: "keypress", text: "cmd+c" }
  - Run AppleScript: { actionType: "applescript", script: 'tell application "Finder" to activate', appContext: "Finder" }
  - List files: { actionType: "shell", command: "ls -la ~/Documents" }

Limitations:
  - Requires Accessibility + Automation permissions for click/type/keypress and AS targeting other apps.
  - Cannot bypass the lock screen.
  - Dangerous shell patterns (rm -rf /, curl|sh, sudo, etc.) are blocked by the sandbox.
  - Set appContext for the best self-learning: errors get classified per-app and reliable hints are auto-prepended on subsequent calls.`,
    inputSchema: {
      type: 'object',
      properties: {
        actionType: {
          type: 'string',
          enum: ['applescript', 'jxa', 'shell', 'open', 'click', 'type', 'keypress'],
          description: 'Type of action to execute',
        },
        script: { type: 'string', description: 'AppleScript or JXA code (required for applescript/jxa)' },
        command: { type: 'string', description: 'Shell command (required for shell)' },
        target: { type: 'string', description: 'App name, URL, or file path (required for open)' },
        x: { type: 'number', description: 'X coordinate (required for click)' },
        y: { type: 'number', description: 'Y coordinate (required for click)' },
        text: { type: 'string', description: 'Text to type or key combo like "cmd+c" (required for type/keypress)' },
        appContext: { type: 'string', description: 'Target application name for context' },
        timeout: { type: 'number', description: 'Timeout in ms (100-30000, default: 10000)' },
        dryRun: { type: 'boolean', description: 'Validate without executing' },
      },
      required: ['actionType'],
    },
  },
  {
    name: 'mac_state',
    description: `Inspect current macOS state (read-only). Returns frontmost app, window list, clipboard, Finder selection, and/or running apps.

Examples:
  - All state: {} (returns everything)
  - Just clipboard + frontmost: { include: ["clipboard", "frontmost_app"] }
  - Window list only: { include: ["windows"] }

Limitations:
  - Window list uses Accessibility and only shows windows from apps the client has been granted access to.
  - Clipboard returns the text representation only — images/files appear as their typed name.`,
    inputSchema: {
      type: 'object',
      properties: {
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['frontmost_app', 'windows', 'clipboard', 'selected_files', 'running_apps'],
          },
          description: 'What state to query (default: all)',
        },
      },
    },
  },
  {
    name: 'mac_find_ui',
    description: `Find UI elements in an app via the macOS Accessibility API. Returns role, title, position, and size.

Examples:
  - All buttons in Safari: { app: "Safari", role: "AXButton" }
  - Element by title: { app: "Mail", title: "Send" }
  - Fuzzy search: { app: "Finder", searchText: "Documents" }
  - Electron AX (VSCode with --remote-debugging-port=9222): { app: "Visual Studio Code", useElectronFallback: true }
  - Auto-fallback for known Electron apps: { app: "Cursor", useElectronFallback: "auto" }

Limitations:
  - Requires Accessibility permission for the client app.
  - Electron apps (VSCode, Cursor, Slack, Discord) expose a thin AX tree; use useElectronFallback when AX returns empty.
  - CDP fallback needs the user to relaunch the app with --remote-debugging-port=<PORT>.`,
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'Application name' },
        role: { type: 'string', description: 'AX role filter (e.g., AXButton, AXTextField)' },
        title: { type: 'string', description: 'Exact element title to search for' },
        searchText: { type: 'string', description: 'Fuzzy text search across all visible elements' },
        maxResults: { type: 'number', description: 'Max results (1-50, default: 10)' },
        useElectronFallback: {
          description: 'Use Chrome DevTools Protocol fallback for Electron apps. `true` = always try; `"auto"` = only for known Electron apps when AX returns empty.',
          oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['auto'] }],
        },
        electronCdpPort: { type: 'number', description: 'Explicit CDP port (skips auto-detect). Range 1-65535.' },
      },
      required: ['app'],
    },
  },
  {
    name: 'mac_screenshot',
    description: `Capture screen, window, or region as base64 PNG.

Examples:
  - Full screen: { target: "screen" }
  - Specific app window: { target: "window", windowName: "Safari" }
  - Region (x,y from top-left): { target: "region", region: { x: 0, y: 0, width: 800, height: 600 } }
  - High-fidelity capture: { target: "screen", scale: 1.0 } (warning: larger token cost)

Limitations:
  - Requires Screen Recording permission (System Settings → Privacy & Security → Screen Recording).
  - Default scale is 0.5 to keep token cost reasonable; bump for OCR-quality captures.
  - Cursor is not included in the capture.`,
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['screen', 'window', 'region'],
          description: 'What to capture',
        },
        windowName: { type: 'string', description: 'App name for window capture' },
        region: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
          description: 'Region coordinates for region capture',
        },
        scale: { type: 'number', description: 'Scale factor 0.1-1.0 (default: 0.5 for token efficiency)' },
      },
      required: ['target'],
    },
  },
  {
    name: 'mac_recipe_save',
    description: `Save a multi-step automation as a named recipe. Parameters use {{name}} placeholders, substituted at run time (JSON-safe, supports quotes/backslashes/newlines).

Example:
  {
    name: "open-url-in-private",
    description: "Open a URL in Safari private window",
    app: "Safari",
    steps: [
      { actionType: "open", params: { target: "Safari" }, description: "Launch Safari" },
      { actionType: "keypress", params: { text: "cmd+shift+n" }, description: "Open private window" },
      { actionType: "keypress", params: { text: "cmd+l" }, description: "Focus address bar" },
      { actionType: "type", params: { text: "{{url}}" }, description: "Enter URL" },
      { actionType: "keypress", params: { text: "return" }, description: "Navigate" }
    ],
    parameters: [{ name: "url", description: "URL to open" }],
    tags: ["safari", "browser", "private"]
  }

Limitations:
  - Recipe names are unique. Re-saving the same name fails — delete or rename.
  - Each step's params goes through the security sandbox at run time.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique recipe name (max 100 chars)' },
        description: { type: 'string', description: 'What this recipe does' },
        app: { type: 'string', description: 'Primary target app' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              actionType: { type: 'string', enum: ['applescript', 'jxa', 'shell', 'open', 'click', 'type', 'keypress'] },
              params: { type: 'object', description: 'Action parameters' },
              description: { type: 'string', description: 'What this step does' },
            },
            required: ['actionType', 'params', 'description'],
          },
          description: 'Ordered list of steps',
        },
        parameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              defaultValue: { type: 'string' },
            },
          },
          description: 'Recipe parameters referenced in steps as {{paramName}}',
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for searchability' },
      },
      required: ['name', 'description', 'steps'],
    },
  },
  {
    name: 'mac_recipe_run',
    description: `Run a saved recipe by name with parameter values.

Examples:
  - { name: "toggle-dark-mode" }
  - { name: "open-url-in-private", params: { url: "https://example.com" } }
  - Dry run (preview steps): { name: "send-email", params: { ... }, dryRun: true }

Limitations:
  - Stops on the first failed step (no partial rollback).
  - Each step inherits the recipe's app as appContext for self-learning.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Recipe name' },
        params: { type: 'object', description: 'Parameter values (keys matching recipe parameter names)' },
        dryRun: { type: 'boolean', description: 'Preview steps without executing' },
      },
      required: ['name'],
    },
  },
  {
    name: 'mac_recipe_search',
    description: `Search recipes (and optionally raw action history) by natural-language query. Call this BEFORE writing new AppleScript — 118 built-in recipes cover most common tasks.

Examples:
  - { query: "dark mode" } → matches toggle-dark-mode, get-dark-mode
  - { query: "screenshot", app: "Finder" }
  - { query: "send email", includeHistory: true }

Limitations:
  - FTS5 tokenizer is English-biased. For Korean/CJK, supplement with the \`app\` filter.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        app: { type: 'string', description: 'Filter by target app name' },
        includeHistory: { type: 'boolean', description: 'Also search raw action history (default: false)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'mac_recipe_export',
    description: `Export saved recipes as a portable .mac-recipe.json bundle. By default, only user-added recipes (not the 118 built-ins) are exported.

Examples:
  - Export one recipe inline: { name: "open-url-in-private" }
  - Export all user recipes to a file: { outputPath: "~/recipes/backup.json" }
  - Include built-ins: { outputPath: "~/recipes/full.json", includeBuiltins: true }

Format: \`mac-recipe-bundle/v1\` (versioned for forward compatibility).
Limitations: outputPath must resolve under $HOME and end with .json.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Single recipe name to export (omit = export all user recipes)' },
        outputPath: { type: 'string', description: 'Path to write bundle (must be under $HOME and end with .json). Omit to return inline.' },
        includeBuiltins: { type: 'boolean', description: 'Include the 118 built-in recipes (default: false)' },
      },
    },
  },
  {
    name: 'mac_recipe_import',
    description: `Import a .mac-recipe.json bundle from inline data or a file path.

Examples:
  - From file: { inputPath: "~/recipes/team-bundle.json" }
  - From file with replace policy: { inputPath: "~/recipes/team.json", onConflict: "replace" }
  - Inline bundle: { bundle: { format: "mac-recipe-bundle/v1", exportedAt: "...", recipes: [...] } }

Conflict policy:
  - "skip" (default): keep existing recipe
  - "rename": append "-imported-N" until name is unique
  - "replace": delete existing first

Limitations:
  - Provide exactly one of \`bundle\` or \`inputPath\`.
  - Bundle format major version is enforced — v2 bundles rejected.`,
    inputSchema: {
      type: 'object',
      properties: {
        bundle: { type: 'object', description: 'Inline bundle object (format: mac-recipe-bundle/v1)' },
        inputPath: { type: 'string', description: 'Path to bundle file (must be under $HOME and end with .json)' },
        onConflict: { type: 'string', enum: ['skip', 'rename', 'replace'], description: 'How to handle existing recipes with the same name (default: skip)' },
      },
    },
  },
  {
    name: 'mac_permissions',
    description: `Check macOS Privacy & Security permissions (Automation, Accessibility, Screen Recording) for the current MCP client. Returns a deep-link to the relevant Privacy preferences pane if a permission is missing.

Examples:
  - { check: "all" } → return state of all 3 permissions
  - { check: "accessibility" } → only Accessibility

Limitations:
  - macOS doesn't expose TCC state to ordinary processes. We probe by attempting a known-safe operation and observing the error class.
  - "Screen Recording" cannot be detected reliably without invoking a screenshot; we report "unknown" instead of guessing.`,
    inputSchema: {
      type: 'object',
      properties: {
        check: {
          type: 'string',
          enum: ['all', 'automation', 'accessibility', 'screen_recording'],
          description: 'Which permission to check (default: all)',
        },
      },
    },
  },
  {
    name: 'mac_clipboard',
    description: `Read or write the system clipboard. Separated from \`mac_state\` so reads/writes don't require pulling the rest of system state.

Examples:
  - Read text: { action: "read" }
  - Write text: { action: "write", text: "hello" }
  - Clear: { action: "clear" }

Limitations:
  - Text only. Images/files in the clipboard appear as their typed name.
  - No clipboard history — only the current value.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write', 'clear'], description: 'Clipboard operation' },
        text: { type: 'string', description: 'Text to write (required when action = "write")' },
      },
      required: ['action'],
    },
  },
];

// === Tool Handler Router ===

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  db: PilotDatabase,
  audit: AuditLogger,
): Promise<CallToolResult> {
  switch (name) {
    case 'mac_run':
      return handleMacRun(args, db, audit);
    case 'mac_state':
      return handleMacState(args);
    case 'mac_find_ui':
      return handleMacFindUi(args);
    case 'mac_screenshot':
      return handleMacScreenshot(args);
    case 'mac_recipe_save':
      return handleRecipeSave(args, db);
    case 'mac_recipe_run':
      return handleRecipeRun(args, db, audit);
    case 'mac_recipe_search':
      return handleRecipeSearch(args, db);
    case 'mac_recipe_export':
      return handleRecipeExport(args, db);
    case 'mac_recipe_import':
      return handleRecipeImport(args, db);
    case 'mac_permissions':
      return handleMacPermissions(args);
    case 'mac_clipboard':
      return handleMacClipboard(args);
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}
