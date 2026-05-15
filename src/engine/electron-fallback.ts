/**
 * Electron app AX fallback via Chrome DevTools Protocol (CDP).
 *
 * macOS Accessibility API surfaces a very thin DOM tree for Electron apps
 * (VSCode, Cursor, Slack, Discord, …). When the user launches the app with
 * `--remote-debugging-port=<PORT>`, we can talk to CDP and ask the browser
 * itself for the full AX tree — orders of magnitude richer than what AX gives us.
 *
 * Design goals:
 *  - Zero new dependencies. We use Node built-ins (`child_process`, `http`)
 *    and a tiny RFC 6455 client just to ask CDP for the AX tree once.
 *  - Graceful degradation. When CDP is unreachable, return a friendly error
 *    with an `activationHint` explaining how to enable it.
 *  - Pure, side-effect-free I/O. Detection uses `ps`/`lsof` via execSync,
 *    consistent with the rest of the codebase.
 */

import { execSync } from 'child_process';
import * as http from 'http';
import { randomBytes, createHash } from 'crypto';
import { logError } from '../utils/logger.js';

// === Public types ===

export interface ElectronAXNode {
  nodeId: string;
  role: string;
  name?: string;
  description?: string;
  value?: string;
  childIds?: string[];
  // Anything else CDP returns (ignored downstream but preserved for debugging).
  [key: string]: unknown;
}

export interface ElectronAXResult {
  success: boolean;
  tree?: ElectronAXNode[];
  error?: string;
  /** When success === false, an actionable hint the caller can show. */
  activationHint?: string;
  /** Resolved bundle id (when we could detect one). */
  bundleId?: string;
  /** Resolved CDP port (when discoverable). */
  cdpPort?: number;
}

// === Known Electron bundle ids ===
// Used to short-circuit detection; the runtime-args probe in
// `findElectronCdpPort` is the real source of truth.

export const KNOWN_ELECTRON_BUNDLE_IDS: Record<string, string> = {
  'Visual Studio Code': 'com.microsoft.VSCode',
  'VSCode': 'com.microsoft.VSCode',
  'Code': 'com.microsoft.VSCode',
  'Cursor': 'com.todesktop.230313mzl4w4u92',
  'Slack': 'com.tinyspeck.slackmacgap',
  'Discord': 'com.hnc.Discord',
  // Common chromium-based Electron apps we don't claim to support but
  // will still work if CDP is enabled.
  'Figma': 'com.figma.Desktop',
  'Notion': 'notion.id',
  'Linear': 'com.linear',
  'Obsidian': 'md.obsidian',
};

const ACTIVATION_HINT = [
  'Electron CDP is not reachable.',
  'To enable it, quit the app and relaunch with --remote-debugging-port=<port>.',
  'Examples:',
  '  VSCode:  open -a "Visual Studio Code" --args --remote-debugging-port=9222',
  '  Cursor:  open -a "Cursor" --args --remote-debugging-port=9223',
  '  Slack:   open -a "Slack" --args --remote-debugging-port=9224',
  '  Discord: open -a "Discord" --args --remote-debugging-port=9225',
  'Then re-run with the same app name.',
].join('\n');

// === Entry point ===

export async function tryElectronAX(
  appName: string,
  options: { port?: number; timeoutMs?: number } = {},
): Promise<ElectronAXResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const bundleId = KNOWN_ELECTRON_BUNDLE_IDS[appName];

  // 1. Caller-provided port wins.
  // 2. Otherwise: probe `ps` for --remote-debugging-port.
  // 3. Otherwise: surface activation hint.
  let port = options.port ?? findElectronCdpPort(appName);

  if (!port) {
    return {
      success: false,
      bundleId,
      error: `No CDP port detected for "${appName}". Is it running with --remote-debugging-port?`,
      activationHint: ACTIVATION_HINT,
    };
  }

  // 1) HTTP discovery: pick the first page target.
  const targets = await fetchCdpTargets(port, timeoutMs).catch((err: Error) => err);
  if (targets instanceof Error) {
    return {
      success: false,
      bundleId,
      cdpPort: port,
      error: `CDP discovery failed on port ${port}: ${targets.message}`,
      activationHint: ACTIVATION_HINT,
    };
  }
  const pageTargets = targets.filter((t) => t.type === 'page' && typeof t.webSocketDebuggerUrl === 'string');
  if (pageTargets.length === 0) {
    return {
      success: false,
      bundleId,
      cdpPort: port,
      error: `CDP port ${port} responded but exposes no page targets.`,
      activationHint: ACTIVATION_HINT,
    };
  }

  // 2) Open WS and ask for the AX tree.
  try {
    const wsUrl = pageTargets[0].webSocketDebuggerUrl as string;
    const tree = await fetchAxTreeOverWs(wsUrl, timeoutMs);
    return { success: true, tree, bundleId, cdpPort: port };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('Electron CDP AX tree fetch failed', msg);
    return {
      success: false,
      bundleId,
      cdpPort: port,
      error: `CDP AX tree fetch failed: ${msg}`,
      activationHint: ACTIVATION_HINT,
    };
  }
}

