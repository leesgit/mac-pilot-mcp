/**
 * Tests for the Electron CDP fallback.
 *
 * Strategy:
 *  - Process detection is covered by `parseCdpPortFromPsOutput` (pure helper)
 *    so we don't have to mock `ps` directly.
 *  - HTTP CDP discovery is covered by spinning up an ephemeral `http.createServer`
 *    on 127.0.0.1:0 — far simpler than mocking the http module.
 *  - WebSocket frame encoding/decoding is covered indirectly by a tiny in-process
 *    CDP-like server that echoes back a canned AX tree.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'http';
import { createHash } from 'crypto';
import { AddressInfo } from 'net';

import {
  KNOWN_ELECTRON_BUNDLE_IDS,
  parseCdpPortFromPsOutput,
  fetchCdpTargets,
  fetchAxTreeOverWs,
  tryElectronAX,
} from '../../src/engine/electron-fallback.js';

// === Test utilities ============================================================

interface TrackedServer { server: http.Server; sockets: Set<NodeJS.WritableStream & { destroy?: () => void }>; }
const openServers: TrackedServer[] = [];

afterEach(async () => {
  while (openServers.length > 0) {
    const t = openServers.pop();
    if (!t) continue;
    // Force-close any lingering sockets so `server.close` resolves promptly.
    for (const s of t.sockets) {
      try { s.destroy?.(); } catch { /* ignore */ }
    }
    await new Promise<void>((resolve) => t.server.close(() => resolve()));
  }
});

function trackServer<T extends http.Server>(s: T): T {
  const sockets = new Set<NodeJS.WritableStream & { destroy?: () => void }>();
  s.on('connection', (sock) => {
    sockets.add(sock as unknown as NodeJS.WritableStream & { destroy?: () => void });
    sock.on('close', () => sockets.delete(sock as unknown as NodeJS.WritableStream & { destroy?: () => void }));
  });
  s.on('upgrade', (_req, sock) => {
    sockets.add(sock as unknown as NodeJS.WritableStream & { destroy?: () => void });
    sock.on('close', () => sockets.delete(sock as unknown as NodeJS.WritableStream & { destroy?: () => void }));
  });
  openServers.push({ server: s, sockets });
  return s;
}

/**
 * Spin up a fake CDP HTTP endpoint with optional WS upgrade.
 * Returns the assigned port + a small handle for tearing down.
 */
async function startFakeCdpServer(opts: {
  jsonList?: unknown;
  jsonListStatus?: number;
  // Function that runs once a WS upgrade is requested. Receives the raw socket.
  onUpgrade?: (socket: NodeJS.WritableStream & NodeJS.ReadableStream) => void;
}): Promise<{ port: number }> {
  const server = trackServer(http.createServer((req, res) => {
    if (req.url === '/json/list' || req.url === '/json') {
      res.statusCode = opts.jsonListStatus ?? 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(opts.jsonList ?? []));
      return;
    }
    res.statusCode = 404;
    res.end();
  }));

  if (opts.onUpgrade) {
    server.on('upgrade', (req, socket) => {
      // Complete the WS handshake.
      const key = req.headers['sec-websocket-key'] as string | undefined;
      if (!key) {
        socket.end();
        return;
      }
      const accept = createHash('sha1')
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64');
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      opts.onUpgrade!(socket);
    });
  }

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { port };
}

/**
 * Encode a server-side (unmasked) WS text frame, matching what real CDP sends.
 */
function encodeServerTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf-8');
  const len = payload.length;
  const head: number[] = [0x80 | 0x1]; // FIN + text opcode
  if (len < 126) head.push(len);
  else if (len < 65536) head.push(126, (len >> 8) & 0xFF, len & 0xFF);
  else head.push(127, 0, 0, 0, 0, (len >>> 24) & 0xFF, (len >>> 16) & 0xFF, (len >>> 8) & 0xFF, len & 0xFF);
  return Buffer.concat([Buffer.from(head), payload]);
}

/**
 * Read a single client (masked) WS text frame.
 * Returns the parsed text payload.
 */
