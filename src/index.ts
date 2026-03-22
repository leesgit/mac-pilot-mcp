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
import { log } from './utils/logger.js';

const server = new Server(
  {
    name: 'mac-pilot',
    version: '0.1.0',
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

async function shutdown() {
  try {
    await server.close();
    if (db) db.close();
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// === Start Server ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Mac-Pilot MCP v0.2.0 started (7 tools, self-learning macOS automation)');
}

main().catch((error) => {
  console.error('Failed to start Mac-Pilot MCP:', error);
  process.exit(1);
});
