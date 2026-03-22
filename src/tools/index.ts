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

// === Tool Definitions ===

export const tools: Tool[] = [
  {
    name: 'mac_run',
    description: 'Execute a macOS action: applescript, shell command, open app/URL, click, type, or keypress. All actions are automatically logged for learning.',
    inputSchema: {
      type: 'object',
      properties: {
        actionType: {
          type: 'string',
          enum: ['applescript', 'shell', 'open', 'click', 'type', 'keypress'],
          description: 'Type of action to execute',
        },
        script: { type: 'string', description: 'AppleScript code (required for applescript)' },
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
    description: 'Get current macOS system state: frontmost app, window list, clipboard, selected files in Finder, running apps.',
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
    description: 'Find UI elements in an app using macOS Accessibility API. Returns element properties, position, and role.',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'Application name' },
        role: { type: 'string', description: 'AX role filter (e.g., AXButton, AXTextField)' },
        title: { type: 'string', description: 'Exact element title to search for' },
        searchText: { type: 'string', description: 'Fuzzy text search across all visible elements' },
        maxResults: { type: 'number', description: 'Max results (1-50, default: 10)' },
      },
      required: ['app'],
    },
  },
  {
    name: 'mac_screenshot',
    description: 'Capture a screenshot of the screen, a window, or a region. Returns base64-encoded PNG image.',
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
    description: 'Save a successful sequence of actions as a reusable recipe. Recipes can have parameters ({{paramName}}) for flexibility. This is how Mac-Pilot learns.',
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
              actionType: { type: 'string', enum: ['applescript', 'shell', 'open', 'click', 'type', 'keypress'] },
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
    description: 'Execute a saved recipe by name. Provide parameter values to customize execution. Stops on first failure.',
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
    description: 'Search saved recipes and optionally action history. Use this before attempting a new automation — Mac-Pilot may already know how.',
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
];

// === Tool Handler Router ===

export function handleTool(
  name: string,
  args: Record<string, unknown>,
  db: PilotDatabase,
  audit: AuditLogger,
): CallToolResult {
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
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}