// === Process / port discovery ===

/**
 * Inspect running processes for `--remote-debugging-port=<N>` arguments
 * belonging to the named Electron app. We grep on the app name (or its
 * bundle path fragment) and the CDP flag to keep the scan cheap.
 */
export function findElectronCdpPort(appName: string): number | undefined {
  // Shell-quote safely: we only allow letters/numbers/space/dot/dash.
  const safeName = appName.replace(/[^A-Za-z0-9 ._-]/g, '');
  if (!safeName) return undefined;

  let output = '';
  try {
    // `ps -Ao command=` gives us only the command/args column; grep narrows.
    // We avoid pipes by passing the whole thing through `sh -c`.
    output = execSync(
      `ps -Ao command= | grep -F -- '--remote-debugging-port='`,
      { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'], shell: '/bin/sh' },
    );
  } catch {
    return undefined;
  }

  return parseCdpPortFromPsOutput(output, safeName);
}

/**
 * Pure helper exported for testability: given the raw `ps`-like output and
 * the app name we're looking for, return the matching CDP port (if any).
 */
export function parseCdpPortFromPsOutput(psOutput: string, appName: string): number | undefined {
  const needle = appName.toLowerCase();
  const lines = psOutput.split('\n');
  for (const line of lines) {
    if (!line) continue;
    const lower = line.toLowerCase();
    // Match if the app name (or its bundle path) appears anywhere in the
    // command line. This handles `/Applications/Visual Studio Code.app/...`
    // as well as `Cursor Helper (Renderer)`.
    if (!lower.includes(needle)) continue;
    const match = line.match(/--remote-debugging-port[= ](\d+)/);
    if (match) {
      const port = parseInt(match[1], 10);
      if (port > 0 && port < 65536) return port;
    }
  }
  return undefined;
}

// === CDP HTTP discovery ===

export interface CdpTarget {
  id?: string;
  type?: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
  [key: string]: unknown;
}

export function fetchCdpTargets(port: number, timeoutMs: number): Promise<CdpTarget[]> {
  return httpGetJson(`http://127.0.0.1:${port}/json/list`, timeoutMs).then((data) => {
    if (!Array.isArray(data)) {
      throw new Error('CDP /json/list did not return an array');
    }
    return data as CdpTarget[];
  });
}

function httpGetJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${(err as Error).message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy(new Error(`HTTP timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
  });
}

// === Minimal WebSocket client for CDP ===
//
// CDP only needs single-request/single-response interactions for our use
// case, so we hand-roll the smallest possible WS client instead of pulling
// in the `ws` package. We support:
//   - Client-side opening handshake (RFC 6455 §4)
//   - Sending masked text frames < 64 KiB
//   - Reading server text frames (unmasked) and reassembling them
//   - One ping/pong is allowed; everything else is treated as protocol error.

const MAX_FRAME_PAYLOAD = 8 * 1024 * 1024; // 8 MiB safety cap on incoming frames

export function fetchAxTreeOverWs(wsUrl: string, timeoutMs: number): Promise<ElectronAXNode[]> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(wsUrl);
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      reject(new Error(`Unsupported WS protocol: ${parsed.protocol}`));
      return;
    }
    if (parsed.protocol === 'wss:') {
      // CDP almost always exposes ws:// on localhost; if someone's running
      // wss://, we'd need to bring in `https` + cert handling. Skip for now.
      reject(new Error('wss:// CDP endpoints are not supported by the built-in fallback'));
      return;
    }

    const key = randomBytes(16).toString('base64');
    const expectedAccept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    const req = http.request({
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 80,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        Host: `${parsed.hostname}:${parsed.port || 80}`,
      },
    });

    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      try { req.destroy(); } catch { /* ignore */ }
      reject(err);
    };
    const succeed = (tree: ElectronAXNode[]) => {
      if (settled) return;
      settled = true;
      resolve(tree);
    };

    const overallTimer = setTimeout(() => fail(new Error(`WS overall timeout after ${timeoutMs}ms`)), timeoutMs);

    req.on('error', fail);
    req.on('timeout', () => fail(new Error(`WS handshake timeout after ${timeoutMs}ms`)));

    req.on('upgrade', (res, socket) => {
      if (res.headers['sec-websocket-accept'] !== expectedAccept) {
        fail(new Error('WS handshake: Sec-WebSocket-Accept mismatch'));
        return;
      }

      // Send Accessibility.getFullAXTree (CDP method).
      const requestId = 1;
      const payload = JSON.stringify({ id: requestId, method: 'Accessibility.getFullAXTree' });
      socket.write(encodeTextFrame(payload));

      let buffer: Buffer = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]) as Buffer;
        // Drain as many complete frames as we have.
        while (true) {
          const frame = tryReadFrame(buffer);
          if (!frame) break;
          buffer = frame.rest as Buffer;

          if (frame.opcode === 0x9) {
            // Ping → reply with pong.
            socket.write(encodePongFrame(frame.payload));
            continue;
          }
          if (frame.opcode === 0xA) continue; // pong, ignore
          if (frame.opcode === 0x8) {
            // close
            fail(new Error('WS closed before response'));
            return;
          }
          if (frame.opcode !== 0x1 && frame.opcode !== 0x0) {
            // Binary or unknown — not what CDP uses.
            fail(new Error(`Unexpected WS opcode 0x${frame.opcode.toString(16)}`));
            return;
          }

          // Text frame — CDP JSON message.
          let parsed: { id?: number; result?: { nodes?: ElectronAXNode[] }; error?: { message?: string } };
          try {
            parsed = JSON.parse(frame.payload.toString('utf-8'));
          } catch (err) {
            fail(new Error(`Invalid CDP JSON: ${(err as Error).message}`));
            return;
          }
          if (parsed.id !== requestId) {
            // CDP may emit unrelated events before our response. Skip them.
            continue;
          }
          if (parsed.error) {
            fail(new Error(`CDP error: ${parsed.error.message ?? 'unknown'}`));
            return;
          }
          const nodes = parsed.result?.nodes ?? [];
          clearTimeout(overallTimer);
          try { socket.end(encodeCloseFrame()); } catch { /* ignore */ }
          succeed(nodes);
          return;
        }
      });
      socket.on('error', fail);
      socket.on('close', () => {
        if (!settled) fail(new Error('WS closed unexpectedly'));
      });
    });

    req.end();
  });
}

// === RFC 6455 frame helpers ===

function encodeTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf-8');
  return encodeFrame(0x1, payload, /* masked */ true);
}

function encodePongFrame(payload: Buffer): Buffer {
  return encodeFrame(0xA, payload, true);
}

function encodeCloseFrame(): Buffer {
  return encodeFrame(0x8, Buffer.alloc(0), true);
}

function encodeFrame(opcode: number, payload: Buffer, masked: boolean): Buffer {
  const len = payload.length;
  const fin = 0x80;
  const head: number[] = [fin | (opcode & 0x0F)];
  const maskBit = masked ? 0x80 : 0;

  if (len < 126) {
    head.push(maskBit | len);
  } else if (len < 65536) {
    head.push(maskBit | 126, (len >> 8) & 0xFF, len & 0xFF);
  } else {
    head.push(maskBit | 127);
    // 64-bit length, but we cap well below 2^32 so high 4 bytes are 0.
    head.push(0, 0, 0, 0, (len >>> 24) & 0xFF, (len >>> 16) & 0xFF, (len >>> 8) & 0xFF, len & 0xFF);
  }

  const header = Buffer.from(head);
  if (!masked) return Buffer.concat([header, payload]);

  const mask = randomBytes(4);
  const masked_payload = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked_payload[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, mask, masked_payload]);
}

interface ParsedFrame {
  opcode: number;
  payload: Buffer;
  rest: Buffer;
}

function tryReadFrame(buf: Buffer): ParsedFrame | null {
  if (buf.length < 2) return null;
  const b0 = buf[0];
  const b1 = buf[1];
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0F;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7F;
  let offset = 2;

  if (len === 126) {
    if (buf.length < offset + 2) return null;
    len = buf.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buf.length < offset + 8) return null;
    const hi = buf.readUInt32BE(offset);
    const lo = buf.readUInt32BE(offset + 4);
    if (hi !== 0) throw new Error('WS frame too large (>4GiB)');
    len = lo;
    offset += 8;
  }

  if (len > MAX_FRAME_PAYLOAD) {
    throw new Error(`WS frame too large (${len} bytes)`);
  }

  let mask: Buffer | null = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    mask = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buf.length < offset + len) return null;

  let payload = buf.subarray(offset, offset + len);
  if (mask) {
    const unmasked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i % 4];
    payload = unmasked;
  }
  // We only handle FIN=1 single-fragment frames — CDP responses fit easily.
  if (!fin) throw new Error('Fragmented WS frames are not supported');

  return { opcode, payload, rest: buf.subarray(offset + len) };
}
