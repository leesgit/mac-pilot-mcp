#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getDatabase } from './db/database.js';
import { AuditLogger } from './security/audit.js';
import { tools, handleTool } from './tools/index.js';
import { BUILTIN_RECIPES } from './recipes/builtin.js';
import { log } from './utils/logger.js';

const server = new Server(
  {
    name: 'mac-pilot',
    version: '0.4.1',
  },
  {
    capabilities: {
      tools: { listChanged: true },
    },
  }
);

// Lazy init
let db: ReturnType<typeof getDatabase>;
let audit: AuditLogger;

function ensureInit() {
  if (!db) {
    db = getDatabase();
    audit = new AuditLogger(db);
    // Load built-in recipes on first init
    const loaded = db.loadBuiltinRecipes(BUILTIN_RECIPES);
    if (loaded > 0) {
      log(`Loaded ${loaded} built-in recipes`);
    }
    // Cleanup old action logs (>30 days)
    db.cleanupOldLogs();
  }
}

// === Tool Handlers ===

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  ensureInit();

  const { name, arguments: args } = request.params;
  return handleTool(name, args ?? {}, db, audit);
});

// === Graceful Shutdown ===

let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await server.close();
    if (db) db.close();
  } catch { /* ignore */ }
  if (reason !== 'SIGINT' && reason !== 'SIGTERM') {
    console.error(`[mac-pilot] shutdown reason: ${reason}`);
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[mac-pilot] uncaughtException', err);
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[mac-pilot] unhandledRejection', reason);
  shutdown('unhandledRejection', 1);
});

// === Start Server ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Mac-Pilot MCP v0.4.1 started (11 tools + 118 built-in recipes, sandbox-protected macOS automation)');
}

main().catch((error) => {
  console.error('Failed to start Mac-Pilot MCP:', error);
  process.exit(1);
});