function readClientTextFrame(buf: Buffer): { text: string; rest: Buffer } | null {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0F;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7F;
  let offset = 2;
  if (len === 126) { len = buf.readUInt16BE(offset); offset += 2; }
  else if (len === 127) { len = Number(buf.readBigUInt64BE(offset)); offset += 8; }
  if (opcode !== 0x1) return null;
  let mask: Buffer | null = null;
  if (masked) { mask = buf.subarray(offset, offset + 4); offset += 4; }
  if (buf.length < offset + len) return null;
  let payload = buf.subarray(offset, offset + len);
  if (mask) {
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  return { text: payload.toString('utf-8'), rest: buf.subarray(offset + len) };
}

// === Tests ====================================================================

describe('KNOWN_ELECTRON_BUNDLE_IDS', () => {
  it('covers VSCode, Cursor, Slack, Discord', () => {
    expect(KNOWN_ELECTRON_BUNDLE_IDS['Visual Studio Code']).toBe('com.microsoft.VSCode');
    expect(KNOWN_ELECTRON_BUNDLE_IDS['Cursor']).toBeDefined();
    expect(KNOWN_ELECTRON_BUNDLE_IDS['Slack']).toBe('com.tinyspeck.slackmacgap');
    expect(KNOWN_ELECTRON_BUNDLE_IDS['Discord']).toBe('com.hnc.Discord');
  });
});

describe('parseCdpPortFromPsOutput', () => {
  it('extracts CDP port for VSCode when app name appears in command line', () => {
    const ps = [
      '/Applications/Visual Studio Code.app/Contents/MacOS/Electron --remote-debugging-port=9222 --enable-logging',
      '/usr/sbin/cupsd',
    ].join('\n');
    expect(parseCdpPortFromPsOutput(ps, 'Visual Studio Code')).toBe(9222);
  });

  it('handles --remote-debugging-port=<N> with equals sign', () => {
    const ps = '/Applications/Cursor.app/Contents/MacOS/Cursor --remote-debugging-port=9229';
    expect(parseCdpPortFromPsOutput(ps, 'Cursor')).toBe(9229);
  });

  it('handles --remote-debugging-port <N> with space', () => {
    const ps = '/Applications/Slack.app/Contents/MacOS/Slack --remote-debugging-port 9333';
    expect(parseCdpPortFromPsOutput(ps, 'Slack')).toBe(9333);
  });

  it('returns undefined when no matching line', () => {
    const ps = '/usr/sbin/cupsd\n/usr/bin/zsh';
    expect(parseCdpPortFromPsOutput(ps, 'Visual Studio Code')).toBeUndefined();
  });

  it('returns undefined when port is malformed', () => {
    const ps = '/Applications/Cursor.app/MacOS/Cursor --remote-debugging-port=abc';
    expect(parseCdpPortFromPsOutput(ps, 'Cursor')).toBeUndefined();
  });

  it('matches case-insensitively (bundle path uses different case)', () => {
    const ps = '/Applications/cursor.app/MacOS/Cursor --remote-debugging-port=9229';
    expect(parseCdpPortFromPsOutput(ps, 'Cursor')).toBe(9229);
  });

  it('skips lines that have the CDP flag but a different app', () => {
    const ps = [
      'Some-Other-App --remote-debugging-port=8000',
      '/Applications/Discord.app/Contents/MacOS/Discord --remote-debugging-port=9300',
    ].join('\n');
    expect(parseCdpPortFromPsOutput(ps, 'Discord')).toBe(9300);
  });
});

describe('fetchCdpTargets', () => {
  it('returns parsed targets from /json/list', async () => {
    const fakeTargets = [
      { id: 't1', type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1:0/devtools/page/1', title: 'README.md' },
      { id: 't2', type: 'service_worker' },
    ];
    const { port } = await startFakeCdpServer({ jsonList: fakeTargets });
    const result = await fetchCdpTargets(port, 2000);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('page');
  });

  it('rejects when the endpoint returns HTTP 500', async () => {
    const { port } = await startFakeCdpServer({ jsonList: { boom: true }, jsonListStatus: 500 });
    await expect(fetchCdpTargets(port, 2000)).rejects.toThrow(/HTTP 500/);
  });

  it('rejects when /json/list returns a non-array body', async () => {
    const { port } = await startFakeCdpServer({ jsonList: { not: 'an array' } });
    await expect(fetchCdpTargets(port, 2000)).rejects.toThrow(/did not return an array/);
  });

  it('rejects on connection refused (no server)', async () => {
    // Use a port number that's almost certainly closed.
    await expect(fetchCdpTargets(1, 1000)).rejects.toThrow();
  });
});

describe('fetchAxTreeOverWs', () => {
  it('sends getFullAXTree and returns the nodes array', async () => {
    const { port } = await startFakeCdpServer({
      onUpgrade: (socket) => {
        let acc = Buffer.alloc(0);
        socket.on('data', (chunk: Buffer) => {
          acc = Buffer.concat([acc, chunk]);
          const frame = readClientTextFrame(acc);
          if (!frame) return;
          acc = frame.rest;
          const msg = JSON.parse(frame.text);
          if (msg.method === 'Accessibility.getFullAXTree') {
            const reply = {
              id: msg.id,
              result: {
                nodes: [
                  { nodeId: '1', role: { value: 'RootWebArea' }, name: { value: 'Welcome' } },
                  { nodeId: '2', role: { value: 'button' }, name: { value: 'Submit' } },
                ],
              },
            };
            socket.write(encodeServerTextFrame(JSON.stringify(reply)));
          }
        });
      },
    });

    const tree = await fetchAxTreeOverWs(`ws://127.0.0.1:${port}/devtools/page/1`, 3000);
    expect(tree).toHaveLength(2);
    expect(tree[0].nodeId).toBe('1');
  });

  it('rejects wss:// URLs (out of scope for built-in fallback)', async () => {
    await expect(fetchAxTreeOverWs('wss://example.com/devtools/page/1', 1000)).rejects.toThrow(/wss/);
  });

  it('rejects on CDP error reply', async () => {
    const { port } = await startFakeCdpServer({
      onUpgrade: (socket) => {
        let acc = Buffer.alloc(0);
        socket.on('data', (chunk: Buffer) => {
          acc = Buffer.concat([acc, chunk]);
          const frame = readClientTextFrame(acc);
          if (!frame) return;
          acc = frame.rest;
          const msg = JSON.parse(frame.text);
          const reply = { id: msg.id, error: { code: -32601, message: 'Method not found' } };
          socket.write(encodeServerTextFrame(JSON.stringify(reply)));
        });
      },
    });
    await expect(fetchAxTreeOverWs(`ws://127.0.0.1:${port}/devtools/page/1`, 3000))
      .rejects.toThrow(/Method not found/);
  });

  it('skips events that arrive before the matching response', async () => {
    const { port } = await startFakeCdpServer({
      onUpgrade: (socket) => {
        let acc = Buffer.alloc(0);
        socket.on('data', (chunk: Buffer) => {
          acc = Buffer.concat([acc, chunk]);
          const frame = readClientTextFrame(acc);
          if (!frame) return;
          acc = frame.rest;
          const msg = JSON.parse(frame.text);
          // Unrelated event first
          socket.write(encodeServerTextFrame(JSON.stringify({ method: 'Page.frameNavigated', params: {} })));
          socket.write(encodeServerTextFrame(JSON.stringify({ id: msg.id, result: { nodes: [{ nodeId: 'x' }] } })));
        });
      },
    });
    const tree = await fetchAxTreeOverWs(`ws://127.0.0.1:${port}/devtools/page/1`, 3000);
    expect(tree[0].nodeId).toBe('x');
  });
});

describe('tryElectronAX', () => {
  it('returns activation hint when port is not provided and not detectable', async () => {
    // Use an obviously-not-running app name so port detection returns undefined.
    const result = await tryElectronAX('NotARealApp__no_cdp', { port: undefined });
    // No port detected → graceful error.
    expect(result.success).toBe(false);
    expect(result.activationHint).toContain('--remote-debugging-port');
  });

  it('returns activation hint when CDP port is unreachable', async () => {
    // Pass a closed port explicitly so detection is bypassed.
    const result = await tryElectronAX('Visual Studio Code', { port: 1, timeoutMs: 1000 });
    expect(result.success).toBe(false);
    expect(result.cdpPort).toBe(1);
    expect(result.error).toMatch(/CDP discovery failed/);
    expect(result.activationHint).toBeDefined();
  });

  it('reports when CDP has no page targets', async () => {
    const { port } = await startFakeCdpServer({ jsonList: [{ type: 'service_worker' }] });
    const result = await tryElectronAX('Visual Studio Code', { port, timeoutMs: 2000 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no page targets/);
  });

  it('returns the AX tree end-to-end when CDP is fully reachable', async () => {
    const fakeTree = [{ nodeId: 'root', role: { value: 'RootWebArea' }, name: { value: 'Welcome' } }];
    let wsPort = 0;
    const wsServer = trackServer(http.createServer());
    wsServer.on('upgrade', (req, socket) => {
      const key = req.headers['sec-websocket-key'] as string;
      const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      let acc = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        acc = Buffer.concat([acc, chunk]);
        const frame = readClientTextFrame(acc);
        if (!frame) return;
        acc = frame.rest;
        const msg = JSON.parse(frame.text);
        socket.write(encodeServerTextFrame(JSON.stringify({ id: msg.id, result: { nodes: fakeTree } })));
      });
    });
    await new Promise<void>((resolve) => wsServer.listen(0, '127.0.0.1', resolve));
    wsPort = (wsServer.address() as AddressInfo).port;

    // The HTTP /json/list lives on the same server.
    wsServer.on('request', (req, res) => {
      if (req.url === '/json/list') {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify([
          { id: '1', type: 'page', webSocketDebuggerUrl: `ws://127.0.0.1:${wsPort}/devtools/page/1` },
        ]));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    const result = await tryElectronAX('Visual Studio Code', { port: wsPort, timeoutMs: 3000 });
    expect(result.success).toBe(true);
    expect(result.cdpPort).toBe(wsPort);
    expect(result.bundleId).toBe('com.microsoft.VSCode');
    expect(result.tree).toHaveLength(1);
  });
});
